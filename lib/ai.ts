import { z } from "zod";
import {
  closingStatuses,
  currentDate,
  funnelStatuses,
  type HistoryEntry,
  isOverdue,
  type CrmState,
  type FunnelStatus,
  type Lead,
  type Task
} from "@/lib/crm";
import type { Message } from "@/lib/messages";

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Versoes sem acento para compatibilidade com schema estruturado da IA.
// Derivadas de funnelStatuses para nunca divergir da lista real.
const leadStatusValues = funnelStatuses.map(stripAccents) as unknown as [string, ...string[]];

const leadAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "resumo",
    "temperatura",
    "urgencia",
    "objecao_principal",
    "proxima_acao",
    "status_sugerido",
    "sinais_de_compra",
    "riscos",
    "mensagem_whatsapp"
  ],
  properties: {
    resumo: { type: "string" },
    temperatura: { type: "string", enum: ["quente", "morno", "frio"] },
    urgencia: { type: "string", enum: ["alta", "media", "baixa"] },
    objecao_principal: { type: "string" },
    proxima_acao: { type: "string" },
    status_sugerido: { type: "string", enum: [...leadStatusValues] },
    sinais_de_compra: { type: "array", items: { type: "string" }, maxItems: 4 },
    riscos: { type: "array", items: { type: "string" }, maxItems: 4 },
    mensagem_whatsapp: { type: "string" }
  }
} as const;

export const leadAnalysisSchema = z.object({
  resumo: z.string(),
  temperatura: z.enum(["quente", "morno", "frio"]),
  urgencia: z.enum(["alta", "media", "baixa"]),
  objecao_principal: z.string(),
  proxima_acao: z.string(),
  status_sugerido: z.enum(leadStatusValues),
  sinais_de_compra: z.array(z.string()).max(4),
  riscos: z.array(z.string()).max(4),
  mensagem_whatsapp: z.string()
});

