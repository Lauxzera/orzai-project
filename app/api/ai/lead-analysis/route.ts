import { NextResponse } from "next/server";
import { z } from "zod";
import {
  denormalizeLeadStatus,
  fallbackLeadAnalysis,
  generateLeadAnalysisWithOpenRouter,
  hasOpenRouterConfig,
} from "@/lib/ai";
import { getSessionUser } from "@/lib/server/auth";
import { getCachedValue, getOrSetInFlightValue, setCachedValue } from "@/lib/server/ai-cache";
import { findLeadWithTasks } from "@/lib/server/crm-repository";
import { createLogger } from "@/lib/server/logger";
import { findConversationByLeadId, getConversationMessages } from "@/lib/server/messages-repository";

const logger = createLogger("ai/lead-analysis");

const requestSchema = z.object({
  leadId: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const body = requestSchema.parse(await request.json());
    const target = await findLeadWithTasks(body.leadId);
    if (!target) {
      return NextResponse.json({ error: "Lead nao encontrado." }, { status: 404 });
    }

    const conversation = await findConversationByLeadId(body.leadId);
    const conversationData = conversation ? await getConversationMessages(conversation.id).catch(() => ({ messages: [] })) : { messages: [] };
    const conversationMessages = (conversationData.messages ?? []).map((message) => ({
      direction: message.direction,
      content: message.content,
      timestamp: message.timestamp,
    }));
    const context = {
      leadHistory: target.lead.history.slice(-8),
      conversationMessages,
    };

    const cacheKey = JSON.stringify({
      leadId: target.lead.id,
      status: target.lead.status_funil,
      matricula: target.lead.status_matricula,
      nextContact: target.lead.proximo_contato,
      objection: target.lead.objecao_principal,
      notes: target.lead.observacoes,
      history: target.lead.history.slice(-4),
      tasks: target.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        owner: task.owner,
        dueDate: task.dueDate,
        done: task.done,
      })),
      conversationId: conversation?.id ?? null,
      conversationLastMessageAt: conversation?.lastMessageAt ?? null,
      conversationLastMessage: conversation?.lastMessage ?? null,
      conversationMessages: conversationMessages.map((message) => ({
        direction: message.direction,
        content: message.content,
        timestamp: message.timestamp,
      })),
    });

    const cached = getCachedValue<Record<string, unknown>>("lead-analysis", cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const payload = await getOrSetInFlightValue("lead-analysis", cacheKey, async () => {
      if (hasOpenRouterConfig()) {
        try {
          const result = await generateLeadAnalysisWithOpenRouter(target.lead, target.tasks, context);
          return setCachedValue(
            "lead-analysis",
            cacheKey,
            {
              ...result,
              status_sugerido: denormalizeLeadStatus(result.status_sugerido),
              predictive_score: target.lead.predictive_score ?? null,
              predictive_score_confidence: target.lead.predictive_score_confidence ?? "",
              predictive_score_reasons: target.lead.predictive_score_reasons ?? [],
              predictive_score_risks: target.lead.predictive_score_risks ?? [],
              predictive_score_source: target.lead.predictive_score_source ?? "",
              predictive_score_updated_at: target.lead.predictive_score_updated_at ?? "",
            },
            3 * 60_000
          );
        } catch (error) {
          logger.error("falha ao chamar openrouter, usando fallback", error, { leadId: target.lead.id });
        }
      }

      const fallback = fallbackLeadAnalysis(target.lead, target.tasks, context);
      return setCachedValue(
        "lead-analysis",
        cacheKey,
        {
          ...fallback,
          status_sugerido: denormalizeLeadStatus(fallback.status_sugerido),
          predictive_score: target.lead.predictive_score ?? null,
          predictive_score_confidence: target.lead.predictive_score_confidence ?? "",
          predictive_score_reasons: target.lead.predictive_score_reasons ?? [],
          predictive_score_risks: target.lead.predictive_score_risks ?? [],
          predictive_score_source: target.lead.predictive_score_source ?? "",
          predictive_score_updated_at: target.lead.predictive_score_updated_at ?? "",
        },
        3 * 60_000
      );
    });

    return NextResponse.json(payload);
  } catch (error) {
    logger.error("falha ao processar analise de lead", error, { userId: user.id });
    return NextResponse.json(
      {
        error: "Nao foi possivel analisar o lead agora.",
      },
      { status: 500 }
    );
  }
}
