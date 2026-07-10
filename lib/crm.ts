export type FunnelStatus =
  | "Novo Lead"
  | "Em Conversa"
  | "Aguardando Retorno"
  | "Negociação"
  | "Matriculado";

export type EnrollmentStatus =
  | "Não iniciado"
  | "Interessado"
  | "Aguardando pagamento"
  | "Pagamento confirmado"
  | "Matriculado"
  | "Cancelado"
  | "Remanejado";

export type Period = "day" | "week" | "month";
export type View =
  | "dashboard"
  | "agenda"
  | "analytics"
  | "leads"
  | "lead-lists"
  | "tasks"
  | "messages"
  | "broadcasts"
  | "admin-users"
  | "lead-settings";
export type UserRole = "ADMIN" | "MANAGER" | "SALES" | "VIEWER";

export type CrmCustomizations = {
  courses: string[];
  courseSegments: CourseSegments;
  origins: string[];
  leadCaptureMethods: string[];
  owners: string[];
};

export type CourseSegmentKey = "formacao" | "especializacao";

export type CourseSegments = Record<CourseSegmentKey, string[]>;

export type CrmUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  active: boolean;
  isAgent?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type HistoryEntry = {
  id: string;
  action: string;
  note: string;
  createdAt: string;
};

export type LeadDuplicateMatch = {
  field: "telefone" | "email";
  lead: Lead;
};

export type LeadAttentionMeta = {
  label: "Ação imediata" | "Prioridade alta" | "Em acompanhamento" | "Baixa prioridade";
  variant: "danger" | "gold" | "outline";
};

export type LeadAttentionFilter = "all" | "acao-imediata" | "prioridade-alta" | "em-acompanhamento" | "baixa-prioridade";
export type LeadIntegrityFilter = "all" | "completo" | "incompleto" | "duplicado";

export type LeadDuplicateHint = {
  field: "telefone" | "email";
  lead: Lead;
};

export type LeadFieldKey =
  | "proximo_contato"
  | "observacoes"
  | "objecao_principal"
  | "email"
  | "cidade"
  | "profissao";

export type LeadStageRequirement = {
  field: LeadFieldKey;
  label: string;
  reason: string;
};

export type LeadDataQuality = {
  stageRequirements: LeadStageRequirement[];
  missingStageRequirements: LeadStageRequirement[];
  missingCoreFields: Array<{ field: "email" | "cidade" | "profissao"; label: string }>;
  duplicateHints: LeadDuplicateHint[];
  isComplete: boolean;
};

export type LeadPredictiveConfidence = "alta" | "media" | "baixa";
export type LeadPredictiveSource = "openrouter" | "fallback" | "rules";

export type Lead = {
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
  curso_de_interesse: string;
  origem: string;
  origem_detalhe: string;
  captado_via: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  tracking_referrer: string;
  tracking_landing_page: string;
  tracking_id: string;
  status_funil: FunnelStatus;
  status_matricula: EnrollmentStatus;
  responsavel: string;
  data_entrada: string;
  proximo_contato: string;
  objecao_principal: string;
  observacoes: string;
  ja_foi_aluno: "Sim" | "Não";
  cidade: string;
  profissao: string;
  predictive_score: number | null;
  predictive_score_confidence: LeadPredictiveConfidence | "";
  predictive_score_reasons: string[];
  predictive_score_risks: string[];
  predictive_score_source: LeadPredictiveSource | "";
  predictive_score_updated_at: string;
  history: HistoryEntry[];
};

export type LeadDraft = Omit<
  Lead,
  | "id"
  | "history"
  | "predictive_score"
  | "predictive_score_confidence"
  | "predictive_score_reasons"
  | "predictive_score_risks"
  | "predictive_score_source"
  | "predictive_score_updated_at"
>;

type LeadEditableInput = LeadDraft | Omit<Lead, "id" | "history">;

export type Task = {
  id: string;
  leadId: string;
  title: string;
  owner: string;
  dueDate: string;
  done: boolean;
};

export type LeadListColor = "slate" | "blue" | "violet" | "emerald" | "amber" | "rose";

