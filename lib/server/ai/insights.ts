import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { z } from "zod";

const insightSchema = z.object({
  sentiment: z.string(),
  objections: z.array(z.string()),
  summary: z.string(),
});

export async function generateConversationInsight(conversationId: string) {
  const prisma = getPrismaClient();

  // 1. Fetch messages
  const conversation = await prisma.messageConversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { timestamp: 'asc' } } }
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // 2. Concatenate transcript
  const transcript = conversation.messages.map(m => {
    const role = m.direction === 'inbound' ? 'Lead' : 'Agent';
    return `[${m.timestamp.toISOString()}] ${role}: ${m.content}`;
  }).join('\n');

  if (!transcript.trim()) {
    return null;
  }

  // 3. Call AI
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();
  const baseUrl = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const model = (process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim();
  const siteUrl = (process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "").trim();
  const appName = (process.env.OPENROUTER_APP_NAME || "Base CRM").trim();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const systemPrompt = `Você é um analista de vendas B2B/B2C especializado. Analise a seguinte transcrição de conversa e retorne em formato JSON estrito, de acordo com o seguinte schema:
{
  "sentiment": "Positivo|Neutro|Negativo",
  "objections": ["Objeção 1", "Objeção 2"],
  "summary": "Resumo da conversa"
}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
      ...(appName ? { "X-Title": appName } : {}),
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.1,
      max_tokens: 320,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Transcrição:\n${transcript}` }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter respondeu com status ${response.status}. ${body}`.trim());
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  
  if (!rawContent) {
    throw new Error("Invalid AI response");
  }

  let parsedRaw;
  try {
    parsedRaw = JSON.parse(rawContent);
  } catch(e) {
    throw new Error(`Failed to parse AI response as JSON: ${rawContent}`);
  }
  
  const parsed = insightSchema.parse(parsedRaw);

  // 4. Save to database
  const insight = await prisma.conversationInsight.upsert({
    where: { conversationId },
    create: {
      conversationId,
      sentiment: parsed.sentiment,
      objections: parsed.objections,
      summary: parsed.summary
    },
    update: {
      sentiment: parsed.sentiment,
      objections: parsed.objections,
      summary: parsed.summary
    }
  });

  return insight;
}
