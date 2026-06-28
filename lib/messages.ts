export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "audio" | "document";
export type ConversationPriority = "normal" | "alta" | "urgente";
export type ConversationServiceStatus = "fila" | "em-atendimento" | "aguardando-cliente" | "concluido";
export type ConversationAttemptType = "whatsapp" | "ligacao" | "proposta" | "follow-up" | "matricula";
export type LeadSuggestionField =
  | "curso_de_interesse"
  | "status_funil"
  | "status_matricula"
  | "proximo_contato"
  | "objecao_principal"
  | "observacoes"
  | "cidade"
  | "profissao"
  | "email";

export type Message = {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mimeType?: string | null;
  fileName?: string | null;
  status: MessageStatus;
  timestamp: string;
  localDeliveryState?: "pending" | "failed";
  clientTempId?: string;
  statusError?: string | null;
};

export type ConversationAttempt = {
  id: string;
  type: ConversationAttemptType;
  note: string;
  createdAt: string;
  createdByName?: string | null;
};

export type ConversationWorkspace = {
  conversationKey: string;
  priority: ConversationPriority;
  serviceStatus: ConversationServiceStatus;
  tags: string[];
  pinnedNote: string;
  attempts: ConversationAttempt[];
  updatedAt: string;
};

export type Conversation = {
  id: string;
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageDirection?: MessageDirection | null;
  unreadCount: number;
  leadId: string | null;
  leadStatus: string | null;
  ownerName?: string | null;
  workspace?: ConversationWorkspace;
};

export type ConversationAnalysis = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  urgency: "alta" | "media" | "baixa";
  suggestedStatus: string | null;
  suggestedAction: string;
  leadSuggestions?: Array<{
    field: LeadSuggestionField;
    label: string;
    currentValue: string;
    suggestedValue: string;
    reason: string;
  }>;
  source: "openrouter" | "fallback";
};

export type MessagingConnectionStatus = "online" | "offline" | "waiting";

export type MessagingConnectionState = {
  configured: boolean;
  provider: string | null;
  status: MessagingConnectionStatus;
  rawState: string | null;
  qrCode: string | null;
  pairingCode: string | null;
  instanceName: string | null;
  connectedPhone: string | null;
  connectedName: string | null;
  managerUrl: string | null;
  updatedAt: string | null;
};

export type MessageCampaignStatus = "draft" | "running" | "paused" | "completed" | "cancelled";
export type MessageCampaignRecipientStatus = "pending" | "sent" | "failed" | "skipped";
export type MessageCampaignDispatchMode = "free_text" | "meta_template" | "hybrid";
export type MessageCampaignDispatchRoute = "free_text" | "meta_template" | "skip";
export type MessageCampaignEligibility =
  | "within_service_window"
  | "outside_service_window_with_template"
  | "outside_service_window_without_template"
  | "missing_phone"
  | "invalid_phone"
  | "closed_lead"
  | "duplicate_phone"
  | "missing_required_variables";
export type MessageCampaignTemplateVariableKey =
  | "nome"
  | "curso"
  | "profissao"
  | "telefone"
  | "responsavel"
  | "cidade"
  | "origem";

export const MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES: Array<{
  key: MessageCampaignTemplateVariableKey;
  label: string;
  source: string;
  fallbackValue: string;
  exampleValue: string;
}> = [
  { key: "nome", label: "Nome", source: "lead.nome", fallbackValue: "aluno(a)", exampleValue: "Mariana" },
  {
    key: "curso",
    label: "Curso",
    source: "lead.curso_de_interesse",
    fallbackValue: "curso de interesse",
    exampleValue: "Design de Sobrancelhas",
  },
  { key: "profissao", label: "Funcao", source: "lead.profissao", fallbackValue: "seu perfil", exampleValue: "Esteticista" },
  { key: "telefone", label: "Numero", source: "lead.telefone", fallbackValue: "", exampleValue: "5511999999999" },
  { key: "responsavel", label: "Responsavel", source: "lead.responsavel", fallbackValue: "Equipe Base", exampleValue: "Ana" },
  { key: "cidade", label: "Cidade", source: "lead.cidade", fallbackValue: "", exampleValue: "Sao Paulo" },
  { key: "origem", label: "Origem", source: "lead.origem", fallbackValue: "", exampleValue: "Instagram" },
];