export type LeadAnalysisResult = z.infer<typeof leadAnalysisSchema> & {
  source: "openrouter" | "fallback";
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantResponse = {
  answer: string;
  source: "openrouter" | "fallback";
  actions?: import("@/lib/ai-tools").ProposedAction[];
  references?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
};

export type CrmFacts = {
  totalLeads: number;
  activeLeads: number;
  archivedLeads: number;
  pendingTasks: number;
  overdueLeads: number;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type InferenceProfile = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

type OpenRouterTask = "default" | "assistant" | "lead-analysis" | "conversation-analysis";

type LeadAnalysisContext = {
  leadHistory?: HistoryEntry[];
  conversationMessages?: Pick<Message, "direction" | "content" | "timestamp">[];
};

export function hasOpenRouterConfig() {
  const config = getOpenRouterConfig();
  return Boolean(config.apiKey && config.model);
}

export function getOpenRouterConfigForTask(task: OpenRouterTask) {
  const base = getOpenRouterConfig();
  const taskModel =
    task === "assistant"
      ? process.env.OPENROUTER_MODEL_ASSISTANT
      : task === "lead-analysis"
        ? process.env.OPENROUTER_MODEL_LEAD_ANALYSIS
        : task === "conversation-analysis"
          ? process.env.OPENROUTER_MODEL_CONVERSATION_ANALYSIS
          : process.env.OPENROUTER_MODEL;

  return {
    ...base,
    model: (taskModel || base.model).trim(),
  };
}

export function getLeadAnalysisPrompt(lead: Lead, tasks: Task[], context: LeadAnalysisContext = {}) {
  const compactTasks = tasks.filter((task) => !task.done).slice(0, 3);
  const leadHistory = (context.leadHistory ?? lead.history ?? []).slice(-8);
  const conversationMessages = (context.conversationMessages ?? [])
    .filter((message) => message.content.trim())
    .map((message) => {
      const who = message.direction === "inbound" ? "Lead" : "Instituto";
      const timestamp = new Date(message.timestamp).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      return `[${timestamp}] ${who}: ${message.content.slice(0, 220)}`;
    });

  return [
    "Analise o lead abaixo para uma equipe comercial de cursos profissionalizantes nas areas de estetica, saude e beleza.",
    "Seja objetivo, comercial e pratico.",
    "Baseie a leitura no cadastro do lead, nas tarefas, no historico do lead e na conversa do WhatsApp quando ela existir.",
    "A mensagem sugerida para WhatsApp deve servir como follow-up realista, coerente e alinhado ao que o lead acabou de dizer.",
    "Os sinais de compra e os riscos comerciais devem refletir explicitamente o conteudo da conversa, sem genericidade.",
    "Retorne um resumo curto, classificacao de temperatura, urgencia, principal objecao, proxima acao, status sugerido, sinais de compra, riscos e uma mensagem pronta para WhatsApp.",
    "",
    serializeLeadCompact(lead),
    "",
    "Tarefas abertas:",
    compactTasks.length ?compactTasks.map(serializeTask).join("\n") : "- Nenhuma tarefa aberta",
    "",
    "Historico recente do lead:",
    leadHistory.length
      ? leadHistory.map((entry) => `- ${entry.createdAt.slice(0, 10)}: ${entry.action}${entry.note ? ` — ${entry.note}` : ""}`).join("\n")
      : "- Nenhum historico recente registrado",
    "",
    "Conversa do WhatsApp:",
    conversationMessages.length ? conversationMessages.join("\n") : "- Nenhuma conversa registrada",
  ].join("\n");
}

export async function generateLeadAnalysisWithOpenRouter(
  lead: Lead,
  tasks: Task[],
  context: LeadAnalysisContext = {},
) {
  const prompt = [
    getLeadAnalysisPrompt(lead, tasks, context),
    "",
    "Responda apenas com JSON valido.",
    `Use exatamente um destes status em status_sugerido: ${leadStatusValues.join(", ")}.`
  ].join("\n");

  const response = await openRouterChat({
    messages: [{ role: "user", content: prompt }],
    system:
      "Voce e um analista comercial do Base CRM. Responda em portugues do Brasil com um JSON limpo, sem markdown e sem comentarios.",
    profile: structuredAnalysisProfile(),
    task: "lead-analysis",
  });

  const raw = extractJsonBlock(response);
  const parsed = leadAnalysisSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    source: "openrouter" as const
  };
}

export async function generateAssistantReplyWithOpenRouter(
  messages: ChatMessage[],
  crmState: CrmState,
  selectedLeadId?: string | null,
  webResults?: Array<{ title: string; url: string; snippet?: string }>
) {
  const { CRM_TOOLS, executeTool } = await import("@/lib/ai-tools");

  // Use up to 8 messages for better follow-up handling
  const recentMessages = messages.slice(-8);
  const latestUserMessage = [...recentMessages].reverse().find((m) => m.role === "user")?.content ?? "";
  const profile = assistantProfile(latestUserMessage, Boolean(webResults?.length));

  const fullContext = buildFullCrmContext(crmState, selectedLeadId);
  const webContext = webResults?.length ? buildWebContext(webResults) : "";
  const systemPrompt = buildNativeAssistantSystemPrompt(crmState);
  const system = [systemPrompt, fullContext, webContext].filter(Boolean).join("\n\n");

  // Level 2+3: agentic loop — LLM calls tools and proposes actions (max 4 iterations)
  const loopMessages: Array<Record<string, unknown>> = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalAnswer = "";
  const collectedActions: import("@/lib/ai-tools").ProposedAction[] = [];
  const MAX_ITERATIONS = 4;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const raw = await openRouterChatWithTools({
      system,
      messages: loopMessages,
      tools: CRM_TOOLS as unknown as object[],
      profile,
      task: "assistant",
    });

    // If LLM returned tool calls, execute them and loop
    if (raw.tool_calls && raw.tool_calls.length > 0) {
      loopMessages.push({ role: "assistant", content: raw.content ?? "", tool_calls: raw.tool_calls });

      for (const tc of raw.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { args = {}; }
        // Pass collectedActions so propor_acao can store proposals
        const result = executeTool(tc.function?.name || "", args, crmState, collectedActions);
        loopMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    finalAnswer = (typeof raw.content === "string" ? raw.content : "").trim();
    break;
  }

  return {
    answer: finalAnswer || "Nao encontrei uma resposta final para esta pergunta.",
    source: "openrouter" as const,
    actions: collectedActions.length > 0 ? collectedActions : undefined,
    references: webResults?.length
      ? webResults.map(({ title, url, snippet }) => ({ title, url, snippet }))
      : undefined,
  };
}

export function fallbackLeadAnalysis(
  lead: Lead,
  tasks: Task[],
  context: LeadAnalysisContext = {},
): LeadAnalysisResult {
  const activeTasks = tasks.filter((task) => !task.done);
  const overdue = Boolean(lead.proximo_contato && isOverdue(lead.proximo_contato));
  const entryAge = diffDays(lead.data_entrada);
  const conversationMessages = (context.conversationMessages ?? []).filter((message) => message.content.trim());
  const lowerConversation = conversationMessages.map((message) => message.content.toLowerCase()).join("\n");
  const lastInbound = [...conversationMessages].reverse().find((message) => message.direction === "inbound") ?? null;
  const leadHistory = (context.leadHistory ?? lead.history ?? []).slice(-8);

  let temperatura: LeadAnalysisResult["temperatura"] = "morno";
  let urgencia: LeadAnalysisResult["urgencia"] = overdue ? "alta" : "media";
  let statusSugerido: FunnelStatus = lead.status_funil;

  if (["Aguardando Pagamento", "Negociação / Matrícula"].includes(lead.status_funil)) {
    temperatura = "quente";
    urgencia = overdue ? "alta" : "media";
  } else if (["Matriculado", "Perdido"].includes(lead.status_funil)) {
    temperatura = lead.status_funil === "Matriculado" ? "quente" : "frio";
    urgencia = "baixa";
  } else if (overdue || entryAge > 10) {
    temperatura = "frio";
  }

  if (/quero|tenho interesse|podemos fechar|como faço minha matricula|como faço minha matrícula|link de pagamento|pix/i.test(lowerConversation)) {
    temperatura = "quente";
    urgencia = overdue ? "alta" : "media";
    if (["Novo Lead", "Primeiro Contato Feito", "Interessado no Curso", "Informações Enviadas", "Aguardando Retorno"].includes(statusSugerido)) {
      statusSugerido = "Negociação / Matrícula";
    }
  } else if (/depois vejo|vou pensar|sem dinheiro|caro|agora nao|agora não/i.test(lowerConversation)) {
    temperatura = temperatura === "quente" ? "morno" : "frio";
  }

  if (lead.status_funil === "Novo Lead") {
    statusSugerido = "Primeiro Contato Feito";
  } else if (lead.status_funil === "Informações Enviadas" && overdue) {
    statusSugerido = "Aguardando Retorno";
  } else if (lead.status_funil === "Aguardando Retorno" && overdue) {
    statusSugerido = "Negociação / Matrícula";
  }

  const objecao = lead.objecao_principal.trim() || inferLeadObjectionFromContext(lead, lowerConversation);
  const sinais = inferBuyingSignalsFromContext(lead, activeTasks, lowerConversation, leadHistory);
  const riscos = inferLeadRisksFromContext(lead, activeTasks, overdue, lowerConversation);
  const proximaAcao = inferNextActionFromContext(lead, activeTasks, overdue, lowerConversation, lastInbound?.content || "");
  const resumo = [
    `${lead.nome} entrou via ${lead.origem} com interesse em ${lead.curso_de_interesse}.`,
    `Hoje esta em ${lead.status_funil} e ${lead.status_matricula}.`,
    lastInbound
      ? `Na conversa recente, o lead sinalizou: "${lastInbound.content.slice(0, 120)}".`
      : overdue
        ? "Existe retorno atrasado e vale retomar rapido."
        : "O atendimento segue dentro do ritmo esperado."
  ].join(" ");

  return {
    resumo,
    temperatura,
    urgencia,
    objecao_principal: objecao,
    proxima_acao: proximaAcao,
    status_sugerido: normalizeLeadStatus(statusSugerido),
    sinais_de_compra: sinais,
    riscos,
    mensagem_whatsapp: buildWhatsappDraftFromContext(lead, proximaAcao, lastInbound?.content || ""),
    source: "fallback"
  };
}

export function buildAssistantFallback(
  messages: ChatMessage[],
  crmState: CrmState,
  selectedLeadId?: string | null,
  crmFacts?: CrmFacts,
): AssistantResponse {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const normalized = normalizeText(lastUserMessage);

  if (!lastUserMessage.trim()) {
    return {
      answer: "Posso te ajudar com duvidas sobre leads, tarefas, cursos, origem, conversao ou sobre um lead especifico.",
      source: "fallback"
    };
  }

  const factualCrmAnswer = buildFactualCrmAnswer(normalized, crmFacts);
  if (factualCrmAnswer) {
    return {
      answer: factualCrmAnswer,
      source: "fallback",
    };
  }

  const matchedLead = findBestLeadMatch(lastUserMessage, crmState, selectedLeadId);
  if (matchedLead) {
    return {
      answer: renderLeadSnapshot(matchedLead.lead, matchedLead.tasks),
      source: "fallback"
    };
  }

  if (normalized.includes("negociac") || normalized.includes("pagamento")) {
    const negotiationLeads = crmState.leads
      .filter((lead) => ["Negociação / Matrícula", "Aguardando Pagamento"].includes(lead.status_funil))
      .slice(0, 6);

    if (!negotiationLeads.length) {
      return { answer: "No recorte atual eu nao encontrei leads em negociacao ou aguardando pagamento.", source: "fallback" };
    }

    return {
      answer: `Os leads nessas etapas agora sao:\n${negotiationLeads
        .map(
          (lead) =>
            `- ${lead.nome}: ${lead.status_funil}, curso ${lead.curso_de_interesse}, responsavel ${lead.responsavel}`
        )
        .join("\n")}`,
      source: "fallback"
    };
  }

  if (normalized.includes("atras") || normalized.includes("overdue") || normalized.includes("retorno")) {
    const overdueLeads = listOverdueFollowups(crmState, 6);
    if (!overdueLeads.length) {
      return { answer: "No recorte atual eu nao encontrei leads com retorno atrasado.", source: "fallback" };
    }
    return {
      answer: `Os retornos mais atrasados agora sao:\n${overdueLeads
        .map((lead) => `- ${lead.nome}: ${lead.curso_de_interesse}, responsavel ${lead.responsavel}, proximo contato ${lead.proximo_contato || "sem data"}`)
        .join("\n")}`,
      source: "fallback"
    };
  }

  if (normalized.includes("origem") || normalized.includes("canal")) {
    const breakdown = breakdownBy(crmState.leads, "origem");
    return {
      answer: `Distribuicao atual por origem:\n${breakdown.map(([name, count]) => `- ${name}: ${count} lead(s)`).join("\n")}`,
      source: "fallback"
    };
  }

  if (normalized.includes("curso")) {
    const breakdown = breakdownBy(crmState.leads, "curso_de_interesse");
    return {
      answer: `Cursos com mais interesse agora:\n${breakdown.map(([name, count]) => `- ${name}: ${count} lead(s)`).join("\n")}`,
      source: "fallback"
    };
  }

  if (normalized.includes("tarefa") || normalized.includes("follow")) {
    const tasks = crmState.tasks.filter((task) => !task.done);
    const overdueTasks = tasks.filter((task) => isOverdue(task.dueDate));
    return {
      answer: `Hoje temos ${tasks.length} tarefa(s) pendente(s), sendo ${overdueTasks.length} atrasada(s).\n${tasks
        .slice(0, 6)
        .map((task) => `- ${task.title} (${task.owner}) - ${task.dueDate}`)
        .join("\n")}`,
      source: "fallback"
    };
  }

  return {
    answer: "Entendi. Posso te ajudar com uma resposta direta, um texto pronto, uma comparacao, um plano curto ou uma leitura do CRM. Se quiser algo atual da web, tambem posso usar esse caminho quando voce pedir.",
    source: "fallback"
  };
}

export function buildAssistantInstantReply(messages: ChatMessage[]): AssistantResponse | null {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const normalized = normalizeText(lastUserMessage);

  if (!normalized) return null;

  if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|hey|opa)\b/.test(normalized)) {
    return {
      answer: "Oi! Estou por aqui. Posso te ajudar tanto com dúvidas rápidas quanto com leituras do CRM, leads, tarefas e conversas.",
      source: "fallback"
    };
  }

  if (/^(obrigado|obrigada|valeu|show|perfeito|beleza|entendi)\b/.test(normalized)) {
    return {
      answer: "Fechado. Quando quiser, posso continuar a conversa ou puxar algo específico do CRM para você.",
      source: "fallback"
    };
  }

  return null;
}

