import type { CrmCustomizations, CrmState, EnrollmentStatus, FunnelStatus, Lead, LeadDraft, LeadListColor, Task } from "@/lib/crm";

export type StoredUser = {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: "ADMIN" | "MANAGER" | "SALES" | "VIEWER";
  active: boolean;
  isAgent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FileStore = {
  users: StoredUser[];
  crmState: CrmState;
};

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "MANAGER" | "SALES" | "VIEWER";
};

export type AdminAuditEntry = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: "USER_CREATED" | "USER_UPDATED" | "USER_DELETED";
  targetUserId: string;
  targetUserName: string;
  details: string;
  changeTypes?: Array<"create" | "delete" | "name" | "username" | "role" | "status" | "password" | "isAgent">;
  createdAt: string;
};

export type AdminUserRecord = SessionUser & {
  active: boolean;
  isAgent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertLeadInput = LeadDraft;
export type LeadCreationSource = "manual" | "automatic_whatsapp_inbox" | "import";

export type CrmCommand =
  | { type: "restoreDemoData"; confirmationPhrase: "RESTAURAR" }
  | { type: "toggleTask"; taskId: string }
  | { type: "changeLeadStatus"; leadId: string; status: FunnelStatus }
  | { type: "addHistory"; leadId: string; note: string }
  | { type: "addTask"; leadId: string; title: string; owner: string; dueDate: string }
  | { type: "upsertLead"; leadId?: string | null; lead: UpsertLeadInput; source?: LeadCreationSource }
  | { type: "deleteLead"; leadId: string }
  | { type: "createLeadList"; name: string; description: string; color: LeadListColor; leadIds: string[] }
  | { type: "updateLeadList"; listId: string; name: string; description: string; color: LeadListColor; leadIds: string[] }
  | { type: "deleteLeadList"; listId: string };

export type NewUserData = { name: string; username: string; password: string };

export type Repository = {
  ensureInitialized: () => Promise<void>;
  getState: () => Promise<CrmState>;
  findLeadWithTasks: (leadId: string) => Promise<{ lead: Lead; tasks: Task[] } | null>;
  findUserByUsername: (username: string) => Promise<StoredUser | null>;
  findUserById: (userId: string) => Promise<StoredUser | null>;
  createUser: (data: NewUserData) => Promise<SessionUser>;
  listUsers: () => Promise<AdminUserRecord[]>;
  listAssignableOwners: () => Promise<string[]>;
  getCustomizations: () => Promise<CrmCustomizations>;
  updateCustomizations: (customizations: CrmCustomizations, actor: SessionUser | null) => Promise<CrmCustomizations>;
  listAdminAudit: (limit: number) => Promise<AdminAuditEntry[]>;
  adminCreateUser: (
    data: NewUserData & { role: SessionUser["role"]; active?: boolean; isAgent?: boolean },
    actor: SessionUser,
  ) => Promise<AdminUserRecord>;
  updateUserByAdmin: (
    userId: string,
    data: { name?: string; username?: string; password?: string; role?: SessionUser["role"]; active?: boolean; isAgent?: boolean },
    actor: SessionUser,
  ) => Promise<AdminUserRecord>;
  deleteUserByAdmin: (userId: string, actor: SessionUser) => Promise<void>;
  applyCommand: (command: CrmCommand, actor: SessionUser | null) => Promise<CrmState>;
  batchInsertLeads: (leads: UpsertLeadInput[], actor: SessionUser | null) => Promise<void>;
};

export type PrismaLeadHistoryLike = { id: string; action: string; note: string | null; createdAt: Date };
export type PrismaTaskLike = { id: string; leadId: string; title: string; owner: string; dueDate: Date; done: boolean };
export type PrismaUserLike = {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: string;
  active: boolean;
  isAgent?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PrismaLeadLike = {
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string | null;
  email: string | null;
  cursoDeInteresse: string;
  origem: string;
  origemDetalhe?: string | null;
  captadoVia?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  trackingReferrer?: string | null;
  trackingLandingPage?: string | null;
  trackingId?: string | null;
  statusFunil: string;
  statusMatricula: string;
  responsavelNome: string;
  dataEntrada: Date;
  proximoContato: Date | null;
  objecaoPrincipal: string | null;
  observacoes: string | null;
  jaFoiAluno: boolean;
  cidade: string | null;
  profissao: string | null;
  predictiveScore?: number | null;
  predictiveScoreConfidence?: string | null;
  predictiveScoreReasons?: string[];
  predictiveScoreRisks?: string[];
  predictiveScoreSource?: string | null;
  predictiveScoreUpdatedAt?: Date | null;
  history: PrismaLeadHistoryLike[];
};

export type { CrmState, EnrollmentStatus, FunnelStatus, Lead, Task };
