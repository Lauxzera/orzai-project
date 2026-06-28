/**
 * Base CRM — AI Tool Use (Level 2 + Level 3)
 *
 * Level 2: Tools for querying CRM data in real time.
 * Level 3: propor_acao tool — LLM proposes CRM actions for user approval.
 *          Actions are NEVER executed automatically. User must confirm.
 */

import {
  closingStatuses,
  currentDate,
  isOverdue,
  type CrmState,
  type Lead,
  type Task,
} from "@/lib/crm";

// ---------------------------------------------------------------------------
// Proposed action type — returned to frontend for user confirmation (Level 3)
// ---------------------------------------------------------------------------

export type ProposedAction = {
  id: string;
  tipo: "changeLeadStatus" | "addTask" | "addHistory" | "upsertLead" | "toggleTask";
  descricao: string;
  justificativa: string;
  payload: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Tool definitions (OpenAI-compatible function calling schema)
// ---------------------------------------------------------------------------

export const CRM_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "buscar_leads",
      description:
        "Busca e filtra leads no CRM. Use para responder perguntas sobre leads especificos, grupos de leads, leads de um curso, de um responsavel, atrasados, etc.",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome ou parte do nome do lead para buscar.",
          },
          curso: {
            type: "string",
            description: "Filtrar por curso de interesse (ex: 'massoterapia', 'estetica').",
          },
          status_funil: {
            type: "string",
            description:
              "Filtrar por etapa do funil. Valores: 'Novo Lead', 'Primeiro Contato Feito', 'Interessado no Curso', 'Informacoes Enviadas', 'Aguardando Retorno', 'Negociacao / Matricula', 'Aguardando Pagamento', 'Matriculado', 'Perdido', 'Reativar Futuramente'.",
          },
          responsavel: {
            type: "string",
            description: "Filtrar por responsavel (nome do membro da equipe).",
          },
          origem: {
            type: "string",
            description: "Filtrar por origem do lead (ex: 'Instagram', 'WhatsApp', 'Indicacao').",
          },
          apenas_atrasados: {
            type: "boolean",
            description: "Se true, retorna apenas leads com retorno atrasado.",
          },
          incluir_fechados: {
            type: "boolean",
            description: "Se true, inclui leads matriculados, perdidos e para reativar. Padrao: false.",
          },
          limite: {
            type: "number",
            description: "Numero maximo de leads a retornar. Padrao: 20.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "detalhar_lead",
      description:
        "Retorna a ficha completa de um lead especifico: dados pessoais, historico de interacoes, tarefas abertas e fechadas, observacoes. Use quando precisar de informacoes detalhadas sobre um lead.",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome do lead (busca por correspondencia parcial).",
          },
          lead_id: {
            type: "string",
            description: "ID exato do lead se disponivel.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "listar_tarefas",
      description:
        "Lista tarefas do CRM com filtros. Use para responder sobre pendencias, follow-ups, tarefas atrasadas ou tarefas de um responsavel.",
      parameters: {
        type: "object",
        properties: {
          responsavel: {
            type: "string",
            description: "Filtrar por responsavel da tarefa.",
          },
          apenas_atrasadas: {
            type: "boolean",
            description: "Se true, retorna apenas tarefas com vencimento passado.",
          },
          lead_nome: {
            type: "string",
            description: "Filtrar tarefas de um lead especifico pelo nome.",
          },
          incluir_concluidas: {
            type: "boolean",
            description: "Se true, inclui tarefas ja concluidas. Padrao: false.",
          },
          limite: {
            type: "number",
            description: "Numero maximo de tarefas. Padrao: 20.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "estatisticas_crm",
      description:
        "Retorna metricas e estatisticas detalhadas do CRM. Use para responder sobre conversao, distribuicao, desempenho por origem, curso ou responsavel.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["geral", "funil", "curso", "origem", "responsavel", "conversao"],
            description:
              "Tipo de estatistica: 'geral' (visao geral), 'funil' (por etapa), 'curso' (por curso), 'origem' (por canal), 'responsavel' (por membro da equipe), 'conversao' (taxa de matricula).",
          },
        },
        required: ["tipo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "leads_prioritarios",
      description:
        "Retorna a lista de leads que precisam de atencao imediata, ordenados por prioridade. Use quando perguntarem o que fazer agora, quem priorizar, ou qual lead abordar.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["atrasados", "negociacao", "novos_sem_contato", "todos"],
            description:
              "'atrasados': retorno vencido, 'negociacao': em fechamento, 'novos_sem_contato': recentes sem abordagem, 'todos': mix prioritario geral.",
          },
          limite: {
            type: "number",
            description: "Numero maximo de leads. Padrao: 10.",
          },
        },
        required: ["tipo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rascunhar_mensagem",
      description:
        "Gera um rascunho de mensagem para WhatsApp ou outro canal para um lead especifico, com base no perfil e situacao atual do lead no CRM.",
      parameters: {
        type: "object",
        properties: {
          lead_nome: {
            type: "string",
            description: "Nome do lead para quem a mensagem sera enviada.",
          },
          objetivo: {
            type: "string",
            description:
              "Objetivo da mensagem (ex: 'primeiro contato', 'follow-up', 'recuperar interesse', 'confirmar pagamento', 'enviar proposta').",
          },
          tom: {
            type: "string",
            enum: ["formal", "informal", "urgente", "cordial"],
            description: "Tom da mensagem. Padrao: cordial.",
          },
        },
        required: ["lead_nome", "objetivo"],
      },
    },
  },
  // --- Level 3: Action proposals ---
  {
    type: "function" as const,
    function: {
      name: "propor_acao",
      description:
        "Propoe uma acao no CRM para ser aprovada pelo usuario. Use quando identificar que uma mudanca concreta seria util: mover lead no funil, criar tarefa, registrar observacao, etc. A acao NUNCA e executada automaticamente — o usuario precisa confirmar.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["changeLeadStatus", "addTask", "addHistory", "upsertLead", "toggleTask"],
            description: "Tipo da acao CRM a ser proposta.",
          },
          descricao: {
            type: "string",
            description: "Descricao clara da acao para o usuario ler. Ex: 'Mover Maria Santos para Aguardando Retorno'.",
          },
          justificativa: {
            type: "string",
            description: "Por que voce esta sugerindo essa acao. Ex: 'Retorno vencido ha 5 dias sem resposta.'",
          },
          lead_nome: {
            type: "string",
            description: "Nome do lead ao qual a acao se refere (para buscar o ID).",
          },
          novo_status: {
            type: "string",
            description: "Para changeLeadStatus: novo status do funil. Ex: 'Aguardando Retorno', 'Negociacao / Matricula'.",
          },
          tarefa_titulo: {
            type: "string",
            description: "Para addTask: titulo da tarefa. Ex: 'Ligar para confirmar interesse'.",
          },
          tarefa_responsavel: {
            type: "string",
            description: "Para addTask: responsavel pela tarefa.",
          },
          tarefa_vencimento: {
            type: "string",
            description: "Para addTask: data de vencimento no formato YYYY-MM-DD.",
          },
          historico_acao: {
            type: "string",
            description: "Para addHistory: descricao da acao registrada. Ex: 'Follow-up realizado por telefone'.",
          },
          historico_nota: {
            type: "string",
            description: "Para addHistory: nota adicional sobre a interacao.",
          },
        },
        required: ["tipo", "descricao", "justificativa"],
      },
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Tool type
// ---------------------------------------------------------------------------

