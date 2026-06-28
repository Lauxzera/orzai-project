import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAssistantFallback,
  generateAssistantReplyWithOpenRouter,
  hasOpenRouterConfig,
  searchWeb,
  shouldPreferCrmFallback,
  shouldUseWebSearch,
  type ChatMessage,
} from "@/lib/ai";
import { getSessionUser } from "@/lib/server/auth";
import { getCachedValue, getOrSetInFlightValue, setCachedValue } from "@/lib/server/ai-cache";
import { getCrmFacts, getCrmState } from "@/lib/server/crm-repository";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger("ai/assistant");

const requestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  selectedLeadId: z.string().nullable().optional(),
});

function buildWebOnlyFallback(
  latestUserMessage: string,
  webResults: Array<{ title: string; url: string; snippet?: string }>
) {
  if (!webResults.length) {
    return {
      answer: `Nao consegui usar a IA nesta rodada, mas posso tentar novamente. Se preferir, reformule o pedido em uma frase mais curta como: "${latestUserMessage.slice(0, 80)}".`,
      source: "fallback" as const,
    };
  }

  const lines = [
    "Nao consegui concluir a resposta da IA agora, mas ja encontrei referencias uteis na web:",
    ...webResults.slice(0, 3).map((result) => `- ${result.title}: ${result.snippet || result.url}`),
    "",
    "Se quiser, tente novamente em seguida que eu monto a resposta completa com base nisso.",
  ];

  return {
    answer: lines.join("\n"),
    source: "fallback" as const,
    references: webResults,
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ answer: "Sessao expirada. Faca login novamente.", source: "fallback" }, { status: 401 });
  }

  try {
    const body = requestSchema.parse(await request.json());
    const chatMessages = body.messages as ChatMessage[];
    const openRouterAvailable = hasOpenRouterConfig();

    const latestUserMessage = [...chatMessages].reverse().find((message) => message.role === "user")?.content ?? "";
    const useWebSearch = shouldUseWebSearch(latestUserMessage);
    const preferCrmFallback = shouldPreferCrmFallback(latestUserMessage);
    const cacheKey = JSON.stringify({
      selectedLeadId: body.selectedLeadId ?? null,
      messages: chatMessages.slice(-6),
      useWebSearch,
      preferCrmFallback,
    });
    const cached = getCachedValue<{ answer: string; source: "openrouter" | "fallback"; references?: Array<{ title: string; url: string; snippet?: string }> }>("assistant-reply", cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const reply = await getOrSetInFlightValue("assistant-reply", cacheKey, async () => {
      const [crmState, crmFacts] = await Promise.all([getCrmState(), getCrmFacts()]);
      if (preferCrmFallback) {
        const fallback = buildAssistantFallback(chatMessages, crmState, body.selectedLeadId, crmFacts);
        return setCachedValue("assistant-reply", cacheKey, fallback, 20_000);
      }

      const webResults = useWebSearch ? await searchWeb(latestUserMessage).catch((error) => {
        logger.error("falha na busca web", error, { userId: user.id });
        return [];
      }) : [];

      if (openRouterAvailable) {
        try {
          const openRouterReply = await generateAssistantReplyWithOpenRouter(chatMessages, crmState, body.selectedLeadId, webResults);
          return setCachedValue("assistant-reply", cacheKey, openRouterReply, 45_000);
        } catch (error) {
          logger.error("falha ao chamar openrouter, usando fallback", error, { userId: user.id, selectedLeadId: body.selectedLeadId ?? null });
          if (useWebSearch) {
            const webFallback = buildWebOnlyFallback(latestUserMessage, webResults);
            return setCachedValue("assistant-reply", cacheKey, webFallback, 20_000);
          }

          const fallback = buildAssistantFallback(chatMessages, crmState, body.selectedLeadId, crmFacts);
          return setCachedValue("assistant-reply", cacheKey, fallback, 20_000);
        }
      }

      const fallback = buildAssistantFallback(chatMessages, crmState, body.selectedLeadId, crmFacts);
      return setCachedValue("assistant-reply", cacheKey, fallback, 45_000);
    });

    return NextResponse.json(reply);
  } catch (error) {
    logger.error("falha ao processar pedido do assistente", error, { userId: user.id });
    return NextResponse.json(
      {
        answer: "Nao consegui consultar o assistente agora. Tente novamente em instantes.",
        source: "fallback",
      },
      { status: 200 }
    );
  }
}