export type LeadList = {
  id: string;
  name: string;
  description: string;
  color: LeadListColor;
  leadIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CrmState = {
  leads: Lead[];
  tasks: Task[];
  leadLists: LeadList[];
};

export const STORAGE_KEY = "orzai-project-next-v2";

export const funnelStatuses = [
  "Novo Lead",
  "Em Conversa",
  "Aguardando Retorno",
  "Negociação",
  "Matriculado"
] as const satisfies readonly FunnelStatus[];

export const enrollmentStatuses = [
  "Não iniciado",
  "Interessado",
  "Aguardando pagamento",
  "Pagamento confirmado",
  "Matriculado",
  "Cancelado",
  "Remanejado"
] as const satisfies readonly EnrollmentStatus[];

export const courses = [
  "Design de Sobrancelhas",
  "Extensão de Cílios",
  "Estética Facial",
  "Drenagem Linfática",
  "Microagulhamento",
  "Especialização em Harmonização Facial",
  "Massoterapia Profissional"
];

export const defaultCourseSegments: CourseSegments = {
  formacao: [
    "Design de Sobrancelhas",
    "Extensão de Cílios",
    "Estética Facial",
    "Drenagem Linfática",
    "Microagulhamento",
    "Massoterapia Profissional",
  ],
  especializacao: ["Especialização em Harmonização Facial"],
};

export const origins = ["WhatsApp", "Instagram", "Site", "Tráfego Pago", "Indicação", "Eventos", "Importação", "Google Sheets"];
export const leadCaptureMethods = [
  "Cadastro manual",
  "Conversa WhatsApp",
  "Importação CSV",
  "Importação PDF",
  "Google Sheets",
  "API externa",
];
export const owners = ["Ana Paula", "Bruna Martins", "Carla Souza", "Equipe Comercial"];
export const UNASSIGNED_OWNER = "Equipe Comercial";
export const LEAD_SLA_HOURS = 2;
export const defaultCrmCustomizations: CrmCustomizations = {
  courses: [...courses],
  courseSegments: {
    formacao: [...defaultCourseSegments.formacao],
    especializacao: [...defaultCourseSegments.especializacao],
  },
  origins: [...origins],
  leadCaptureMethods: [...leadCaptureMethods],
  owners: [...owners],
};
export const closingStatuses: FunnelStatus[] = ["Matriculado"];
export const chartPalette = ["#1f3043", "#baa377", "#f4e0bf", "#64748b", "#8b7354", "#d7c09a"];
export const userRoles: readonly UserRole[] = ["ADMIN", "MANAGER", "SALES", "VIEWER"] as const;
export const leadListColors = ["slate", "blue", "violet", "emerald", "amber", "rose"] as const satisfies readonly LeadListColor[];

export function buildBlankLead(
  customizations: CrmCustomizations = defaultCrmCustomizations,
  ownerOptions: readonly string[] = buildAssignableOwners(customizations.owners),
): Omit<Lead, "id" | "history"> {
  const normalized = normalizeCrmCustomizations(customizations);
  const resolvedOwners = ownerOptions.length ? [...ownerOptions] : buildAssignableOwners(normalized.owners);

  return {
    nome: "",
    telefone: "",
    whatsapp: "",
    email: "",
    curso_de_interesse: "",
    origem: normalized.origins[0],
    origem_detalhe: "Contato iniciado pelo WhatsApp",
    captado_via: normalized.leadCaptureMethods[0],
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    tracking_referrer: "",
    tracking_landing_page: "",
    tracking_id: "",
    status_funil: "Novo Lead",
    status_matricula: "Não iniciado",
    responsavel: resolvedOwners[0] ?? "Equipe Comercial",
    data_entrada: currentDate(0),
    proximo_contato: currentDate(1),
    objecao_principal: "",
    observacoes: "",
    ja_foi_aluno: "Não",
    cidade: "",
    profissao: "",
    predictive_score: null,
    predictive_score_confidence: "",
    predictive_score_reasons: [],
    predictive_score_risks: [],
    predictive_score_source: "",
    predictive_score_updated_at: "",
  };
}

export const blankLead: Omit<Lead, "id" | "history"> = buildBlankLead();

function normalizeOptionList(values: readonly string[] | null | undefined, fallback: readonly string[]) {
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : [...fallback];
}

function normalizeExplicitOptionList(values: readonly string[] | null | undefined, fallback: readonly string[]) {
  if (values == null) {
    return [...fallback];
  }

  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function flattenCourseSegments(segments: CourseSegments) {
  return Array.from(new Set([...segments.formacao, ...segments.especializacao]));
}

function inferCourseSegmentsFromList(values: readonly string[] | null | undefined): CourseSegments {
  const normalized = normalizeOptionList(values, defaultCrmCustomizations.courses);
  const formacao: string[] = [];
  const especializacao: string[] = [];

  for (const course of normalized) {
    if (/especializa/i.test(course)) {
      especializacao.push(course);
    } else {
      formacao.push(course);
    }
  }

  return {
    formacao: formacao.length ? formacao : [...defaultCourseSegments.formacao],
    especializacao,
  };
}

function normalizeCourseSegments(value?: Partial<CourseSegments> | null, fallback?: readonly string[] | null) {
  const inferred = inferCourseSegmentsFromList(fallback ?? defaultCrmCustomizations.courses);
  return {
    formacao: normalizeExplicitOptionList(value?.formacao, inferred.formacao),
    especializacao: normalizeExplicitOptionList(value?.especializacao, inferred.especializacao),
  } satisfies CourseSegments;
}

export function normalizeCrmCustomizations(value?: Partial<CrmCustomizations> | null): CrmCustomizations {
  const courseSegments = normalizeCourseSegments(value?.courseSegments, value?.courses);
  return {
    courses: flattenCourseSegments(courseSegments),
    courseSegments,
    origins: normalizeOptionList(value?.origins, defaultCrmCustomizations.origins),
    leadCaptureMethods: normalizeOptionList(value?.leadCaptureMethods, defaultCrmCustomizations.leadCaptureMethods),
    owners: buildAssignableOwners(normalizeOptionList(value?.owners, defaultCrmCustomizations.owners)),
  };
}

export function getCoursesForSegment(customizations: CrmCustomizations, segment: CourseSegmentKey) {
  return normalizeCrmCustomizations(customizations).courseSegments[segment];
}

export function inferCourseSegment(customizations: CrmCustomizations, course: string): CourseSegmentKey {
  const normalized = normalizeCrmCustomizations(customizations);
  if (normalized.courseSegments.especializacao.includes(course)) {
    return "especializacao";
  }
  return "formacao";
}

export function validateLead(lead: LeadEditableInput) {
  if (!lead.nome.trim() || !lead.telefone.trim()) {
    return "Preencha nome e telefone.";
  }
  return "";
}

export function getRequiredLeadFieldsForStage(status: FunnelStatus): LeadStageRequirement[] {
  switch (status) {
    case "Em Conversa":
      return [
        { field: "proximo_contato", label: "Próximo contato", reason: "mantém o avanço do lead interessado" },
        { field: "observacoes", label: "Observações", reason: "ajuda a registrar interesse e contexto" },
      ];
    case "Aguardando Retorno":
      return [
        { field: "proximo_contato", label: "Próximo contato", reason: "controla a data do retorno combinado" },
      ];
    case "Negociação":
      return [
        { field: "proximo_contato", label: "Próximo contato", reason: "evita a negociação parada" },
        { field: "observacoes", label: "Observações", reason: "registra proposta, objeções e próximos passos" },
      ];
    default:
      return [];
  }
}

export function normalizeLeadPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeLeadEmail(value: string) {
  return value.trim().toLowerCase();
}

export function findLeadDuplicate(
  leads: Lead[],
  draft: LeadEditableInput,
  currentLeadId?: string | null
): LeadDuplicateMatch | null {
  const phone = normalizeLeadPhone(draft.telefone || draft.whatsapp || "");
  const email = normalizeLeadEmail(draft.email || "");

  for (const lead of leads) {
    if (currentLeadId && lead.id === currentLeadId) continue;

    if (phone) {
      const existingPhone = normalizeLeadPhone(lead.telefone || lead.whatsapp || "");
      if (existingPhone && existingPhone === phone) {
        return { field: "telefone", lead };
      }
    }

    if (email) {
      const existingEmail = normalizeLeadEmail(lead.email || "");
      if (existingEmail && existingEmail === email) {
        return { field: "email", lead };
      }
    }
  }

  return null;
}

export function findPotentialLeadDuplicates(
  leads: Lead[],
  draft: LeadEditableInput,
  currentLeadId?: string | null
) {
  const phone = normalizeLeadPhone(draft.telefone || draft.whatsapp || "");
  const email = normalizeLeadEmail(draft.email || "");
  const matches: LeadDuplicateHint[] = [];

  for (const lead of leads) {
    if (currentLeadId && lead.id === currentLeadId) continue;

    const existingPhone = normalizeLeadPhone(lead.telefone || lead.whatsapp || "");
    const existingEmail = normalizeLeadEmail(lead.email || "");

    if (phone && existingPhone && existingPhone === phone) {
      matches.push({ field: "telefone", lead });
      continue;
    }

    if (email && existingEmail && existingEmail === email) {
      matches.push({ field: "email", lead });
    }
  }

  return matches;
}

export function getLeadDataQuality(lead: Lead, leads: Lead[]): LeadDataQuality {
  const stageRequirements = getRequiredLeadFieldsForStage(lead.status_funil);
  const missingStageRequirements = stageRequirements.filter((requirement) => {
    const value = lead[requirement.field];
    return typeof value !== "string" || !value.trim();
  });

  const missingCoreFields = [
    { field: "email" as const, label: "Email", value: lead.email },
    { field: "cidade" as const, label: "Cidade", value: lead.cidade },
    { field: "profissao" as const, label: "Profissão", value: lead.profissao },
  ].filter((entry) => !entry.value.trim()).map(({ field, label }) => ({ field, label }));

  const duplicateHints = findPotentialLeadDuplicates(leads, omitLeadIdentity(lead), lead.id);

  return {
    stageRequirements,
    missingStageRequirements,
    missingCoreFields,
    duplicateHints,
    isComplete: missingStageRequirements.length === 0 && missingCoreFields.length === 0 && duplicateHints.length === 0,
  };
}

export function getLeadIntegrityFilterValue(lead: Lead, leads: Lead[]): Exclude<LeadIntegrityFilter, "all"> {
  const quality = getLeadDataQuality(lead, leads);
  if (quality.duplicateHints.length) {
    return "duplicado";
  }
  if (!quality.isComplete) {
    return "incompleto";
  }
  return "completo";
}

export function seedState(): CrmState {
  const leadSeeds: Array<[string, string, string, FunnelStatus, EnrollmentStatus, string, number, number, string]> = [
    ["Mariana Alves", "Design de Sobrancelhas", "Instagram", "Aguardando Retorno", "Interessado", "Ana Paula", -2, -1, "Quer confirmar agenda de sábado"],
    ["Letícia Fernandes", "Especialização em Harmonização Facial", "Tráfego Pago", "Negociação", "Aguardando pagamento", "Bruna Martins", -8, 1, "Parcelamento"],
    ["Patrícia Gomes", "Drenagem Linfática", "Indicação", "Matriculado", "Matriculado", "Carla Souza", -12, 3, ""],
    ["Camila Rocha", "Estética Facial", "WhatsApp", "Novo Lead", "Não iniciado", "Equipe Comercial", 0, 0, ""],
    ["Renata Lima", "Extensão de Cílios", "Eventos", "Em Conversa", "Interessado", "Ana Paula", -5, 2, "Precisa avaliar deslocamento"],
    ["Juliana Prado", "Microagulhamento", "Site", "Negociação", "Interessado", "Bruna Martins", -18, 0, "Solicitou desconto à vista"],
    ["Aline Castro", "Massoterapia Profissional", "WhatsApp", "Em Conversa", "Interessado", "Equipe Comercial", -1, 1, ""],
    ["Beatriz Nunes", "Design de Sobrancelhas", "Instagram", "Em Conversa", "Interessado", "Ana Paula", -3, 2, "Comparando com outra escola"],
    ["Carolina Freitas", "Extensão de Cílios", "Instagram", "Negociação", "Interessado", "Ana Paula", -6, 1, "Quer parcelar em mais vezes"],
    ["Daniela Moura", "Estética Facial", "Site", "Aguardando Retorno", "Interessado", "Bruna Martins", -4, -1, "Aguardando resposta do marido"],
    ["Elaine Ramos", "Drenagem Linfática", "Indicação", "Matriculado", "Pagamento confirmado", "Carla Souza", -9, 2, ""],
    ["Fernanda Lopes", "Microagulhamento", "Tráfego Pago", "Em Conversa", "Interessado", "Bruna Martins", -7, 2, "Quer ver cronograma da turma"],
    ["Gabriela Pinto", "Especialização em Harmonização Facial", "Tráfego Pago", "Em Conversa", "Interessado", "Bruna Martins", -2, 1, ""],
    ["Helena Duarte", "Massoterapia Profissional", "Eventos", "Aguardando Retorno", "Interessado", "Equipe Comercial", -11, -2, "Pediu retorno após o salário"],
    ["Isabela Teixeira", "Estética Facial", "WhatsApp", "Negociação", "Interessado", "Ana Paula", -10, 0, "Negociando entrada"],
    ["Joana Sales", "Design de Sobrancelhas", "Instagram", "Matriculado", "Matriculado", "Ana Paula", -14, 5, ""],
    ["Karen Oliveira", "Drenagem Linfática", "Site", "Novo Lead", "Não iniciado", "Equipe Comercial", 0, 1, ""],
    ["Larissa Melo", "Extensão de Cílios", "Tráfego Pago", "Aguardando Retorno", "Cancelado", "Bruna Martins", -20, -3, "Sem disponibilidade de horário"],
    ["Marcia Teles", "Estética Facial", "Indicação", "Aguardando Retorno", "Interessado", "Carla Souza", -16, 6, "Voltará a falar após mudança"],
    ["Natália Borges", "Massoterapia Profissional", "WhatsApp", "Em Conversa", "Interessado", "Equipe Comercial", -3, 2, "Aguardando grade completa"]
  ];

  const leads = leadSeeds.map(([nome, curso, origem, funil, matricula, responsavel, entradaOffset, contatoOffset, objecao]) =>
    makeLead(nome, curso, origem, funil, matricula, responsavel, entradaOffset, contatoOffset, objecao)
  );

  const tasks: Task[] = [
    makeTask(leads[0], "Retornar com horários disponíveis", -1, false),
    makeTask(leads[1], "Confirmar pagamento da matrícula", 1, false),
    makeTask(leads[2], "Enviar boas-vindas e materiais iniciais", 2, true),
    makeTask(leads[4], "Enviar depoimentos e grade do curso", 2, false),
    makeTask(leads[6], "Apresentar turmas da semana", 1, false),
    makeTask(leads[8], "Fechar condição comercial", 0, false),
    makeTask(leads[9], "Retomar contato do formulário", -1, false),
    makeTask(leads[12], "Enviar diferenciais da especialização", 1, false),
    makeTask(leads[14], "Validar proposta enviada", 0, false),
    makeTask(leads[18], "Agendar reativação para próximo ciclo", 6, false),
    makeTask(leads[19], "Confirmar grade e bônus do curso", 2, false)
  ];
  const now = new Date().toISOString();
  const leadLists: LeadList[] = [
    {
      id: "list-followup-prioritario",
      name: "Follow-up prioritario",
      description: "Carteira para retornos atrasados e contatos quentes do time comercial.",
      color: "amber",
      leadIds: [leads[0].id, leads[5].id, leads[9].id, leads[13].id, leads[14].id],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "list-pos-venda-e-ex-alunos",
      name: "Pos-venda e ex-alunos",
      description: "Base para reativacao, upgrades e campanhas de relacionamento.",
      color: "violet",
      leadIds: [leads[2].id, leads[10].id, leads[15].id],
      createdAt: now,
      updatedAt: now,
    }
  ];
  return { leads, tasks, leadLists };
}

export function normalizeCrmState(state: Partial<CrmState> | null | undefined): CrmState {
  return {
    leads: (state?.leads ?? []).map(normalizeLeadSourceFields),
    tasks: state?.tasks ?? [],
    leadLists: state?.leadLists ?? [],
  };
}

export function normalizeLeadSourceFields(lead: Lead): Lead {
  const normalizedTracking = normalizeLeadTrackingFields(lead);
  const derivedOrigin = deriveLeadOriginFromTracking(normalizedTracking);
  const origin = lead.origem?.trim() || derivedOrigin || "WhatsApp";

  return {
    ...lead,
    ...normalizedTracking,
    origem: origin,
    origem_detalhe: lead.origem_detalhe?.trim() || buildLeadSourceDetail(origin, lead.nome, normalizedTracking),
    captado_via: lead.captado_via?.trim() || "Cadastro manual",
  };
}

export function normalizeLeadTrackingFields(
  lead: Pick<
    Lead,
    "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" | "tracking_referrer" | "tracking_landing_page" | "tracking_id"
  >
) {
  return {
    utm_source: lead.utm_source?.trim() || "",
    utm_medium: lead.utm_medium?.trim() || "",
    utm_campaign: lead.utm_campaign?.trim() || "",
    utm_term: lead.utm_term?.trim() || "",
    utm_content: lead.utm_content?.trim() || "",
    tracking_referrer: lead.tracking_referrer?.trim() || "",
    tracking_landing_page: lead.tracking_landing_page?.trim() || "",
    tracking_id: lead.tracking_id?.trim() || "",
  };
}

export function deriveLeadOriginFromTracking(
  lead: Pick<Lead, "utm_source" | "utm_medium" | "tracking_referrer">
) {
  const source = normalizeTrackingValue(lead.utm_source);
  const medium = normalizeTrackingValue(lead.utm_medium);
  const referrer = normalizeTrackingValue(lead.tracking_referrer);

  if (isPaidMedium(medium) || /fbclid|gclid|ttclid|meta ads|google ads/.test(`${source} ${referrer}`)) {
    return origins[3];
  }
  if (/instagram|ig|insta/.test(source) || /instagram/.test(referrer)) {
    return origins[1];
  }
  if (/whatsapp|wa me/.test(source) || /whatsapp|wa\.me/.test(referrer)) {
    return origins[0];
  }
  if (/indicacao|referral|referencia/.test(source)) {
    return origins[4];
  }
  if (/evento|event|feira|workshop/.test(source)) {
    return origins[5];
  }
  if (/google|site|seo|organic|direct/.test(source) || /google|landing|site/.test(referrer)) {
    return origins[2];
  }
  return "";
}

export function getLeadTrackedOriginLabel(lead: Pick<Lead, "origem" | "utm_source" | "utm_medium" | "tracking_referrer">) {
  const trackedSource = lead.utm_source?.trim();
  if (trackedSource) {
    return trackedSource.toLowerCase().replace(/[_-]+/g, " ");
  }
  return deriveLeadOriginFromTracking(lead) || lead.origem || "Nao informado";
}

export function getLeadTrackedCampaignLabel(
  lead: Pick<Lead, "utm_campaign" | "origem_detalhe" | "captado_via">
) {
  return lead.utm_campaign?.trim() || lead.origem_detalhe?.trim() || lead.captado_via?.trim() || "Sem campanha";
}

export function hasLeadTracking(
  lead: Pick<Lead, "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" | "tracking_referrer" | "tracking_landing_page" | "tracking_id">
) {
  return Boolean(
    lead.utm_source?.trim() ||
      lead.utm_medium?.trim() ||
      lead.utm_campaign?.trim() ||
      lead.utm_term?.trim() ||
      lead.utm_content?.trim() ||
      lead.tracking_referrer?.trim() ||
      lead.tracking_landing_page?.trim() ||
      lead.tracking_id?.trim()
  );
}

export function buildLeadSourceDetail(origin: string, leadName?: string, tracking?: Partial<Lead>) {
  const trackedDetail = buildTrackedSourceDetail(tracking);
  if (trackedDetail) {
    return trackedDetail;
  }
  const normalizedOrigin = origin.trim() || "Origem não informada";
  if (normalizedOrigin === "WhatsApp") {
    return leadName ? `Atendimento iniciado pelo WhatsApp com ${leadName}` : "Atendimento iniciado pelo WhatsApp";
  }
  if (normalizedOrigin === "Instagram") {
    return "Contato vindo do perfil ou direct do Instagram";
  }
  if (normalizedOrigin === "Site") {
    return "Lead captado pelo site";
  }
  if (normalizedOrigin === "Tráfego Pago") {
    return "Lead atribuído a campanha paga";
  }
  if (normalizedOrigin === "Indicação") {
    return "Lead vindo de indicação";
  }
  if (normalizedOrigin === "Eventos") {
    return "Lead captado em evento";
  }
  if (normalizedOrigin === "Importação") {
    return "Lead importado de base externa";
  }
  if (normalizedOrigin === "Google Sheets") {
    return "Lead sincronizado do Google Sheets";
  }
  return normalizedOrigin;
}

function buildTrackedSourceDetail(tracking?: Partial<Lead>) {
  if (!tracking) return "";
  const parts = [tracking.utm_source, tracking.utm_medium, tracking.utm_campaign]
    .map((value) => value?.trim())
    .filter(Boolean);
  if (parts.length) {
    return parts.join(" / ");
  }
  if (tracking.tracking_referrer?.trim()) {
    return `Referrer ${tracking.tracking_referrer.trim()}`;
  }
  if (tracking.tracking_landing_page?.trim()) {
    return `Landing ${tracking.tracking_landing_page.trim()}`;
  }
  return "";
}

function normalizeTrackingValue(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPaidMedium(value: string) {
  return /cpc|ppc|paid|ads|trafego pago|meta ads|google ads/.test(value);
}

export function groupCount<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] || "Não informado");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function toChartData(grouped: Record<string, number>) {
  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildTrend(leads: Lead[], allTasks: Task[], period: Period) {
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  return Array.from({ length: days }).map((_, index) => {
    const offset = index - (days - 1);
    const date = currentDate(offset);
    const label = period === "month" ?formatShortDate(date) : offset === 0 ? "Hoje" : formatShortDate(date);
    return {
      label,
      leads: leads.filter((lead) => lead.data_entrada === date).length,
      matriculas: leads.filter((lead) => lead.data_entrada === date && ["Pagamento confirmado", "Matriculado"].includes(lead.status_matricula)).length,
      tarefas: allTasks.filter((task) => task.dueDate === date && !task.done).length
    };
  });
}

export function withinPeriod(dateValue: string, period: Period) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T12:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "day") return dateValue === currentDate(0);
  start.setDate(start.getDate() - (period === "week" ? 6 : 29));
  return date >= start;
}