export function shouldPreferCrmFallback(latestUserMessage: string) {
  const normalized = normalizeText(latestUserMessage);
  // Only route to deterministic fallback for very simple aggregation queries
  // that need exact counts. Everything else (suggestions, analysis, context)
  // goes to OpenRouter so the LLM can reason properly.
  const isVeryShort = normalized.trim().split(/\s+/).length <= 4;
  const isSimpleCount = /^(quantos|quantas)\b.{0,40}$/.test(normalized);
  const isSimpleList = /^(liste|quais sao|quais são)\b.{0,30}$/.test(normalized);
  return isVeryShort && (isSimpleCount || isSimpleList);
}

export function shouldUseWebSearch(latestUserMessage: string) {
  const normalized = normalizeText(latestUserMessage);
  const explicitSearch =
    /\b(busque|pesquise|pesquisar|procure|google|na web|na internet|site|sites|noticia|noticias|fonte|fontes|referencia|referencias)\b/.test(
      normalized
    ) || /\b(web|internet)\b/.test(normalized);
  const freshnessIntent =
    /\b(atualizado|atualizada|hoje|ultimas|ultimos|latest|tendencia|tendencias|mercado|concorrente|concorrencia)\b/.test(
      normalized
    );
  return explicitSearch || (freshnessIntent && /\b(pesquise|busque|procure|mostre|traga|veja)\b/.test(normalized));
}

export async function searchWeb(query: string) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Busca web respondeu com status ${response.status}.`);
  }

  const html = await response.text();
  const blocks = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1200}?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];
  const results = blocks
    .map((match) => ({
      url: decodeDuckDuckGoUrl(decodeHtml(match[1] || "").trim()),
      title: decodeHtml(stripHtml(match[2] || "").trim()),
      snippet: decodeHtml(stripHtml(match[3] || "").trim()),
    }))
    .filter((item) => item.url.startsWith("http"))
    .slice(0, 8);

  return dedupeWebResults(results);
}

export function buildAssistantSystemPrompt() {
  return buildNativeAssistantSystemPrompt();
}

export function buildNativeAssistantSystemPrompt(crmState?: CrmState): string {
  const today = currentDate(0);

  const funnelDesc = [
    "NOVO_LEAD / Novo Lead: lead acabou de entrar, ainda sem contato.",
    "PRIMEIRO_CONTATO_FEITO / Primeiro Contato Feito: ja foi abordado pela equipe.",
    "INTERESSADO_NO_CURSO / Interessado no Curso: demonstrou interesse real.",
    "INFORMACOES_ENVIADAS / Informacoes Enviadas: recebeu material ou proposta.",
    "AGUARDANDO_RETORNO / Aguardando Retorno: esperando resposta do lead.",
    "NEGOCIACAO_MATRICULA / Negociacao / Matricula: em processo de fechamento.",
    "AGUARDANDO_PAGAMENTO / Aguardando Pagamento: proposta aceita, pagamento pendente.",
    "MATRICULADO / Matriculado: convertido com sucesso.",
    "PERDIDO / Perdido: nao converteu.",
    "REATIVAR_FUTURAMENTE / Reativar Futuramente: potencial futuro, pausado agora.",
  ].join(" | ");

  const courses = crmState
    ? [...new Set(crmState.leads.map((l) => l.curso_de_interesse).filter(Boolean))].sort().join(", ")
    : "Estetica, Saude, Beleza e cursos profissionalizantes da area";

  const owners = crmState
    ? [...new Set(crmState.leads.map((l) => l.responsavel).filter(Boolean))].sort().join(", ")
    : "equipe comercial";

  return `Voce e o Assistente Comercial nativo do Base CRM, integrado diretamente ao sistema de gestao do Base CRM.

SOBRE O INSTITUTO BELART:
O Base CRM e uma escola profissionalizante em Porto Alegre, RS, especializada em cursos nas areas de estetica, saude e beleza. Atende alunos em busca de formacao e especializacao profissional. Cursos presentes no CRM: ${courses}.

SOBRE O CRM:
Voce tem acesso completo e em tempo real a todos os dados do Base CRM atraves de ferramentas (tools). O CRM gerencia: leads (potenciais alunos), tarefas de acompanhamento, funil de vendas, historico de interacoes e campanhas. Voce NAO e um chatbot externo — voce FAZ PARTE do CRM.

FUNIL DE VENDAS (etapas em ordem):
${funnelDesc}

RESPONSAVEIS PELA EQUIPE COMERCIAL:
${owners}

DATA DE HOJE: ${today}

FERRAMENTAS DISPONIVEIS:
- buscar_leads: filtra leads por nome, curso, status, responsavel, origem, atraso
- detalhar_lead: ficha completa de um lead com historico e tarefas
- listar_tarefas: lista tarefas por responsavel, vencimento ou lead
- estatisticas_crm: metricas de funil, curso, origem, responsavel, conversao
- leads_prioritarios: leads que precisam de atencao imediata
- rascunhar_mensagem: contexto para criar mensagem WhatsApp personalizada