export type MessageCampaignTemplateConfig = {
  mode: MessageCampaignDispatchMode;
  metaTemplateName?: string;
  metaTemplateLanguage?: string;
  variableKeys?: MessageCampaignTemplateVariableKey[];
};

export type MessageCampaignMetaTemplate = {
  id?: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  bodyText?: string;
  parameterCount: number;
};

export type MessageCampaignTemplateSettings = {
  fallbackTemplateName: string;
  fallbackTemplateLanguage: string;
  supportedVariables: typeof MESSAGE_CAMPAIGN_TEMPLATE_VARIABLES;
  availableTemplates?: MessageCampaignMetaTemplate[];
  templatesSyncConfigured?: boolean;
  templatesSyncError?: string;
};

export type MessageCampaignRecipient = {
  leadId: string;
  leadName: string;
  phone: string;
  status: MessageCampaignRecipientStatus;
  eligibility?: MessageCampaignEligibility;
  selectedRoute?: MessageCampaignDispatchRoute;
  templateConfig?: MessageCampaignTemplateConfig;
  templateParams?: Record<string, string>;
  processedAt?: string;
  sentAt?: string;
  failedAt?: string;
  error?: string;
  lastMessageId?: string;
};

export type MessageCampaign = {
  id: string;
  title: string;
  messageTemplate: string;
  delaySeconds: number;
  status: MessageCampaignStatus;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  templateConfig?: MessageCampaignTemplateConfig;
  startedAt?: string;
  completedAt?: string;
  nextDispatchAt?: string;
  recipients: MessageCampaignRecipient[];
};