export function currentDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function isOverdue(dateValue: string) {
  return Boolean(dateValue && dateValue < currentDate(0));
}

export function taskOverdue(task: Task) {
  return !task.done && isOverdue(task.dueDate);
}

export function formatDate(value: string) {
  if (!value) return "sem data";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export function formatShortDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function whatsappUrl(lead: Lead) {
  const phone = (lead.whatsapp || lead.telefone).replace(/\D/g, "");
  const normalized = phone.startsWith("55") ?phone : `55${phone}`;
  const courseText = lead.curso_de_interesse.trim()
    ? `Podemos falar sobre o curso ${lead.curso_de_interesse}?`
    : "Podemos falar sobre o curso que despertou seu interesse?";
  const text = encodeURIComponent(`Olá, ${lead.nome}! Aqui é do Base CRM. ${courseText} `);
  return `https://wa.me/${normalized}? text=${text}`;
}

export function historyEntry(action: string, note = ""): HistoryEntry {
  return { id: uid(), action, note, createdAt: new Date().toISOString() };
}

export function buildLeadUpdateHistoryEntry(previous: Lead, next: LeadEditableInput) {
  const changes: string[] = [];

  appendLeadFieldChange(changes, "Telefone", previous.telefone, next.telefone);
  appendLeadFieldChange(changes, "WhatsApp", previous.whatsapp, next.whatsapp);
  appendLeadFieldChange(changes, "Email", previous.email, next.email);
  appendLeadFieldChange(changes, "Curso", previous.curso_de_interesse, next.curso_de_interesse);
  appendLeadFieldChange(changes, "Origem", previous.origem, next.origem);
  appendLeadFieldChange(changes, "Detalhe da origem", previous.origem_detalhe, next.origem_detalhe);
  appendLeadFieldChange(changes, "Captado via", previous.captado_via, next.captado_via);
  appendLeadFieldChange(changes, "UTM source", previous.utm_source, next.utm_source);
  appendLeadFieldChange(changes, "UTM medium", previous.utm_medium, next.utm_medium);
  appendLeadFieldChange(changes, "UTM campaign", previous.utm_campaign, next.utm_campaign);
  appendLeadFieldChange(changes, "UTM term", previous.utm_term, next.utm_term);
  appendLeadFieldChange(changes, "UTM content", previous.utm_content, next.utm_content);
  appendLeadFieldChange(changes, "Referrer", previous.tracking_referrer, next.tracking_referrer);
  appendLeadFieldChange(changes, "Landing page", previous.tracking_landing_page, next.tracking_landing_page);
  appendLeadFieldChange(changes, "Tracking ID", previous.tracking_id, next.tracking_id);
  appendLeadFieldChange(changes, "Responsável", previous.responsavel, next.responsavel);
  appendLeadFieldChange(changes, "Próximo contato", formatLeadDateValue(previous.proximo_contato), formatLeadDateValue(next.proximo_contato));
  appendLeadFieldChange(changes, "Status da matrícula", previous.status_matricula, next.status_matricula);
  appendLeadFieldChange(changes, "Cidade", previous.cidade, next.cidade);
  appendLeadFieldChange(changes, "Profissão", previous.profissao, next.profissao);
  appendLeadFieldChange(changes, "Já foi aluno", previous.ja_foi_aluno, next.ja_foi_aluno);
  appendLeadFieldChange(changes, "Objeção principal", previous.objecao_principal, next.objecao_principal);

  if (normalizeLeadText(previous.observacoes) !== normalizeLeadText(next.observacoes)) {
    changes.push("Observações atualizadas");
  }

  if (!changes.length) {
    return null;
  }

  return historyEntry("Cadastro atualizado", changes.join(" | "));
}

export function buildLeadOwnerChangeEntry(previous: Lead, next: LeadEditableInput) {
  if (normalizeLeadText(previous.responsavel) === normalizeLeadText(next.responsavel)) {
    return null;
  }

  return historyEntry("Responsável alterado", `${formatLeadFieldValue(previous.responsavel)} -> ${formatLeadFieldValue(next.responsavel)}`);
}

function appendLeadFieldChange(changes: string[], label: string, previous: string, next: string) {
  if (normalizeLeadText(previous) === normalizeLeadText(next)) {
    return;
  }

  changes.push(`${label}: ${formatLeadFieldValue(previous)} -> ${formatLeadFieldValue(next)}`);
}

function formatLeadFieldValue(value: string) {
  const normalized = value.trim();
  return normalized || "não informado";
}

function formatLeadDateValue(value: string) {
  return value ? formatDate(value) : "";
}

function normalizeLeadText(value: string) {
  return value.trim();
}

export function canEditCrm(role: UserRole) {
  return role !== "VIEWER";
}

export function canManageUsers(role: UserRole) {
  return role === "ADMIN";
}

export function canRestoreDemo(role: UserRole) {
  return role === "ADMIN";
}

export function canImportLeads(role: UserRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export function buildAssignableOwners(ownerNames: readonly string[]) {
  const activeOwners = ownerNames
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => name !== "Equipe Comercial")
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return [...new Set([...activeOwners, "Equipe Comercial"])];
}

export function getRoleViews(role: UserRole): View[] {
  switch (role) {
    case "ADMIN":
      return ["dashboard", "agenda", "analytics", "leads", "lead-lists", "tasks", "messages", "broadcasts", "admin-users", "lead-settings"];
    case "MANAGER":
      return ["dashboard", "agenda", "analytics", "leads", "lead-lists", "tasks", "messages", "broadcasts", "lead-settings"];
    case "SALES":
      return ["dashboard", "agenda", "leads", "lead-lists", "tasks", "messages", "broadcasts"];
    case "VIEWER":
      return ["dashboard", "agenda", "leads", "lead-lists", "messages"];
  }
}

export function getDefaultViewForRole(role: UserRole): View {
  switch (role) {
    case "ADMIN":
      return "dashboard";
    case "MANAGER":
      return "analytics";
    case "SALES":
      return "leads";
    case "VIEWER":
      return "dashboard";
  }
}

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "MANAGER":
      return "Gestor";
    case "SALES":
      return "Comercial";
    case "VIEWER":
      return "Visualizador";
  }
}