COMO VOCE DEVE SE COMPORTAR:
1. USE AS FERRAMENTAS para buscar dados precisos antes de responder sobre leads, tarefas ou estatisticas.
2. Nunca diga que nao tem acesso — voce tem. Use as ferramentas.
3. Para perguntas de acompanhamento, use o historico da conversa e chame as ferramentas se precisar de mais detalhes.
4. Seja comercialmente pratico: sugestoes de abordagem, textos para WhatsApp, proximas acoes, priorizacoes.
5. Responda em portugues do Brasil, de forma conversacional, adaptavel ao contexto e sem parecer um menu de respostas prontas.
6. Quando o usuario escrever uma mensagem curta, ainda assim responda como um assistente completo, contextualizado e natural.
7. Organize respostas com listas quando houver multiplos itens, mas use texto corrido quando a conversa pedir fluidez.
8. Nunca invente dados. Se algo nao existir no CRM, diga claramente.
9. Sempre que o usuario pedir ajuda comercial, considere objetivo, risco, proximo passo e, quando fizer sentido, sugira mensagem pronta.
10. Voce pode ajudar com qualquer tarefa comercial: textos, estrategias, analises, scripts de vendas e leitura operacional do CRM.`;
}

export function normalizeLeadStatus(status: FunnelStatus) {
  const index = funnelStatuses.indexOf(status);
  return leadStatusValues[index];
}

export function denormalizeLeadStatus(status: string): FunnelStatus {
  const index = leadStatusValues.indexOf(status);
  return funnelStatuses[index] ?? "Aguardando Retorno";
}

async function openRouterChat({
  messages,
  system,
  schema,
  profile,
  task = "default"
}: {
  messages: ChatMessage[];
  system?: string;
  schema?: object;
  profile?: InferenceProfile;
  task?: OpenRouterTask;
}) {
  const { baseUrl, apiKey, model, siteUrl, appName } = getOpenRouterConfigForTask(task);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
      ...(appName ? { "X-Title": appName } : {}),
    },
    signal: AbortSignal.timeout(profile?.timeoutMs ?? (schema ? 15_000 : 12_000)),
    body: JSON.stringify({
      model,
      stream: false,
      temperature: profile?.temperature ?? 0.2,
      max_tokens: profile?.maxTokens ?? (schema ? 320 : 420),
      ...(schema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "belart_schema",
                strict: true,
                schema,
              },
            },
          }
        : {}),
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter respondeu com status ${response.status}. ${body}`.trim());
  }

  const data = (await response.json()) as OpenRouterChatResponse;
  return (data.choices?.[0]?.message?.content || "").trim();
}

type OpenRouterMessageRaw = Record<string, unknown>;