function ts(daysBack: number, hoursBack = 0, minutesBack = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(d.getHours() - hoursBack, d.getMinutes() - minutesBack, 0, 0);
  return d.toISOString();
}

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-mariana-alves",
    contactPhone: "11910169332",
    contactName: "Mariana Alves",
    lastMessage: "Pode ser sábado de manhã mesmo! 😊",
    lastMessageAt: ts(0, 1, 30),
    unreadCount: 2,
    leadId: "lead-mariana-alves",
    leadStatus: "Aguardando Retorno",
  },
  {
    id: "conv-leticia-fernandes",
    contactPhone: "11910170121",
    contactName: "Letícia Fernandes",
    lastMessage: "Consigo parcelar em até 6x?? ",
    lastMessageAt: ts(0, 4),
    unreadCount: 1,
    leadId: "lead-leticia-fernandes",
    leadStatus: "Aguardando Pagamento",
  },
  {
    id: "conv-isabela-teixeira",
    contactPhone: "11910175461",
    contactName: "Isabela Teixeira",
    lastMessage: "E se eu entrar com R$300, o restante posso pagar depois?? ",
    lastMessageAt: ts(1, 8),
    unreadCount: 3,
    leadId: "lead-isabela-teixeira",
    leadStatus: "Negociação / Matrícula",
  },
  {
    id: "conv-renata-lima",
    contactPhone: "11910171893",
    contactName: "Renata Lima",
    lastMessage: "A distância tá me preocupando um pouco...",
    lastMessageAt: ts(1, 14),
    unreadCount: 0,
    leadId: "lead-renata-lima",
    leadStatus: "Informações Enviadas",
  },
  {
    id: "conv-daniela-moura",
    contactPhone: "11910172634",
    contactName: "Daniela Moura",
    lastMessage: "Ok, vou ver com meu marido e te dou uma resposta",
    lastMessageAt: ts(4),
    unreadCount: 0,
    leadId: "lead-daniela-moura",
    leadStatus: "Aguardando Retorno",
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  "conv-mariana-alves": [
    { id: "ma-1", conversationId: "conv-mariana-alves", direction: "outbound", type: "text", content: "Oi Mariana! Tudo bem?? Sou da equipe do Base CRM. Vi que você tem interesse no curso de Design de Sobrancelhas. Posso te passar mais informações?? 😊", status: "read", timestamp: ts(2, 10) },
    { id: "ma-2", conversationId: "conv-mariana-alves", direction: "inbound", type: "text", content: "Oi! Sim, pode passar!", status: "read", timestamp: ts(2, 9, 45) },
    { id: "ma-3", conversationId: "conv-mariana-alves", direction: "outbound", type: "text", content: "Ótimo! O curso tem 2 meses, aulas aos sábados. Você tem alguma experiência na área?? ", status: "read", timestamp: ts(2, 9, 30) },
    { id: "ma-4", conversationId: "conv-mariana-alves", direction: "inbound", type: "text", content: "Não tenho não, mas sempre quis aprender! Qual o valor?? ", status: "read", timestamp: ts(2, 9, 10) },
    { id: "ma-5", conversationId: "conv-mariana-alves", direction: "outbound", type: "text", content: "O investimento é R$ 1.200 à vista ou em até 6x no cartão. A turma mais próxima começa no dia 10 e ainda tem 3 vagas. Faz sentido pra você?? ", status: "read", timestamp: ts(2, 9) },
    { id: "ma-6", conversationId: "conv-mariana-alves", direction: "inbound", type: "text", content: "Faz sim! Deixa eu confirmar minha agenda de sábado e te falo", status: "read", timestamp: ts(2, 8, 30) },
    { id: "ma-7", conversationId: "conv-mariana-alves", direction: "outbound", type: "text", content: "Claro! As vagas estão acabando mas te aviso se tiver mudança. Fica à vontade 😊", status: "read", timestamp: ts(1, 18) },
    { id: "ma-8", conversationId: "conv-mariana-alves", direction: "inbound", type: "text", content: "Pode ser sábado de manhã mesmo! 😊", status: "read", timestamp: ts(0, 1, 30) },
  ],
  "conv-leticia-fernandes": [
    { id: "lf-1", conversationId: "conv-leticia-fernandes", direction: "outbound", type: "text", content: "Olá Letícia! Passando para confirmar sua matrícula na Especialização em Harmonização Facial. Você conseguiu resolver a questão do pagamento?? ", status: "read", timestamp: ts(2, 14) },
    { id: "lf-2", conversationId: "conv-leticia-fernandes", direction: "inbound", type: "text", content: "Oi! Queria muito fechar. Mas o valor à vista tá um pouco pesado agora.", status: "read", timestamp: ts(2, 13, 40) },
    { id: "lf-3", conversationId: "conv-leticia-fernandes", direction: "outbound", type: "text", content: "Entendo! Temos opções parceladas. No cartão dividimos em até 6x sem juros. Isso ajudaria?? ", status: "read", timestamp: ts(2, 13, 20) },
    { id: "lf-4", conversationId: "conv-leticia-fernandes", direction: "inbound", type: "text", content: "Ajudaria muito! Mas 6x seria R$ quanto por mês?? ", status: "read", timestamp: ts(1, 11) },
    { id: "lf-5", conversationId: "conv-leticia-fernandes", direction: "outbound", type: "text", content: "Seria em torno de R$ 280/mês. Bem tranquilo, né?? Posso gerar o link de pagamento agora mesmo!", status: "read", timestamp: ts(1, 10, 45) },
    { id: "lf-6", conversationId: "conv-leticia-fernandes", direction: "inbound", type: "text", content: "Consigo parcelar em até 6x?? ", status: "read", timestamp: ts(0, 4) },
  ],
  "conv-isabela-teixeira": [
    { id: "it-1", conversationId: "conv-isabela-teixeira", direction: "outbound", type: "text", content: "Isabela, boa tarde! Passando para saber se você chegou a uma decisão sobre a matrícula em Estética Facial. Temos uma condição especial esta semana.", status: "read", timestamp: ts(2, 14) },
    { id: "it-2", conversationId: "conv-isabela-teixeira", direction: "inbound", type: "text", content: "Oi! Sim, eu quero muito fazer. Só que tô com o orçamento apertado esse mês.", status: "read", timestamp: ts(2, 13, 45) },
    { id: "it-3", conversationId: "conv-isabela-teixeira", direction: "outbound", type: "text", content: "Entendemos! Podemos trabalhar com uma entrada reduzida. Qual seria o valor que você consegue agora?? ", status: "read", timestamp: ts(2, 13, 30) },
    { id: "it-4", conversationId: "conv-isabela-teixeira", direction: "inbound", type: "text", content: "Tenho uns R$300 agora. Mas preciso saber se dá pra segurar a vaga.", status: "read", timestamp: ts(1, 11) },
    { id: "it-5", conversationId: "conv-isabela-teixeira", direction: "outbound", type: "text", content: "R$300 de entrada já garante a vaga sim! O restante você parcela em até 5x no cartão. Essa condição é válida até sexta.", status: "read", timestamp: ts(1, 10, 30) },
    { id: "it-6", conversationId: "conv-isabela-teixeira", direction: "inbound", type: "text", content: "E se eu entrar com R$300, o restante posso pagar depois?? ", status: "read", timestamp: ts(1, 8) },
  ],
  "conv-renata-lima": [
    { id: "rl-1", conversationId: "conv-renata-lima", direction: "outbound", type: "text", content: "Oi Renata! Já tivemos tempo de avaliar as informações sobre o curso de Extensão de Cílios?? ", status: "read", timestamp: ts(3, 10) },
    { id: "rl-2", conversationId: "conv-renata-lima", direction: "inbound", type: "text", content: "Oi! Sim, li tudo. O curso parece ótimo, mas fico pensando na distância até lá.", status: "read", timestamp: ts(3, 9, 30) },
    { id: "rl-3", conversationId: "conv-renata-lima", direction: "outbound", type: "text", content: "De onde você viria?? Muitas alunas nossas vêm de outros bairros e falam que vale muito a pena. O conteúdo e o certificado compensam.", status: "read", timestamp: ts(3, 9) },
    { id: "rl-4", conversationId: "conv-renata-lima", direction: "inbound", type: "text", content: "Venho de Guarulhos. São uns 50 minutos.", status: "read", timestamp: ts(2, 15) },
    { id: "rl-5", conversationId: "conv-renata-lima", direction: "outbound", type: "text", content: "Temos alunas que vêm de mais longe! As aulas são concentradas então o deslocamento é só nos fins de semana. Quer agendar uma visita para conhecer o espaço?? ", status: "read", timestamp: ts(2, 14, 30) },
    { id: "rl-6", conversationId: "conv-renata-lima", direction: "inbound", type: "text", content: "A distância tá me preocupando um pouco...", status: "delivered", timestamp: ts(1, 14) },
  ],
  "conv-daniela-moura": [
    { id: "dm-1", conversationId: "conv-daniela-moura", direction: "outbound", type: "text", content: "Oi Daniela! Passando para retomar nosso contato sobre o curso de Estética Facial. Você conseguiu conversar em casa?? ", status: "read", timestamp: ts(6, 10) },
    { id: "dm-2", conversationId: "conv-daniela-moura", direction: "inbound", type: "text", content: "Oi! Comentei com meu marido. Ele pediu pra eu pensar um pouco mais.", status: "read", timestamp: ts(6, 9, 30) },
    { id: "dm-3", conversationId: "conv-daniela-moura", direction: "outbound", type: "text", content: "Claro, decisão importante merece tempo. Posso te mandar depoimentos de alunas que passaram por essa mesma situação?? ", status: "read", timestamp: ts(5, 15) },
    { id: "dm-4", conversationId: "conv-daniela-moura", direction: "inbound", type: "text", content: "Pode mandar sim.", status: "read", timestamp: ts(5, 14) },
    { id: "dm-5", conversationId: "conv-daniela-moura", direction: "outbound", type: "text", content: "Enviando agora! São histórias de mulheres que transformaram a carreira. Quando tiver lido, podemos marcar um bate-papo rápido?? ", status: "read", timestamp: ts(5, 13, 45) },
    { id: "dm-6", conversationId: "conv-daniela-moura", direction: "inbound", type: "text", content: "Ok, vou ver com meu marido e te dou uma resposta", status: "read", timestamp: ts(4) },
  ],
};