export function getRoleSummary(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "Visão completa da operação, permissões e governança da plataforma.";
    case "MANAGER":
      return "Acompanhamento de performance, importações e gestão comercial do time.";
    case "SALES":
      return "Foco no funil, atendimento, follow-up e avanço de matrículas.";
    case "VIEWER":
      return "Consulta protegida do CRM com visualização sem alterações operacionais.";
  }
}

export type LeadScore = {
  value: number;
  label: "Quente" | "Morno" | "Esfriando" | "Frio";
  tier: "hot" | "warm" | "cooling" | "cold";
};

function buildLeadScore(value: number): LeadScore {
  const tier: LeadScore["tier"] =
    value >= 70 ? "hot" : value >= 45 ? "warm" : value >= 20 ? "cooling" : "cold";
  const label: LeadScore["label"] =
    value >= 70 ? "Quente" : value >= 45 ? "Morno" : value >= 20 ? "Esfriando" : "Frio";

  return { value, label, tier };
}

export function computeDeterministicLeadScore(lead: Lead): LeadScore | null {
  if (lead.status_funil === "Matriculado") return null;

  const funnelPoints: Partial<Record<FunnelStatus, number>> = {
    "Negociação": 34,
    "Em Conversa": 20,
    "Aguardando Retorno": 12,
    "Novo Lead": 8,
  };
  const funnelScore = funnelPoints[lead.status_funil] ?? 10;

  let recencyScore = 0;
  if (lead.proximo_contato) {
    const todayMs = new Date(`${currentDate(0)}T12:00:00`).getTime();
    const contactMs = new Date(`${lead.proximo_contato}T12:00:00`).getTime();
    const daysOverdue = Math.round((todayMs - contactMs) / 86_400_000);
    if (daysOverdue <= 0) recencyScore = 18;
    else if (daysOverdue <= 2) recencyScore = 14;
    else if (daysOverdue <= 5) recencyScore = 8;
    else if (daysOverdue <= 10) recencyScore = 3;
    else recencyScore = 0;
  }

  const historyText = lead.history
    .map((entry) => `${entry.action} ${entry.note}`.toLowerCase())
    .join(" ");
  const historyCount = lead.history.length;
  const engagementScore =
    historyCount >= 8 ? 16 : historyCount >= 5 ? 12 : historyCount >= 3 ? 9 : historyCount >= 2 ? 6 : historyCount >= 1 ? 3 : 0;

  let freshnessScore = 0;
  if (lead.data_entrada) {
    const todayMs = new Date(`${currentDate(0)}T12:00:00`).getTime();
    const entryMs = new Date(`${lead.data_entrada}T12:00:00`).getTime();
    const leadAgeDays = Math.max(0, Math.round((todayMs - entryMs) / 86_400_000));
    if (leadAgeDays <= 2) freshnessScore = 8;
    else if (leadAgeDays <= 7) freshnessScore = 5;
    else if (leadAgeDays <= 15) freshnessScore = 2;
  }

  const completenessScore =
    (lead.curso_de_interesse.trim() ? 4 : 0) +
    (lead.whatsapp.trim() ? 2 : 0) +
    (lead.email.trim() ? 2 : 0) +
    (lead.cidade.trim() ? 1 : 0) +
    (lead.profissao.trim() ? 1 : 0) +
    (lead.origem_detalhe.trim() ? 2 : 0);

  const enrollmentScore: Partial<Record<EnrollmentStatus, number>> = {
    "Não iniciado": 0,
    Interessado: 6,
    "Aguardando pagamento": 12,
    "Pagamento confirmado": 18,
    Matriculado: 20,
    Cancelado: -8,
    Remanejado: -2,
  };
  const matriculaScore = enrollmentScore[lead.status_matricula] ?? 0;

  const alumniBonus = lead.ja_foi_aluno === "Sim" ? 4 : 0;
  const referralBonus = lead.origem === "Indicação" ? 4 : 0;

  let intentScore = 0;
  if (/pagamento|pix|boleto|cart[aã]o|matricul|proposta|orcamento|orçamento|link/.test(historyText)) {
    intentScore += 8;
  }
  if (/interesse|quero|fechar|avancar|avançar|vaga/.test(historyText)) {
    intentScore += 4;
  }

  const objectionPenalty = lead.objecao_principal.trim() ? -6 : 0;
  const noCoursePenalty = lead.curso_de_interesse.trim() ? 0 : -6;
  const noFollowUpPenalty = !closingStatuses.includes(lead.status_funil) && !lead.proximo_contato ? -6 : 0;

  const value = Math.min(
    100,
    Math.max(
      0,
      funnelScore +
        recencyScore +
        engagementScore +
        freshnessScore +
        completenessScore +
        matriculaScore +
        intentScore +
        alumniBonus +
        referralBonus +
        objectionPenalty +
        noCoursePenalty +
        noFollowUpPenalty,
    )
  );

  return buildLeadScore(value);
}