export type ToolName =
  | "buscar_leads"
  | "detalhar_lead"
  | "listar_tarefas"
  | "propor_acao"
  | "estatisticas_crm"
  | "leads_prioritarios"
  | "rascunhar_mensagem";

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolResult = {
  tool_call_id: string;
  role: "tool";
  content: string;
};

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function matchesText(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return normalizeText(haystack).includes(normalizeText(needle));
}

function serializeLeadBrief(lead: Lead, tasks: Task[]): string {
  const openTasks = tasks.filter((t) => !t.done);
  const overdue = isOverdue(lead.proximo_contato) ? " [ATRASADO]" : "";
  return [
    `Nome: ${lead.nome}${overdue}`,
    `Curso: ${lead.curso_de_interesse}`,
    `Funil: ${lead.status_funil}`,
    `Matricula: ${lead.status_matricula}`,
    `Responsavel: ${lead.responsavel}`,
    `Origem: ${lead.origem}`,
    `Proximo contato: ${lead.proximo_contato || "sem data"}`,
    `Tarefas abertas: ${openTasks.length}`,
    `Objecao: ${lead.objecao_principal || "nenhuma"}`,
  ].join(" | ");
}

function serializeLeadFull(lead: Lead, tasks: Task[]): string {
  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done).slice(-3);
  const history = (lead.history ?? []).slice(-8);

  return [
    `=== FICHA DO LEAD: ${lead.nome} ===`,
    `Telefone: ${lead.telefone}`,
    `WhatsApp: ${lead.whatsapp || lead.telefone}`,
    `Email: ${lead.email || "nao informado"}`,
    `Curso de interesse: ${lead.curso_de_interesse}`,
    `Origem: ${lead.origem}`,
    `Origem detalhe: ${lead.origem_detalhe || ""}`,
    `Captado via: ${lead.captado_via || ""}`,
    `Status no funil: ${lead.status_funil}`,
    `Status matricula: ${lead.status_matricula}`,
    `Responsavel: ${lead.responsavel}`,
    `Data de entrada: ${lead.data_entrada}`,
    `Proximo contato: ${lead.proximo_contato || "sem data"}`,
    `Retorno atrasado: ${isOverdue(lead.proximo_contato) ? "SIM" : "nao"}`,
    `Objecao principal: ${lead.objecao_principal || "nao registrada"}`,
    `Observacoes: ${lead.observacoes || "nenhuma"}`,
    `Cidade: ${lead.cidade || "nao informada"}`,
    `Profissao: ${lead.profissao || "nao informada"}`,
    `Ja foi aluno: ${lead.ja_foi_aluno ? "sim" : "nao"}`,
    "",
    openTasks.length
      ? `TAREFAS ABERTAS (${openTasks.length}):\n${openTasks.map((t) => `  - ${t.title} | vence: ${t.dueDate} | resp: ${t.owner}${isOverdue(t.dueDate) ? " [ATRASADA]" : ""}`).join("\n")}`
      : "Sem tarefas abertas.",
    doneTasks.length
      ? `ULTIMAS TAREFAS CONCLUIDAS:\n${doneTasks.map((t) => `  - ${t.title} | concluida em: ${t.done ? "concluida" : "aberta"}`).join("\n")}`
      : "",
    history.length
      ? `HISTORICO RECENTE (ultimas ${history.length} interacoes):\n${history.map((h) => `  - ${String(h.createdAt || "").slice(0, 10)}: ${h.action}${h.note ? ` — ${h.note}` : ""}`).join("\n")}`
      : "Sem historico registrado.",
  ]
    .filter(Boolean)
    .join("\n");
}