type OpenRouterToolResponse = {
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

async function openRouterChatWithTools({
  messages,
  system,
  tools,
  profile,
  task = "assistant",
}: {
  messages: OpenRouterMessageRaw[];
  system?: string;
  tools: object[];
  profile?: InferenceProfile;
  task?: OpenRouterTask;
}): Promise<OpenRouterToolResponse> {
  const { baseUrl, apiKey, model, siteUrl, appName } = getOpenRouterConfigForTask(task);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
      ...(appName ? { "X-Title": appName } : {}),
    },
    signal: AbortSignal.timeout(profile?.timeoutMs ?? 45_000),
    body: JSON.stringify({
      model,
      stream: false,
      temperature: profile?.temperature ?? 0.2,
      max_tokens: profile?.maxTokens ?? 600,
      tools,
      tool_choice: "auto",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter respondeu com status ${response.status}. ${body}`.trim());
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: OpenRouterToolResponse["tool_calls"];
      };
    }>;
  };

  const message = data.choices?.[0]?.message;
  return {
    content: message?.content ?? null,
    tool_calls: message?.tool_calls,
  };
}

function getOpenRouterConfig() {
  return {
    baseUrl: (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
    apiKey: (process.env.OPENROUTER_API_KEY || "").trim(),
    model: (process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini").trim(),
    siteUrl: (process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "").trim(),
    appName: (process.env.OPENROUTER_APP_NAME || "Base CRM").trim()
  };
}

function structuredAnalysisProfile(): InferenceProfile {
  return {
    temperature: 0.1,
    maxTokens: 220,
    timeoutMs: 20_000
  };
}

function assistantProfile(latestUserMessage: string, hasWebContext = false): InferenceProfile {
  const normalized = normalizeText(latestUserMessage);
  const strategic =
    normalized.length > 140 ||
    /\b(estrateg|planej|compar|analise|analisa|por que|porque|como melhorar|melhor abordagem|recomenda|sugere|campanha|posicionamento|funil|diagnostico|diagnostico)\b/.test(normalized);

  return {
    temperature: strategic ? 0.3 : 0.2,
    maxTokens: strategic ? 600 : 400,
    timeoutMs: hasWebContext ? 60_000 : 45_000
  };
}

function buildAssistantContext(crmState: CrmState, latestUserMessage: string, selectedLeadId?: string | null) {
  const overview = getOverviewMetrics(crmState);
  const normalizedQuery = normalizeText(latestUserMessage);
  const selectedLead = selectedLeadId ?crmState.leads.find((lead) => lead.id === selectedLeadId) : null;
  const selectedTasks = selectedLead ?crmState.tasks.filter((task) => task.leadId === selectedLead.id) : [];
  const pendingTasks = crmState.tasks.filter((task) => !task.done).slice(0, 3);
  const overdueLeads = crmState.leads
    .filter((lead) => !closingStatuses.includes(lead.status_funil) && isOverdue(lead.proximo_contato))
    .slice(0, 3);
  const courseBreakdown = breakdownBy(crmState.leads, "curso_de_interesse").slice(0, 3);
  const originBreakdown = breakdownBy(crmState.leads, "origem").slice(0, 3);
  const matchedLead = findBestLeadMatch(latestUserMessage, crmState, selectedLeadId);
  const negotiationLeads = crmState.leads
    .filter((lead) => ["Negociação / Matrícula", "Aguardando Pagamento"].includes(lead.status_funil))
    .slice(0, 5);

  const asksForCrmContext =
    Boolean(selectedLead) ||
    Boolean(matchedLead) ||
    /\b(lead|crm|curso|origem|canal|funil|tarefa|follow|retorno|atras|priori|responsavel|matricula|negociac|pagamento|aluno|arquivado|sugere|sugestao|recomenda|massoterapia|estetica|saude|beleza)\b/.test(normalizedQuery);

  // Always include base overview as anchor for the LLM
  const contextBlocks = [
    "Contexto objetivo do CRM do Base CRM (cursos de estetica, saude e beleza).",
    `Resumo: ${overview.totalLeads} leads no total, ${overview.activeLeads} ativos, ${overview.overdueLeads} com retorno atrasado, ${overview.pendingTasks} tarefas pendentes.`,
  ];

  if (!asksForCrmContext) {
    return contextBlocks.join("\n");
  }

  if (/\b(resumo|panorama|visao geral|visao do crm|cenario|cenario atual|indicador|indicadores)\b/.test(normalizedQuery)) {
    contextBlocks.push(
      `Top origens: ${overview.topOrigins.map(([n, c]) => `${n} (${c})`).join(", ")}.`,
      `Top cursos: ${overview.topCourses.map(([n, c]) => `${n} (${c})`).join(", ")}.`
    );
  }

  if (selectedLead) {
    contextBlocks.push("", "Lead em foco no momento:", renderLeadSnapshot(selectedLead, selectedTasks));
  } else if (matchedLead) {
    contextBlocks.push("", "Lead citado na pergunta:", renderLeadSnapshot(matchedLead.lead, matchedLead.tasks));
  }

  if (normalizedQuery.includes("atras") || normalizedQuery.includes("retorno")) {
    contextBlocks.push(
      "",
      "Leads com retorno atrasado:",
      overdueLeads.length
        ? overdueLeads
            .map((lead) => `- ${lead.nome} | curso ${lead.curso_de_interesse} | responsavel ${lead.responsavel} | proximo contato ${lead.proximo_contato || "sem data"}`)
            .join("\n")
        : "- Nenhum lead atrasado no momento."
    );
  }

  if (normalizedQuery.includes("origem") || normalizedQuery.includes("canal")) {
    contextBlocks.push(
      "",
      "Distribuicao por origem:",
      originBreakdown.map(([name, count]) => `- ${name}: ${count}`).join("\n")
    );
  }

  if (normalizedQuery.includes("curso") || normalizedQuery.includes("massoterapia") || normalizedQuery.includes("estetica") || normalizedQuery.includes("saude")) {
    const allCourses = breakdownBy(crmState.leads, "curso_de_interesse");
    contextBlocks.push(
      "",
      "Todos os cursos com leads cadastrados:",
      allCourses.length
        ? allCourses.map(([name, count]) => `- ${name}: ${count} lead(s)`).join("\n")
        : "- Nenhum curso cadastrado."
    );
  }

  if (normalizedQuery.includes("arquivado") || normalizedQuery.includes("arquivados")) {
    const archived = crmState.leads.filter((lead) => closingStatuses.includes(lead.status_funil));
    contextBlocks.push(
      "",
      `Leads em status de fechamento (${archived.length}):`,
      archived.length
        ? archived.slice(0, 8).map((lead) => `- ${lead.nome} | ${lead.status_funil} | ${lead.curso_de_interesse}`).join("\n")
        : "- Nenhum lead arquivado."
    );
  }

  if (normalizedQuery.includes("tarefa") || normalizedQuery.includes("follow")) {
    contextBlocks.push(
      "",
      "Tarefas pendentes mais proximas:",
      pendingTasks.length
        ? pendingTasks.map((task) => `- ${task.title} | ${task.owner} | ${task.dueDate}`).join("\n")
        : "- Nenhuma tarefa pendente."
    );
  }

  if (normalizedQuery.includes("negociac") || normalizedQuery.includes("pagamento")) {
    contextBlocks.push(
      "",
      "Leads em negociacao ou aguardando pagamento:",
      negotiationLeads.length
        ? negotiationLeads
            .map(
              (lead) =>
                `- ${lead.nome} | ${lead.status_funil} | curso ${lead.curso_de_interesse} | responsavel ${lead.responsavel}`
            )
            .join("\n")
        : "- Nenhum lead nessas etapas no momento."
    );
  }

  return contextBlocks.join("\n");
}

export function buildFullCrmContext(crmState: CrmState, selectedLeadId?: string | null): string {
  const today = currentDate(0);
  const activeLeads = crmState.leads.filter((l) => !closingStatuses.includes(l.status_funil));
  const overdueLeads = activeLeads
    .filter((l) => isOverdue(l.proximo_contato))
    .sort((a, b) => (a.proximo_contato || "9999").localeCompare(b.proximo_contato || "9999"));
  const pendingTasks = crmState.tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const negotiationLeads = activeLeads.filter((l) =>
    ["Negociação / Matrícula", "Aguardando Pagamento"].includes(l.status_funil)
  );
  const newLeads = activeLeads.filter((l) =>
    ["Novo Lead", "Primeiro Contato Feito"].includes(l.status_funil)
  ).slice(0, 10);
  const closingLeads = crmState.leads.filter((l) => closingStatuses.includes(l.status_funil));

  const courseBreakdown = breakdownBy(crmState.leads, "curso_de_interesse");
  const originBreakdown = breakdownBy(crmState.leads, "origem");
  const funnelBreakdown = breakdownBy(activeLeads, "status_funil");
  const ownerBreakdown = breakdownBy(activeLeads, "responsavel");

  const sections: string[] = [];

  // --- Métricas gerais ---
  sections.push(
    `=== ESTADO ATUAL DO CRM (${today}) ===`,
    `Leads: ${crmState.leads.length} total | ${activeLeads.length} ativos | ${closingLeads.length} fechados (matriculados/perdidos)`,
    `Tarefas: ${pendingTasks.length} pendentes | ${pendingTasks.filter((t) => isOverdue(t.dueDate)).length} atrasadas`,
    `Atencao: ${overdueLeads.length} leads com retorno atrasado | ${negotiationLeads.length} em negociacao/pagamento`,
  );

  // --- Breakdown por funil ---
  if (funnelBreakdown.length) {
    sections.push(
      "",
      "DISTRIBUICAO NO FUNIL:",
      funnelBreakdown.map(([stage, count]) => `  ${stage}: ${count}`).join("\n"),
    );
  }

  // --- Breakdown por curso ---
  if (courseBreakdown.length) {
    sections.push(
      "",
      "CURSOS COM INTERESSE:",
      courseBreakdown.map(([course, count]) => `  ${course}: ${count} lead(s)`).join("\n"),
    );
  }

  // --- Breakdown por origem ---
  if (originBreakdown.length) {
    sections.push(
      "",
      "ORIGENS DOS LEADS:",
      originBreakdown.map(([origin, count]) => `  ${origin}: ${count}`).join("\n"),
    );
  }

  // --- Responsáveis ---
  if (ownerBreakdown.length) {
    sections.push(
      "",
      "LEADS POR RESPONSAVEL:",
      ownerBreakdown.map(([owner, count]) => `  ${owner}: ${count} leads ativos`).join("\n"),
    );
  }

  // --- Leads com retorno atrasado (todos) ---
  if (overdueLeads.length) {
    sections.push(
      "",
      `LEADS COM RETORNO ATRASADO (${overdueLeads.length}):`,
      overdueLeads
        .map((l) => `  - ${l.nome} | ${l.curso_de_interesse} | ${l.status_funil} | resp: ${l.responsavel} | contato previsto: ${l.proximo_contato || "sem data"}`)
        .join("\n"),
    );
  }

  // --- Leads em negociação/pagamento ---
  if (negotiationLeads.length) {
    sections.push(
      "",
      `LEADS EM NEGOCIACAO OU AGUARDANDO PAGAMENTO (${negotiationLeads.length}):`,
      negotiationLeads
        .map((l) => `  - ${l.nome} | ${l.curso_de_interesse} | ${l.status_funil} | resp: ${l.responsavel} | proximo contato: ${l.proximo_contato || "sem data"}`)
        .join("\n"),
    );
  }

  // --- Novos leads sem contato ---
  if (newLeads.length) {
    sections.push(
      "",
      `NOVOS LEADS SEM CONTATO OU NO PRIMEIRO CONTATO (${newLeads.length}):`,
      newLeads
        .map((l) => `  - ${l.nome} | ${l.curso_de_interesse} | entrou em: ${l.data_entrada} | resp: ${l.responsavel}`)
        .join("\n"),
    );
  }

  // --- Tarefas pendentes (todas) ---
  if (pendingTasks.length) {
    sections.push(
      "",
      `TAREFAS PENDENTES (${pendingTasks.length}):`,
      pendingTasks
        .slice(0, 20)
        .map((t) => {
          const lead = crmState.leads.find((l) => l.id === t.leadId);
          const overdue = isOverdue(t.dueDate) ? " [ATRASADA]" : "";
          return `  - ${t.title}${overdue} | resp: ${t.owner} | vence: ${t.dueDate} | lead: ${lead?.nome || "desconhecido"}`;
        })
        .join("\n"),
    );
  }

  // --- Lead selecionado (foco atual) ---
  const selectedLead = selectedLeadId
    ? crmState.leads.find((l) => l.id === selectedLeadId)
    : null;
  if (selectedLead) {
    const leadTasks = crmState.tasks.filter((t) => t.leadId === selectedLead.id && !t.done);
    const leadHistory = selectedLead.history?.slice(-5) ?? [];
    sections.push(
      "",
      "=== LEAD EM FOCO AGORA ===",
      `Nome: ${selectedLead.nome}`,
      `Telefone: ${selectedLead.telefone}`,
      `Curso: ${selectedLead.curso_de_interesse}`,
      `Origem: ${selectedLead.origem}`,
      `Status no funil: ${selectedLead.status_funil}`,
      `Status matricula: ${selectedLead.status_matricula}`,
      `Responsavel: ${selectedLead.responsavel}`,
      `Proximo contato: ${selectedLead.proximo_contato || "sem data"}`,
      `Data de entrada: ${selectedLead.data_entrada}`,
      `Objecao principal: ${selectedLead.objecao_principal || "nao registrada"}`,
      `Observacoes: ${selectedLead.observacoes || "nenhuma"}`,
      leadTasks.length
        ? `Tarefas abertas:\n${leadTasks.map((t) => `  - ${t.title} | vence: ${t.dueDate}`).join("\n")}`
        : "Sem tarefas abertas.",
      leadHistory.length
        ? `Ultimas interacoes:\n${leadHistory.map((h) => `  - ${h.createdAt?.slice(0, 10) || ""}: ${h.action}${h.note ? ` — ${h.note}` : ""}`).join("\n")}`
        : "",
    );
  }

  return sections.filter(Boolean).join("\n");
}

function buildWebContext(results: Array<{ title: string; url: string; snippet?: string }>) {
  return [
    "Contexto adicional de busca web solicitado pelo usuario.",
    "Use as referencias abaixo apenas como apoio para responder a pergunta atual de forma objetiva.",
    ...results
      .slice(0, 2)
      .map(
        (result, index) =>
          `${index + 1}. ${truncateText(result.title, 100)}\nURL: ${result.url}\nResumo: ${truncateText(result.snippet || "sem resumo", 140)}`
      )
  ].join("\n\n");
}

function extractJsonBlock(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new Error("Resposta JSON nao encontrada.");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function decodeDuckDuckGoUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, "https://duckduckgo.com");
    const uddg = parsed.searchParams.get("uddg");
    return uddg ?decodeURIComponent(uddg) : parsed.toString();
  } catch {
    return rawUrl;
  }
}

function dedupeWebResults(results: Array<{ title: string; url: string; snippet?: string }>) {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (!isUsefulWebResult(result)) return false;
    const key = result.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(result.title && result.url);
  });
}

function isUsefulWebResult(result: { title: string; url: string; snippet?: string }) {
  const url = result.url.toLowerCase();
  const title = normalizeText(result.title);
  const snippet = normalizeText(result.snippet || "");
  const joined = `${title} ${snippet}`;

  if (url.includes("duckduckgo.com/y.js") || url.includes("bing.com/aclick")) return false;
  if (joined.includes("viewing ads is privacy protected")) return false;
  if (joined.includes("ad clicks are managed")) return false;
  if (title === "ad" || title.startsWith("ad ")) return false;
  if (joined.includes("shop thousands of high-quality on-demand online courses")) return false;
  if (title.length < 8) return false;
  return true;
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function inferLeadObjection(lead: Lead) {
  if (lead.status_funil === "Aguardando Pagamento") return "Ainda nao concluiu o pagamento.";
  if (lead.status_funil === "Negociação / Matrícula") return "Precisa de ajuda para fechar a condicao comercial.";
  if (lead.status_funil === "Aguardando Retorno") return "Parou de responder e precisa de retomada.";
  return "Ainda nao existe uma objecao principal claramente registrada.";
}

function inferNextAction(lead: Lead, tasks: Task[], overdue: boolean) {
  const firstPendingTask = tasks.find((task) => !task.done);
  if (firstPendingTask) return `${firstPendingTask.title} ate ${firstPendingTask.dueDate}.`;
  if (lead.status_funil === "Novo Lead") return "Fazer o primeiro contato e validar interesse real na turma mais proxima.";
  if (lead.status_funil === "Aguardando Pagamento") return "Confirmar forma de pagamento e enviar o link ou chave de cobranca.";
  if (overdue) return "Retomar contato hoje com mensagem curta e CTA de resposta rapida.";
  return "Manter acompanhamento do lead e registrar a proxima etapa no historico.";
}

function inferBuyingSignals(lead: Lead, tasks: Task[]) {
  const signals: string[] = [];
  if (["Negociação / Matrícula", "Aguardando Pagamento", "Matriculado"].includes(lead.status_funil)) {
    signals.push("Ja avancou para etapa de decisao ou fechamento.");
  }
  if (lead.objecao_principal.trim()) {
    signals.push("Trouxe uma objecao concreta, indicando interesse real.");
  }
  if (tasks.some((task) => !task.done)) {
    signals.push("Existe follow-up ativo no pipeline.");
  }
  if (!signals.length) {
    signals.push("Entrou no CRM com curso de interesse definido.");
  }
  return signals.slice(0, 4);
}

function inferLeadRisks(lead: Lead, tasks: Task[], overdue: boolean) {
  const risks: string[] = [];
  if (overdue) risks.push("Retorno em atraso pode esfriar o interesse.");
  if (!tasks.some((task) => !task.done) && !closingStatuses.includes(lead.status_funil)) {
    risks.push("Nao existe tarefa ativa registrada para o lead.");
  }
  if (lead.status_funil === "Perdido") risks.push("Lead marcado como perdido e exige motivo bem documentado.");
  if (!lead.objecao_principal.trim()) risks.push("Objeção principal ainda nao esta clara.");
  return risks.slice(0, 4);
}

function buildWhatsappDraft(lead: Lead, nextAction: string) {
  return `Ola, ${lead.nome}! Aqui e do Base CRM. Vi seu interesse em ${lead.curso_de_interesse} e queria te ajudar a avancar. ${nextAction} Se fizer sentido, me responde aqui e eu ja te passo o melhor caminho.`;
}

function inferLeadObjectionFromContext(lead: Lead, conversationText = "") {
  if (/parcel|desconto|valor|preco|preço|investimento|orcamento|orçamento/.test(conversationText)) {
    return "Preco / condicao de pagamento.";
  }
  if (/distancia|distância|longe|deslocamento|transporte/.test(conversationText)) {
    return "Distancia / deslocamento.";
  }
  if (/horario|horário|agenda|disponibilidade/.test(conversationText)) {
    return "Horario / disponibilidade.";
  }
  return inferLeadObjection(lead);
}

function inferNextActionFromContext(
  lead: Lead,
  tasks: Task[],
  overdue: boolean,
  conversationText = "",
  lastInboundMessage = "",
) {
  const firstPendingTask = tasks.find((task) => !task.done);
  if (firstPendingTask) return `${firstPendingTask.title} ate ${firstPendingTask.dueDate}.`;
  if (/valor|preco|preço|parcel|desconto|investimento/.test(conversationText)) {
    return "Responder com condicao comercial clara, forma de pagamento e proximo passo para fechamento.";
  }
  if (/horario|horário|turma|datas|data de inicio|data de início/.test(conversationText)) {
    return "Responder com agenda, proximas turmas e CTA para confirmar a melhor opcao.";
  }
  if (/quero|tenho interesse|como faco minha matricula|como faço minha matrícula|link de pagamento/.test(conversationText)) {
    return "Aproveitar o momento de decisao e conduzir o lead para matricula ou pagamento imediatamente.";
  }
  if (lastInboundMessage) return `Responder ao que o lead acabou de dizer e puxar o proximo passo com clareza: "${lastInboundMessage.slice(0, 90)}".`;
  return inferNextAction(lead, tasks, overdue);
}

function inferBuyingSignalsFromContext(
  lead: Lead,
  tasks: Task[],
  conversationText = "",
  leadHistory: HistoryEntry[] = [],
) {
  const signals = inferBuyingSignals(lead, tasks);
  if (/quero|tenho interesse|gostei|quando comeca|quando começa|como faco minha matricula|como faço minha matrícula|link de pagamento|pix|parcel/i.test(conversationText)) {
    signals.unshift("A conversa mostra intencao concreta de avancar.");
  }
  if (/valor|preco|preço|condicao|condicoes|parcelamento|desconto/.test(conversationText)) {
    signals.push("O lead esta discutindo condicoes de compra.");
  }
  if (leadHistory.some((entry) => /matricula|pagamento|proposta|orcamento|orçamento/i.test(`${entry.action} ${entry.note}`))) {
    signals.push("O historico mostra avancos comerciais anteriores.");
  }
  return Array.from(new Set(signals)).slice(0, 4);
}

function inferLeadRisksFromContext(lead: Lead, tasks: Task[], overdue: boolean, conversationText = "") {
  const risks = inferLeadRisks(lead, tasks, overdue);
  if (/depois|vou pensar|mais pra frente|agora nao|agora não|sem dinheiro|caro|longe/.test(conversationText)) {
    risks.unshift("A conversa traz sinais de adiamento ou objecao forte.");
  }
  return Array.from(new Set(risks)).slice(0, 4);
}

function buildWhatsappDraftFromContext(lead: Lead, nextAction: string, lastInboundMessage = "") {
  const bridge = lastInboundMessage
    ? `Vi sua ultima mensagem sobre "${lastInboundMessage.slice(0, 90)}" e queria te ajudar a avancar.`
    : `Vi seu interesse em ${lead.curso_de_interesse} e queria te ajudar a avancar.`;
  return `Ola, ${lead.nome}! Aqui e do Base CRM. ${bridge} ${nextAction} Se fizer sentido, me responde aqui e eu ja te passo o melhor caminho.`;
}

function renderLeadSnapshot(lead: Lead, tasks: Task[]) {
  const pendingTask = tasks.find((task) => !task.done);
  return [
    `${lead.nome} esta em ${lead.status_funil} com matricula ${lead.status_matricula}.`,
    `Curso: ${lead.curso_de_interesse}. Origem: ${lead.origem}. Responsável: ${lead.responsavel}.`,
    `Próximo contato: ${lead.proximo_contato || "nao definido"}.`,
    pendingTask ?`Tarefa mais proxima: ${pendingTask.title} (${pendingTask.dueDate}).` : "Sem tarefa pendente registrada.",
    `Objeção principal: ${lead.objecao_principal || "ainda nao registrada"}.`
  ].join(" ");
}

function getOverviewMetrics(crmState: CrmState) {
  const activeLeads = crmState.leads.filter((lead) => !closingStatuses.includes(lead.status_funil));
  const overdueLeads = activeLeads.filter((lead) => isOverdue(lead.proximo_contato)).length;
  const pendingTasks = crmState.tasks.filter((task) => !task.done).length;
  return {
    totalLeads: crmState.leads.length,
    activeLeads: activeLeads.length,
    overdueLeads,
    pendingTasks,
    topOrigins: breakdownBy(crmState.leads, "origem").slice(0, 3),
    topCourses: breakdownBy(crmState.leads, "curso_de_interesse").slice(0, 3)
  };
}

function buildFactualCrmAnswer(normalizedQuery: string, crmFacts?: CrmFacts) {
  if (!crmFacts) return null;

  const asksTaskCount =
    /\b(quantos|quantas|qtd|quantidade|total|totais)\b/.test(normalizedQuery) &&
    /\b(tarefa|tarefas)\b/.test(normalizedQuery);
  const asksLeadCount =
    /\b(quantos|quantas|qtd|quantidade|total|totais)\b/.test(normalizedQuery) &&
    /\b(lead|leads)\b/.test(normalizedQuery);

  if (!asksLeadCount && !asksTaskCount) return null;

  const asksArchived = /\b(arquivado|arquivados|arquivada|arquivadas)\b/.test(normalizedQuery);
  const asksActive = /\b(ativo|ativos|ativa|ativas)\b/.test(normalizedQuery);
  const asksTasks = /\b(tarefa|tarefas)\b/.test(normalizedQuery);
  const asksOverdue = /\b(atras|atrasado|atrasados|retorno|retornos)\b/.test(normalizedQuery);

  if (asksTaskCount || asksTasks) {
    return `Hoje temos ${crmFacts.pendingTasks} tarefa(s) pendente(s) no CRM.`;
  }

  if (asksOverdue) {
    return `Hoje temos ${crmFacts.overdueLeads} lead(s) com retorno atrasado no CRM.`;
  }

  if (asksArchived) {
    return `Hoje temos ${crmFacts.archivedLeads} lead(s) arquivado(s) no CRM.`;
  }

  if (asksActive) {
    return `Hoje temos ${crmFacts.activeLeads} lead(s) ativo(s) no CRM.`;
  }

  return `Hoje temos ${crmFacts.totalLeads} lead(s) no total no CRM: ${crmFacts.activeLeads} ativo(s) e ${crmFacts.archivedLeads} arquivado(s).`;
}

function searchLeads(
  crmState: CrmState,
  filters: {
    query: string;
    origem?: string;
    curso?: string;
    responsavel?: string;
    status_funil?: string;
    limit: number;
  }
) {
  const query = normalizeText(filters.query);
  return crmState.leads
    .filter((lead) => {
      const haystack = normalizeText(
        [lead.nome, lead.telefone, lead.email, lead.origem, lead.curso_de_interesse, lead.status_funil, lead.responsavel].join(" ")
      );
      const matchesQuery = !query || haystack.includes(query);
      const matchesOrigin = !filters.origem || lead.origem === filters.origem;
      const matchesCourse = !filters.curso || lead.curso_de_interesse === filters.curso;
      const matchesOwner = !filters.responsavel || lead.responsavel === filters.responsavel;
      const matchesStatus = !filters.status_funil || lead.status_funil === filters.status_funil;
      return matchesQuery && matchesOrigin && matchesCourse && matchesOwner && matchesStatus;
    })
    .slice(0, filters.limit)
    .map((lead) => ({
      id: lead.id,
      nome: lead.nome,
      curso_de_interesse: lead.curso_de_interesse,
      origem: lead.origem,
      status_funil: lead.status_funil,
      status_matricula: lead.status_matricula,
      responsavel: lead.responsavel,
      proximo_contato: lead.proximo_contato
    }));
}

function listOverdueFollowups(crmState: CrmState, limit: number) {
  return crmState.leads
    .filter((lead) => !closingStatuses.includes(lead.status_funil) && isOverdue(lead.proximo_contato))
    .sort((a, b) => (a.proximo_contato || "9999-12-31").localeCompare(b.proximo_contato || "9999-12-31"))
    .slice(0, limit)
    .map((lead) => ({
      id: lead.id,
      nome: lead.nome,
      curso_de_interesse: lead.curso_de_interesse,
      responsavel: lead.responsavel,
      status_funil: lead.status_funil,
      proximo_contato: lead.proximo_contato
    }));
}

function getLeadDetails(crmState: CrmState, leadName: string, selectedLeadId?: string | null) {
  const fromSelection = selectedLeadId ?crmState.leads.find((lead) => lead.id === selectedLeadId) : null;
  const lead = leadName.trim() ?findBestLeadMatch(leadName, crmState, selectedLeadId)?.lead : fromSelection;

  if (!lead) {
    return { found: false, message: "Nenhum lead correspondente encontrado." };
  }

  const tasks = crmState.tasks.filter((task) => task.leadId === lead.id);
  return {
    found: true,
    lead: {
      id: lead.id,
      nome: lead.nome,
      curso_de_interesse: lead.curso_de_interesse,
      origem: lead.origem,
      status_funil: lead.status_funil,
      status_matricula: lead.status_matricula,
      responsavel: lead.responsavel,
      proximo_contato: lead.proximo_contato,
      objecao_principal: lead.objecao_principal,
      observacoes: lead.observacoes
    },
    tasks: tasks.map((task) => ({
      title: task.title,
      owner: task.owner,
      dueDate: task.dueDate,
      done: task.done
    })),
    history: lead.history.slice(-4).map((entry) => ({
      action: entry.action,
      note: entry.note,
      createdAt: entry.createdAt
    }))
  };
}

function listPendingTasks(crmState: CrmState, owner?: string, limit = 5) {
  return crmState.tasks
    .filter((task) => !task.done && (!owner || task.owner === owner))
    .slice(0, limit)
    .map((task) => ({
      id: task.id,
      title: task.title,
      owner: task.owner,
      dueDate: task.dueDate,
      overdue: isOverdue(task.dueDate),
      lead: crmState.leads.find((lead) => lead.id === task.leadId)?.nome || "Lead removido"
    }));
}

function findBestLeadMatch(query: string, crmState: CrmState, selectedLeadId?: string | null) {
  const normalizedQuery = normalizeText(query);
  const scopedLeads = selectedLeadId
    ? [
        ...(crmState.leads.find((lead) => lead.id === selectedLeadId)
          ? [crmState.leads.find((lead) => lead.id === selectedLeadId)!] : []),
        ...crmState.leads.filter((lead) => lead.id !== selectedLeadId)
      ]
    : crmState.leads;

  const exactLead = scopedLeads.find((item) => normalizeText(item.nome) === normalizedQuery);
  if (exactLead) {
    return {
      lead: exactLead,
      tasks: crmState.tasks.filter((task) => task.leadId === exactLead.id)
    };
  }

  const queryTokens = meaningfulTokens(normalizedQuery);
  if (!queryTokens.length) return null;

  let bestLead: Lead | null = null;
  let bestScore = 0;
  for (const item of scopedLeads) {
    const nameTokens = meaningfulTokens(normalizeText(item.nome));
    if (!nameTokens.length) continue;

    const overlap = nameTokens.filter((token) => queryTokens.includes(token)).length;
    const exactPhraseBoost = normalizedQuery.includes(normalizeText(item.nome)) ? 2 : 0;
    const score = overlap + exactPhraseBoost;

    if (score > bestScore) {
      bestScore = score;
      bestLead = item;
    }
  }

  const minimumScore = queryTokens.length >= 3 ? 2 : 1;
  const lead = bestScore >= minimumScore ?bestLead : null;

  if (!lead) return null;

  return {
    lead,
    tasks: crmState.tasks.filter((task) => task.leadId === lead.id)
  };
}

function meaningfulTokens(value: string) {
  const stopwords = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "que",
    "qual",
    "quais",
    "esta",
    "esse",
    "essa",
    "como",
    "sobre",
    "lead",
    "cliente",
    "contato",
    "crm",
    "curso",
    "pagamento",
    "negociacao",
    "retorno"
  ]);

  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function breakdownBy<T extends Lead>(items: T[], key: keyof Lead) {
  const grouped = items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] || "Nao informado");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
}

function serializeLead(lead: Lead) {
  return [
    `Lead: ${lead.nome}`,
    `Telefone: ${lead.telefone}`,
    `Curso de interesse: ${lead.curso_de_interesse}`,
    `Origem: ${lead.origem}`,
    `Status do funil: ${lead.status_funil}`,
    `Status da matricula: ${lead.status_matricula}`,
    `Responsável: ${lead.responsavel}`,
    `Data de entrada: ${lead.data_entrada}`,
    `Próximo contato: ${lead.proximo_contato || "sem data"}`,
    `Objeção principal: ${lead.objecao_principal || "sem objecao registrada"}`,
    `Observacoes: ${lead.observacoes || "sem observacoes"}`,
    `Já foi aluno: ${lead.ja_foi_aluno}`,
    `Cidade: ${lead.cidade || "nao informada"}`,
    `Profissao: ${lead.profissao || "nao informada"}`
  ].join("\n");
}

function serializeLeadCompact(lead: Lead) {
  return [
    `Lead: ${lead.nome}`,
    `Curso: ${lead.curso_de_interesse}`,
    `Origem: ${lead.origem}`,
    `Funil: ${lead.status_funil}`,
    `Matricula: ${lead.status_matricula}`,
    `Responsável: ${lead.responsavel}`,
    `Próximo contato: ${lead.proximo_contato || "sem data"}`,
    `Objecao: ${lead.objecao_principal || "nao registrada"}`,
    `Observacoes: ${(lead.observacoes || "sem observacoes").slice(0, 180)}`,
  ].join("\n");
}

function serializeTask(task: Task) {
  return `- ${task.title} | responsavel ${task.owner} | vencimento ${task.dueDate} | ${task.done ? "concluida" : "pendente"}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function diffDays(value: string) {
  if (!value) return 0;
  const start = new Date(`${value}T12:00:00`);
  const end = new Date(`${currentDate(0)}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}