export function computeLeadScore(lead: Lead): LeadScore | null {
  if (lead.status_funil === "Matriculado") return null;

  if (typeof lead.predictive_score === "number" && Number.isFinite(lead.predictive_score)) {
    return buildLeadScore(Math.max(0, Math.min(100, Math.round(lead.predictive_score))));
  }

  return computeDeterministicLeadScore(lead);
}

export function getLeadAttentionMeta(lead: Lead): LeadAttentionMeta | null {
  if (lead.status_funil === "Matriculado") {
    return null;
  }

  if (isOverdue(lead.proximo_contato) && !closingStatuses.includes(lead.status_funil)) {
    return { label: "Ação imediata", variant: "danger" };
  }

  const score = computeLeadScore(lead);
  if (!score) {
    return null;
  }

  if (score.value >= 70) {
    return { label: "Prioridade alta", variant: "danger" };
  }

  if (score.value >= 45) {
    return { label: "Em acompanhamento", variant: "gold" };
  }

  return { label: "Baixa prioridade", variant: "outline" };
}

export function getLeadAttentionFilterValue(lead: Lead): Exclude<LeadAttentionFilter, "all"> {
  const meta = getLeadAttentionMeta(lead);
  if (!meta) {
    return "baixa-prioridade";
  }

  switch (meta.label) {
    case "Ação imediata":
      return "acao-imediata";
    case "Prioridade alta":
      return "prioridade-alta";
    case "Em acompanhamento":
      return "em-acompanhamento";
    default:
      return "baixa-prioridade";
  }
}