function executeBuscarLeads(
  args: {
    nome?: string;
    curso?: string;
    status_funil?: string;
    responsavel?: string;
    origem?: string;
    apenas_atrasados?: boolean;
    incluir_fechados?: boolean;
    limite?: number;
  },
  crmState: CrmState,
): string {
  const limite = args.limite ?? 20;
  let leads = args.incluir_fechados
    ? crmState.leads
    : crmState.leads.filter((l) => !closingStatuses.includes(l.status_funil));

  if (args.nome) leads = leads.filter((l) => matchesText(l.nome, args.nome!));
  if (args.curso) leads = leads.filter((l) => matchesText(l.curso_de_interesse, args.curso!));
  if (args.status_funil) leads = leads.filter((l) => matchesText(l.status_funil, args.status_funil!));
  if (args.responsavel) leads = leads.filter((l) => matchesText(l.responsavel, args.responsavel!));
  if (args.origem) leads = leads.filter((l) => matchesText(l.origem, args.origem!));
  if (args.apenas_atrasados) leads = leads.filter((l) => isOverdue(l.proximo_contato));

  leads = leads.slice(0, limite);

  if (!leads.length) return "Nenhum lead encontrado com os filtros aplicados.";

  return [
    `${leads.length} lead(s) encontrado(s):`,
    ...leads.map((l) => {
      const tasks = crmState.tasks.filter((t) => t.leadId === l.id);
      return serializeLeadBrief(l, tasks);
    }),
  ].join("\n\n");
}

function executeDetalharLead(
  args: { nome?: string; lead_id?: string },
  crmState: CrmState,
): string {
  let lead: Lead | undefined;

  if (args.lead_id) {
    lead = crmState.leads.find((l) => l.id === args.lead_id);
  }
  if (!lead && args.nome) {
    const normalized = normalizeText(args.nome);
    lead =
      crmState.leads.find((l) => normalizeText(l.nome) === normalized) ??
      crmState.leads.find((l) => normalizeText(l.nome).includes(normalized));
  }

  if (!lead) return `Lead "${args.nome || args.lead_id}" nao encontrado no CRM.`;

  const tasks = crmState.tasks.filter((t) => t.leadId === lead!.id);
  return serializeLeadFull(lead, tasks);
}

