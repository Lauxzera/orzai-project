import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenRouterConfigForTask, hasOpenRouterConfig } from "@/lib/ai";
import { courses, currentDate, funnelStatuses, type Lead } from "@/lib/crm";
import type { ConversationAnalysis, LeadSuggestionField, Message } from "@/lib/messages";
import { getCachedValue, getOrSetInFlightValue, setCachedValue } from "@/lib/server/ai-cache";
import { getSessionUser } from "@/lib/server/auth";
import { getCrmState } from "@/lib/server/crm-repository";
import { createLogger } from "@/lib/server/logger";
import { buildConversationFingerprint, findConversationByLeadId, getConversationMessages } from "@/lib/server/messages-repository";

const logger = createLogger("ai/conversation-analysis");

const FAST_TRACK_MESSAGE_LIMIT = 4;
const ANALYSIS_MESSAGE_WINDOW = 4;

const suggestionFields = [
  "curso_de_interesse",
  "status_funil",
  "status_matricula",
  "proximo_contato",
  "objecao_principal",
  "observacoes",
  "cidade",
  "profissao",
  "email",
] as const satisfies readonly LeadSuggestionField[];

const requestSchema = z
  .object({
    conversationId: z.string().min(1).optional(),
    leadId: z.string().min(1).nullable().optional(),
    leadStatus: z.string().nullable().optional(),
    messages: z
      .array(
        z.object({
          id: z.string().optional(),
          direction: z.enum(["inbound", "outbound"]),
          content: z.string().max(1000),
          timestamp: z.string(),
        })
      )
      .max(30)
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.messages.length && !value.conversationId && !value.leadId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe conversationId, leadId ou messages.",
      });
    }
  });

const leadSuggestionSchema = z.object({
  field: z.enum(suggestionFields),
  label: z.string(),
  currentValue: z.string(),
  suggestedValue: z.string(),
  reason: z.string(),
});

const analysisZodSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  urgency: z.enum(["alta", "media", "baixa"]),
  suggestedStatus: z.string().nullable(),
  suggestedAction: z.string(),
  leadSuggestions: z.array(leadSuggestionSchema).max(5).default([]),
});

const openRouterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "sentiment", "urgency", "suggestedStatus", "suggestedAction", "leadSuggestions"],
  properties: {
    summary: { type: "string" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    urgency: { type: "string", enum: ["alta", "media", "baixa"] },
    suggestedStatus: { type: ["string", "null"] },
    suggestedAction: { type: "string" },
    leadSuggestions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "label", "currentValue", "suggestedValue", "reason"],
        properties: {
          field: { type: "string", enum: [...suggestionFields] },
          label: { type: "string" },
          currentValue: { type: "string" },
          suggestedValue: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

type RequestBody = z.infer<typeof requestSchema>;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  try {
    const parsed = requestSchema.parse(await request.json());
    const directMessages = parsed.messages.slice(-ANALYSIS_MESSAGE_WINDOW).map((message) => ({
      id: message.id,
      direction: message.direction,
      content: message.content,
      timestamp: message.timestamp,
    }));

    if (directMessages.length) {
      const crmState = await getCrmState();
      const lead = parsed.leadId ? crmState.leads.find((item) => item.id === parsed.leadId) ?? null : null;
      return NextResponse.json(await runAnalysis({ ...parsed, messages: directMessages }, lead));
    }

    if (parsed.conversationId) {
      const [crmState, storedMessages] = await Promise.all([getCrmState(), loadMessagesForAnalysis(parsed.conversationId)]);
      const lead = parsed.leadId ? crmState.leads.find((item) => item.id === parsed.leadId) ?? null : null;
      const cacheKey = buildAnalysisCacheKey(parsed.conversationId, storedMessages, parsed.leadStatus ?? null);
      const cached = getCachedValue<ConversationAnalysis>("conversation-analysis", cacheKey);
      if (cached) return NextResponse.json(cached);

      const messages = storedMessages.slice(-ANALYSIS_MESSAGE_WINDOW).map((message) => ({
        id: message.id,
        direction: message.direction,
        content: message.content,
        timestamp: message.timestamp,
      }));

      const body = { ...parsed, messages };
      if (!messages.length) {
        return NextResponse.json(fallbackAnalysis(body, lead));
      }

      const result = await getOrSetInFlightValue("conversation-analysis", cacheKey, async () => {
        const warmCache = getCachedValue<ConversationAnalysis>("conversation-analysis", cacheKey);
        if (warmCache) return warmCache;
        return setCachedValue("conversation-analysis", cacheKey, await runAnalysis(body, lead), 3 * 60_000);
      });
      return NextResponse.json(result);
    }

    if (parsed.leadId) {
      const [crmState, conversation] = await Promise.all([getCrmState(), findConversationByLeadId(parsed.leadId)]);
      const lead = crmState.leads.find((item) => item.id === parsed.leadId) ?? null;

      if (!conversation) {
        return NextResponse.json(fallbackAnalysis({ ...parsed, messages: [] }, lead));
      }

      const storedMessages = await loadMessagesForAnalysis(conversation.id);
      const cacheKey = buildConversationFingerprint(conversation, storedMessages);
      const cached = getCachedValue<ConversationAnalysis>("conversation-analysis", cacheKey);
      if (cached) return NextResponse.json(cached);

      const messages = storedMessages.slice(-ANALYSIS_MESSAGE_WINDOW).map((message) => ({
        id: message.id,
        direction: message.direction,
        content: message.content,
        timestamp: message.timestamp,
      }));

      const body = {
        ...parsed,
        conversationId: conversation.id,
        leadId: parsed.leadId,
        leadStatus: parsed.leadStatus ?? conversation.leadStatus ?? null,
        messages,
      };

      if (!messages.length) {
        return NextResponse.json(fallbackAnalysis(body, lead));
      }

      const result = await getOrSetInFlightValue("conversation-analysis", cacheKey, async () => {
        const warmCache = getCachedValue<ConversationAnalysis>("conversation-analysis", cacheKey);
        if (warmCache) return warmCache;
        return setCachedValue("conversation-analysis", cacheKey, await runAnalysis(body, lead), 3 * 60_000);
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(fallbackAnalysis({ ...parsed, messages: [] }, null));
  } catch (error) {
    logger.error("falha ao processar analise de conversa", error);
    return NextResponse.json({ error: "Nao foi possivel analisar a conversa." }, { status: 500 });
  }
}

async function loadMessagesForAnalysis(conversationId: string): Promise<Message[]> {
  try {
    const { messages } = await getConversationMessages(conversationId);
    return messages;
  } catch {
    return [];
  }
}

function buildAnalysisCacheKey(conversationId: string, messages: Message[], leadStatus: string | null): string {
  const last = messages.at(-1);
  const recentIds = messages.slice(-4).map((message) => message.id).join(",");
  return [conversationId, last?.timestamp ?? "", last?.content?.slice(0, 30) ?? "", leadStatus ?? "", recentIds].join("::");
}

async function runAnalysis(body: RequestBody, lead: Lead | null) {
  const fastTrack = buildFastTrackAnalysis(body, lead);
  if (fastTrack) {
    return fastTrack;
  }

  const prompt = buildPrompt(body, lead);

  if (hasOpenRouterConfig()) {
    try {
      const { baseUrl, apiKey, model, siteUrl, appName } = getOpenRouterConfigForTask("conversation-analysis");
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
          ...(appName ? { "X-Title": appName } : {}),
        },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.1,
          max_tokens: 220,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "conversation_analysis",
              strict: true,
              schema: openRouterSchema,
            },
          },
          messages: [
            {
              role: "system",
              content: "Voce e um analista comercial do Base CRM. Responda em portugues do Brasil com JSON limpo, sem markdown.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = extractJson((data.choices?.[0]?.message?.content || "").trim());
        const parsed = analysisZodSchema.parse(JSON.parse(raw));
        return mergeAnalysisWithLeadSuggestions({ ...parsed, source: "openrouter" }, body, lead);
      }
    } catch (error) {
      logger.error("falha ao chamar openrouter, usando fallback", error, { conversationId: body.conversationId, leadId: body.leadId });
    }
  }

  return fallbackAnalysis(body, lead);
}

function buildPrompt(body: RequestBody, lead: Lead | null) {
  const lines = body.messages.map((message) => {
    const who = message.direction === "inbound" ? "Lead" : "Instituto";
    const time = new Date(message.timestamp).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    return `[${time}] ${who}: ${message.content.slice(0, 180)}`;
  });

  return [
    "Analise esta conversa recente do WhatsApp do Base CRM.",
    `Status atual do lead no funil: ${body.leadStatus ?? "desconhecido"}`,
    lead
      ? `Cadastro atual do lead: curso=${lead.curso_de_interesse}; matricula=${lead.status_matricula}; proximo_contato=${lead.proximo_contato || "vazio"}; objecao=${lead.objecao_principal || "vazia"}; cidade=${lead.cidade || "vazia"}; email=${lead.email || "vazio"}`
      : "Cadastro atual do lead indisponivel para sugestoes.",
    "",
    "Conversa recente:",
    ...lines,
    "",
    `Status disponiveis para sugestao: ${funnelStatuses.join(", ")}`,
    "Considere principalmente as ultimas mensagens.",
    "Se houver pouco sinal, seja curta, concreta e operacional.",
    "Cada reason de leadSuggestions deve ter no maximo 10 palavras.",
    "Retorne JSON com: summary, sentiment, urgency, suggestedStatus, suggestedAction, leadSuggestions.",
  ].join("\n");
}

function fallbackAnalysis(body: RequestBody, lead: Lead | null): ConversationAnalysis {
  const inbound = body.messages.filter((message) => message.direction === "inbound");
  const last = body.messages.at(-1);
  const lastIsInbound = last?.direction === "inbound";
  const totalMessages = body.messages.length;
  const lowerMessages = body.messages.map((message) => message.content.toLowerCase()).join("\n");

  const sentiment = totalMessages >= 6 ? "positive" : totalMessages >= 3 ? "neutral" : "neutral";
  const urgency =
    ["Aguardando Pagamento", "Negociacao / Matricula"].includes(body.leadStatus ?? "") ? "alta" : inbound.length >= 3 ? "media" : "baixa";

  return mergeAnalysisWithLeadSuggestions(
    {
      summary: lastIsInbound
        ? `Lead respondeu ativamente. Conversa em andamento com ${totalMessages} mensagens trocadas.`
        : "Ultima mensagem enviada pelo Instituto. Aguardando retorno do lead.",
      sentiment,
      urgency,
      suggestedStatus: null,
      suggestedAction: lastIsInbound
        ? "Responder a ultima mensagem do lead e avancar para o proximo passo do funil."
        : "Fazer follow-up amigavel se o lead nao responder em 24h.",
      leadSuggestions: buildFallbackLeadSuggestions(lead, body.leadStatus ?? null, lowerMessages),
      source: "fallback",
    },
    body,
    lead
  );
}

function buildFastTrackAnalysis(body: RequestBody, lead: Lead | null): ConversationAnalysis | null {
  const compactMessages = body.messages.filter((message) => message.content.trim());
  if (!compactMessages.length) return fallbackAnalysis(body, lead);

  const lowerMessages = compactMessages.map((message) => message.content.toLowerCase()).join("\n");
  const lowSignalConversation =
    compactMessages.length <= FAST_TRACK_MESSAGE_LIMIT &&
    !/(valor|preco|preço|parcel|matric|turma|horario|horário|curso|presencial|online|endereco|endereço|boleto|pix|email|cidade|pagamento|desconto|investimento)/.test(
      lowerMessages
    );

  if (!lowSignalConversation) {
    return null;
  }

  const last = compactMessages.at(-1);
  const lastIsInbound = last?.direction === "inbound";

  return mergeAnalysisWithLeadSuggestions(
    {
      summary: lastIsInbound
        ? "Conversa curta e ainda inicial. O lead respondeu, mas faltam dados objetivos para avancar."
        : "Conversa curta e sem novos sinais claros do lead. Melhor seguir com proximo contato objetivo.",
      sentiment: "neutral",
      urgency: "baixa",
      suggestedStatus: body.leadStatus ?? lead?.status_funil ?? null,
      suggestedAction: lastIsInbound
        ? "Responder de forma objetiva e colher curso, cidade e intencao de matricula."
        : "Enviar uma pergunta direta para destravar a conversa e registrar o proximo passo.",
      leadSuggestions: buildRuleBasedLeadSuggestions(lead, body.leadStatus ?? null, lowerMessages),
      source: "fallback",
    },
    body,
    lead
  );
}

function buildFallbackLeadSuggestions(lead: Lead | null, leadStatus: string | null, lowerMessages: string): ConversationAnalysis["leadSuggestions"] {
  if (!lead) return [];

  const suggestions = buildRuleBasedLeadSuggestions(lead, leadStatus, lowerMessages);
  if (!lead.observacoes && lowerMessages.trim()) {
    suggestions.push({
      field: "observacoes",
      label: "Observacoes",
      currentValue: lead.observacoes,
      suggestedValue: "Resumo da conversa recente registrado pela IA para apoio ao atendimento.",
      reason: "Ha contexto util para salvar.",
    });
  }

  return uniqueLeadSuggestions(suggestions).slice(0, 5);
}

function buildRuleBasedLeadSuggestions(
  lead: Lead | null,
  leadStatus: string | null,
  lowerMessages: string
): NonNullable<ConversationAnalysis["leadSuggestions"]> {
  if (!lead) return [];

  const suggestions: NonNullable<ConversationAnalysis["leadSuggestions"]> = [];

  if (leadStatus && lead.status_funil !== leadStatus && funnelStatuses.includes(leadStatus as (typeof funnelStatuses)[number])) {
    suggestions.push({
      field: "status_funil",
      label: "Funil",
      currentValue: lead.status_funil,
      suggestedValue: leadStatus,
      reason: "Conversa indica outro momento.",
    });
  }

  if (!lead.objecao_principal && /parcel|desconto|valor|preco|preço|orcamento|orçamento/.test(lowerMessages)) {
    suggestions.push({
      field: "objecao_principal",
      label: "Objecao principal",
      currentValue: lead.objecao_principal,
      suggestedValue: "Preco / condicao de pagamento",
      reason: "Ha sensibilidade a preco.",
    });
  }

  if (!lead.objecao_principal && /distancia|distância|longe|deslocamento|transporte/.test(lowerMessages)) {
    suggestions.push({
      field: "objecao_principal",
      label: "Objecao principal",
      currentValue: lead.objecao_principal,
      suggestedValue: "Distancia / deslocamento",
      reason: "Ha dificuldade com deslocamento.",
    });
  }

  if (!lead.proximo_contato) {
    suggestions.push({
      field: "proximo_contato",
      label: "Proximo contato",
      currentValue: lead.proximo_contato,
      suggestedValue: currentDate(1),
      reason: "Vale registrar proximo passo.",
    });
  }

  const extractedEmail = extractEmail(lowerMessages);
  if (extractedEmail && extractedEmail.toLowerCase() !== lead.email.toLowerCase()) {
    suggestions.push({
      field: "email",
      label: "Email",
      currentValue: lead.email,
      suggestedValue: extractedEmail,
      reason: "Email apareceu na conversa.",
    });
  }

  const extractedCourse = courses.find((course) => lowerMessages.includes(course.toLowerCase()));
  if (extractedCourse && extractedCourse !== lead.curso_de_interesse) {
    suggestions.push({
      field: "curso_de_interesse",
      label: "Curso",
      currentValue: lead.curso_de_interesse,
      suggestedValue: extractedCourse,
      reason: "Outro curso foi citado.",
    });
  }

  const extractedCity = inferCity(lowerMessages);
  if (extractedCity && extractedCity.toLowerCase() !== lead.cidade.toLowerCase()) {
    suggestions.push({
      field: "cidade",
      label: "Cidade",
      currentValue: lead.cidade,
      suggestedValue: extractedCity,
      reason: "Cidade foi mencionada claramente.",
    });
  }

  if (/quero|tenho interesse|vamos fechar|pode gerar|link de pagamento|quero me matricular/.test(lowerMessages)) {
    suggestions.push({
      field: "status_funil",
      label: "Funil",
      currentValue: lead.status_funil,
      suggestedValue: "Negociacao / Matricula",
      reason: "Ha intencao concreta de avancar.",
    });
  }

  if (/pagamento|pix|boleto|cartao|cartão/.test(lowerMessages) && lead.status_matricula !== "Aguardando pagamento") {
    suggestions.push({
      field: "status_matricula",
      label: "Matricula",
      currentValue: lead.status_matricula,
      suggestedValue: "Aguardando pagamento",
      reason: "Conversa entrou em pagamento.",
    });
  }

  return suggestions;
}

function mergeAnalysisWithLeadSuggestions(analysis: ConversationAnalysis, body: RequestBody, lead: Lead | null): ConversationAnalysis {
  const lowerMessages = body.messages.map((message) => message.content.toLowerCase()).join("\n");
  const mergedSuggestions = uniqueLeadSuggestions([
    ...(analysis.leadSuggestions ?? []),
    ...buildRuleBasedLeadSuggestions(lead, body.leadStatus ?? null, lowerMessages),
  ]).slice(0, 5);

  return {
    ...analysis,
    leadSuggestions: mergedSuggestions,
  };
}

function uniqueLeadSuggestions(
  suggestions: NonNullable<ConversationAnalysis["leadSuggestions"]>
): NonNullable<ConversationAnalysis["leadSuggestions"]> {
  const map = new Map<LeadSuggestionField, NonNullable<ConversationAnalysis["leadSuggestions"]>[number]>();
  for (const suggestion of suggestions) {
    if (!suggestion.suggestedValue.trim()) continue;
    if (suggestion.currentValue.trim() === suggestion.suggestedValue.trim()) continue;
    if (!map.has(suggestion.field)) {
      map.set(suggestion.field, suggestion);
    }
  }
  return Array.from(map.values());
}

function extractEmail(value: string) {
  return value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? null;
}

function inferCity(value: string) {
  const knownCities = ["sao paulo", "guarulhos", "osasco", "barueri", "santo andre", "sao bernardo", "diadema"];
  const found = knownCities.find((city) => value.includes(city));
  if (!found) return null;
  return found
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractJson(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("JSON nao encontrado na resposta.");
}