export function getLastLeadActivity(lead: Lead) {
  return lead.history.reduce<HistoryEntry | null>((latest, entry) => {
    if (!latest) return entry;
    return new Date(entry.createdAt).getTime() > new Date(latest.createdAt).getTime() ? entry : latest;
  }, null);
}

function seedHistoryEntry(id: string, action: string, note = ""): HistoryEntry {
  return { id, action, note, createdAt: `${currentDate(-1)}T12:00:00.000Z` };
}

function makeLead(
  nome: string,
  curso: string,
  origem: string,
  funil: FunnelStatus,
  matricula: EnrollmentStatus,
  responsavel: string,
  entradaOffset: number,
  contatoOffset: number,
  objecao: string
): Lead {
  const id = `lead-${slugify(nome)}`;
  return {
    id,
    nome,
    telefone: phoneFromName(nome),
    whatsapp: "",
    email: `${nome.toLowerCase().split(" ")[0]}@email.com`,
    curso_de_interesse: curso,
    origem,
    origem_detalhe: buildLeadSourceDetail(origem, nome),
    captado_via: "Cadastro manual",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    tracking_referrer: "",
    tracking_landing_page: "",
    tracking_id: "",
    status_funil: funil,
    status_matricula: matricula,
    responsavel,
    data_entrada: currentDate(entradaOffset),
    proximo_contato: closingStatuses.includes(funil) ? "" : currentDate(contatoOffset),
    objecao_principal: objecao,
    observacoes: "Lead cadastrado manualmente pela equipe comercial para acompanhamento do funil.",
    ja_foi_aluno: "Não",
    cidade: "São Paulo",
    profissao: "Esteticista",
    predictive_score: null,
    predictive_score_confidence: "",
    predictive_score_reasons: [],
    predictive_score_risks: [],
    predictive_score_source: "",
    predictive_score_updated_at: "",
    history: [
      seedHistoryEntry(`${id}-h1`, "Lead cadastrado manualmente", `${origem} - ${curso}`),
      seedHistoryEntry(`${id}-h2`, `Status atual: ${funil}`, objecao || "Sem objeção principal registrada")
    ]
  };
}

function makeTask(lead: Lead, title: string, offset: number, done: boolean): Task {
  return { id: `task-${lead.id}-${slugify(title)}`, leadId: lead.id, title, owner: lead.responsavel, dueDate: currentDate(offset), done };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function phoneFromName(value: string) {
  const base = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `119${String(10000000 + base * 137).slice(0, 8)}`;
}

function uid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function omitLeadIdentity(lead: Lead): LeadDraft {
  const {
    id: _id,
    history: _history,
    predictive_score: _predictiveScore,
    predictive_score_confidence: _predictiveConfidence,
    predictive_score_reasons: _predictiveReasons,
    predictive_score_risks: _predictiveRisks,
    predictive_score_source: _predictiveSource,
    predictive_score_updated_at: _predictiveUpdatedAt,
    ...draft
  } = lead;
  return draft;
}