function executeListarTarefas(
  args: {
    responsavel?: string;
    apenas_atrasadas?: boolean;
    lead_nome?: string;
    incluir_concluidas?: boolean;
    limite?: number;
  },
  crmState: CrmState,
): string {
  const limite = args.limite ?? 20;
  let tasks = args.incluir_concluidas
    ? crmState.tasks
    : crmState.tasks.filter((t) => !t.done);

  if (args.responsavel) tasks = tasks.filter((t) => matchesText(t.owner, args.responsavel!));
  if (args.apenas_atrasadas) tasks = tasks.filter((t) => isOverdue(t.dueDate));

  if (args.lead_nome) {
    const lead = crmState.leads.find((l) => matchesText(l.nome, args.lead_nome!));
    if (lead) tasks = tasks.filter((t) => t.leadId === lead.id);
    else return `Lead "${args.lead_nome}" nao encontrado.`;
  }

  tasks = tasks
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, limite);

  if (!tasks.length) return "Nenhuma tarefa encontrada com os filtros aplicados.";

  return [
    `${tasks.length} tarefa(s) encontrada(s):`,
    ...tasks.map((t) => {
      const lead = crmState.leads.find((l) => l.id === t.leadId);
      const overdue = isOverdue(t.dueDate) ? " [ATRASADA]" : "";
      const status = t.done ? " [CONCLUIDA]" : "";
      return `- ${t.title}${overdue}${status} | resp: ${t.owner} | vence: ${t.dueDate} | lead: ${lead?.nome || "desconhecido"}`;
    }),
  ].join("\n");
}

function executeEstatisticasCrm(
  args: { tipo: "geral" | "funil" | "curso" | "origem" | "responsavel" | "conversao" },
  crmState: CrmState,
): string {
  const today = currentDate(0);
  const activeLeads = crmState.leads.filter((l) => !closingStatuses.includes(l.status_funil));
  const overdueLeads = activeLeads.filter((l) => isOverdue(l.proximo_contato));
  const pendingTasks = crmState.tasks.filter((t) => !t.done);
  const matriculados = crmState.leads.filter((l) => l.status_funil === "Matriculado");
  const perdidos = crmState.leads.filter((l) => l.status_funil === "Perdido");

  const breakdown = (leads: Lead[], key: keyof Lead) => {
    const map: Record<string, number> = {};
    for (const l of leads) {
      const val = String(l[key] || "Nao informado");
      map[val] = (map[val] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  switch (args.tipo) {
    case "geral":
      return [
        `=== VISAO GERAL DO CRM (${today}) ===`,
        `Total de leads: ${crmState.leads.length}`,
        `Leads ativos: ${activeLeads.length}`,
        `Com retorno atrasado: ${overdueLeads.length}`,
        `Matriculados: ${matriculados.length}`,
        `Perdidos: ${perdidos.length}`,
        `Tarefas pendentes: ${pendingTasks.length}`,
        `Tarefas atrasadas: ${pendingTasks.filter((t) => isOverdue(t.dueDate)).length}`,
        `Taxa de conversao: ${crmState.leads.length > 0 ? ((matriculados.length / crmState.leads.length) * 100).toFixed(1) : 0}%`,
      ].join("\n");

    case "funil":
      return [
        "=== DISTRIBUICAO POR FUNIL ===",
        ...breakdown(activeLeads, "status_funil").map(([s, n]) => `${s}: ${n} leads`),
      ].join("\n");

    case "curso":
      return [
        "=== LEADS POR CURSO ===",
        ...breakdown(crmState.leads, "curso_de_interesse").map(
          ([c, n]) => `${c}: ${n} leads (${((n / crmState.leads.length) * 100).toFixed(0)}%)`
        ),
      ].join("\n");

    case "origem":
      return [
        "=== LEADS POR ORIGEM ===",
        ...breakdown(crmState.leads, "origem").map(
          ([o, n]) => `${o}: ${n} leads (${((n / crmState.leads.length) * 100).toFixed(0)}%)`
        ),
      ].join("\n");

    case "responsavel":
      return [
        "=== LEADS POR RESPONSAVEL (ativos) ===",
        ...breakdown(activeLeads, "responsavel").map(([r, n]) => {
          const own = activeLeads.filter((l) => l.responsavel === r);
          const ownOverdue = own.filter((l) => isOverdue(l.proximo_contato)).length;
          return `${r}: ${n} leads ativos (${ownOverdue} atrasados)`;
        }),
      ].join("\n");

    case "conversao":
      return [
        "=== TAXA DE CONVERSAO ===",
        `Total de leads: ${crmState.leads.length}`,
        `Matriculados: ${matriculados.length} (${crmState.leads.length > 0 ? ((matriculados.length / crmState.leads.length) * 100).toFixed(1) : 0}%)`,
        `Perdidos: ${perdidos.length} (${crmState.leads.length > 0 ? ((perdidos.length / crmState.leads.length) * 100).toFixed(1) : 0}%)`,
        "",
        "Por curso (matriculados):",
        ...breakdown(matriculados, "curso_de_interesse").map(([c, n]) => {
          const total = crmState.leads.filter((l) => l.curso_de_interesse === c).length;
          return `  ${c}: ${n}/${total} (${total > 0 ? ((n / total) * 100).toFixed(0) : 0}%)`;
        }),
      ].join("\n");

    default:
      return "Tipo de estatistica nao reconhecido.";
  }
}

function executeLeadsPrioritarios(
  args: { tipo: "atrasados" | "negociacao" | "novos_sem_contato" | "todos"; limite?: number },
  crmState: CrmState,
): string {
  const limite = args.limite ?? 10;
  const activeLeads = crmState.leads.filter((l) => !closingStatuses.includes(l.status_funil));

  let leads: Lead[] = [];
  let label = "";

  switch (args.tipo) {
    case "atrasados":
      leads = activeLeads
        .filter((l) => isOverdue(l.proximo_contato))
        .sort((a, b) => (a.proximo_contato || "9999").localeCompare(b.proximo_contato || "9999"));
      label = "LEADS COM RETORNO ATRASADO (mais urgentes primeiro)";
      break;

    case "negociacao":
      leads = activeLeads.filter((l) =>
        ["Negociação / Matrícula", "Aguardando Pagamento"].includes(l.status_funil)
      );
      label = "LEADS EM NEGOCIACAO OU AGUARDANDO PAGAMENTO";
      break;

    case "novos_sem_contato":
      leads = activeLeads
        .filter((l) => ["Novo Lead", "Primeiro Contato Feito"].includes(l.status_funil))
        .sort((a, b) => a.data_entrada.localeCompare(b.data_entrada));
      label = "NOVOS LEADS SEM CONTATO EFETIVO";
      break;

    case "todos": {
      const atrasados = activeLeads
        .filter((l) => isOverdue(l.proximo_contato))
        .slice(0, Math.ceil(limite * 0.5));
      const negociacao = activeLeads
        .filter((l) => ["Negociação / Matrícula", "Aguardando Pagamento"].includes(l.status_funil))
        .slice(0, Math.ceil(limite * 0.3));
      const novos = activeLeads
        .filter((l) => l.status_funil === "Novo Lead")
        .slice(0, Math.ceil(limite * 0.2));
      leads = [...atrasados, ...negociacao, ...novos];
      label = "LEADS PRIORITARIOS (mix: atrasados + negociacao + novos)";
      break;
    }
  }

  leads = leads.slice(0, limite);

  if (!leads.length) return `Nenhum lead encontrado para o tipo "${args.tipo}".`;

  return [
    `=== ${label} ===`,
    `${leads.length} lead(s):`,
    "",
    ...leads.map((l, i) => {
      const tasks = crmState.tasks.filter((t) => t.leadId === l.id && !t.done);
      const overdue = isOverdue(l.proximo_contato) ? " ⚠ ATRASADO" : "";
      return [
        `${i + 1}. ${l.nome}${overdue}`,
        `   Curso: ${l.curso_de_interesse} | Status: ${l.status_funil}`,
        `   Responsavel: ${l.responsavel} | Proximo contato: ${l.proximo_contato || "sem data"}`,
        tasks.length ? `   Tarefas abertas: ${tasks.map((t) => t.title).join(", ")}` : "   Sem tarefas abertas",
      ].join("\n");
    }),
  ].join("\n");
}

function executeRascunharMensagem(
  args: { lead_nome: string; objetivo: string; tom?: string },
  crmState: CrmState,
): string {
  const normalized = normalizeText(args.lead_nome);
  const lead =
    crmState.leads.find((l) => normalizeText(l.nome) === normalized) ??
    crmState.leads.find((l) => normalizeText(l.nome).includes(normalized));

  if (!lead) {
    return `Lead "${args.lead_nome}" nao encontrado. Verifique o nome e tente novamente.`;
  }

  const tasks = crmState.tasks.filter((t) => t.leadId === lead.id && !t.done);
  const nextTask = tasks[0];
  const tom = args.tom || "cordial";

  return [
    `=== CONTEXTO PARA RASCUNHO ===`,
    `Lead: ${lead.nome}`,
    `Curso: ${lead.curso_de_interesse}`,
    `Status: ${lead.status_funil}`,
    `Objecao: ${lead.objecao_principal || "nenhuma"}`,
    `Proximo contato previsto: ${lead.proximo_contato || "nao definido"}`,
    `Proxima tarefa: ${nextTask?.title || "nenhuma"}`,
    `Tom solicitado: ${tom}`,
    `Objetivo: ${args.objetivo}`,
    "",
    "Use esses dados para criar a mensagem ideal para este lead.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// propor_acao executor (Level 3)
// ---------------------------------------------------------------------------

function executePropor(
  args: {
    tipo: ProposedAction["tipo"];
    descricao: string;
    justificativa: string;
    lead_nome?: string;
    novo_status?: string;
    tarefa_titulo?: string;
    tarefa_responsavel?: string;
    tarefa_vencimento?: string;
    historico_acao?: string;
    historico_nota?: string;
  },
  crmState: CrmState,
  collected: ProposedAction[],
): string {
  // Find lead to get ID if a name was provided
  let leadId: string | undefined;
  let leadNome: string | undefined;
  if (args.lead_nome) {
    const normalized = normalizeText(args.lead_nome);
    const lead =
      crmState.leads.find((l) => normalizeText(l.nome) === normalized) ??
      crmState.leads.find((l) => normalizeText(l.nome).includes(normalized));
    leadId = lead?.id;
    leadNome = lead?.nome;
  }

  // Build the CRM command payload
  let payload: Record<string, unknown> = {};

  switch (args.tipo) {
    case "changeLeadStatus":
      payload = { type: "changeLeadStatus", leadId, newStatus: args.novo_status };
      break;
    case "addTask":
      payload = {
        type: "addTask",
        leadId,
        title: args.tarefa_titulo,
        owner: args.tarefa_responsavel || "",
        dueDate: args.tarefa_vencimento || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      };
      break;
    case "addHistory":
      payload = {
        type: "addHistory",
        leadId,
        action: args.historico_acao || args.descricao,
        note: args.historico_nota || "",
      };
      break;
    case "upsertLead":
      payload = { type: "upsertLead", leadId };
      break;
    default:
      payload = { type: args.tipo, leadId };
  }

  const action: ProposedAction = {
    id: `action-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    tipo: args.tipo,
    descricao: args.descricao,
    justificativa: args.justificativa,
    payload,
  };

  collected.push(action);

  return `Acao registrada para aprovacao do usuario: "${args.descricao}" (lead: ${leadNome || args.lead_nome || "nao especificado"}).`;
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export function executeTool(
  name: string,
  args: Record<string, unknown>,
  crmState: CrmState,
  collectedActions?: ProposedAction[],
): string {
  try {
    switch (name as ToolName) {
      case "buscar_leads":
        return executeBuscarLeads(args as Parameters<typeof executeBuscarLeads>[0], crmState);
      case "detalhar_lead":
        return executeDetalharLead(args as Parameters<typeof executeDetalharLead>[0], crmState);
      case "listar_tarefas":
        return executeListarTarefas(args as Parameters<typeof executeListarTarefas>[0], crmState);
      case "estatisticas_crm":
        return executeEstatisticasCrm(args as Parameters<typeof executeEstatisticasCrm>[0], crmState);
      case "leads_prioritarios":
        return executeLeadsPrioritarios(args as Parameters<typeof executeLeadsPrioritarios>[0], crmState);
      case "rascunhar_mensagem":
        return executeRascunharMensagem(args as Parameters<typeof executeRascunharMensagem>[0], crmState);
      case "propor_acao":
        return executePropor(
          args as Parameters<typeof executePropor>[0],
          crmState,
          collectedActions ?? [],
        );
      default:
        return `Ferramenta "${name}" nao reconhecida.`;
    }
  } catch (err) {
    console.error(`[ai-tools] Erro ao executar ${name}:`, err);
    return `Erro ao executar a ferramenta ${name}: ${err instanceof Error ? err.message : "erro desconhecido"}`;
  }
}
