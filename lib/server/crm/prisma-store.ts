import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  Prisma,
  PrismaClient,
  EnrollmentStatus as PrismaEnrollmentStatus,
  FunnelStatus as PrismaFunnelStatus,
  UserRole,
} from "@/lib/generated/prisma/client";
import { currentDate, normalizeLeadEmail, normalizeLeadPhone, owners, seedState, UNASSIGNED_OWNER, validateLead } from "@/lib/crm";
import { DEFAULT_PASSWORD, DEFAULT_USERNAME, formatDateOnly, parseDateOnly } from "@/lib/server/crm/shared";
import { pickNextAgentWithClient } from "@/lib/server/round-robin";
import type {
  CrmCommand,
  CrmState,
  EnrollmentStatus,
  FunnelStatus,
  Lead,
  LeadCreationSource,
  PrismaLeadLike,
  PrismaTaskLike,
  PrismaUserLike,
  SessionUser,
  StoredUser,
  Task,
  UpsertLeadInput,
} from "@/lib/server/crm/types";

let prismaClient: PrismaClient | null = null;
let prismaAdapter: PrismaPg | null = null;

export function getPrismaClient() {
  if (!prismaClient) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL nao configurada.");
    }
    // Serverless environments (Vercel) create many short-lived function instances.
    // Keep the pool small to avoid exhausting Supabase session-mode limit (15 max).
    // For higher throughput, switch DATABASE_URL to Supabase transaction mode (port 6543).
    const poolMax = parseInt(process.env.DB_POOL_MAX ?? "2");
    prismaAdapter ??= new PrismaPg(
      new Pool({
        connectionString: process.env.DATABASE_URL,
        max: poolMax,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 8_000,
      }),
    );
    prismaClient = new PrismaClient({ adapter: prismaAdapter });
  }
  return prismaClient;
}

export async function ensurePrismaSeed(prisma: PrismaClient) {
  const usersCount = await prisma.user.count();
  if (!usersCount) {
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const roleSeeds: Array<{ name: string; username: string; password: string; role: (typeof UserRole)[keyof typeof UserRole] }> = [
      { name: "Administrador Base", username: DEFAULT_USERNAME.toLowerCase(), password: DEFAULT_PASSWORD, role: UserRole.ADMIN },
      { name: "Anderson Laux", username: "andersonlaux", password: "@1Estrelao5", role: UserRole.ADMIN },
      { name: "Admin", username: "admin", password: "admin123", role: UserRole.ADMIN },
      { name: "Manager", username: "manager", password: "manager123", role: UserRole.MANAGER },
      { name: "Sales", username: "sales", password: "sales123", role: UserRole.SALES },
      { name: "Viewer", username: "viewer", password: "viewer123", role: UserRole.VIEWER },
    ];

    const ownerSeeds = owners.map((owner) => ({
      name: owner,
      username: owner.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "."),
      password: DEFAULT_PASSWORD,
      role: UserRole.SALES,
    }));

    for (const seed of [...roleSeeds, ...ownerSeeds]) {
      const passwordHash = seed.password === DEFAULT_PASSWORD ? defaultHash : await bcrypt.hash(seed.password, 10);
      await prisma.user.create({
        data: { name: seed.name, username: seed.username, passwordHash, role: seed.role, active: true, isAgent: seed.role === UserRole.SALES },
      });
    }
  }

}

export async function loadPrismaState(prisma: PrismaClient): Promise<CrmState> {
  const leads = await prisma.lead.findMany({
    where: { archivedAt: null },
    include: {
      tasks: { where: { archivedAt: null } },
      // Limit history per lead to avoid unbounded memory growth.
      // Full history is available via findLeadWithTasks when opening a lead.
      history: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { dataEntrada: "desc" },
  });

  const mappedLeads = leads.map(mapPrismaLead);
  const tasks = leads.flatMap((lead) => lead.tasks.map(mapPrismaTask));
  return { leads: mappedLeads, tasks, leadLists: [] };
}

export async function applyCommandWithPrisma(prisma: PrismaClient, command: CrmCommand, actor: SessionUser | null) {
  switch (command.type) {
    case "restoreDemoData": {
      await prisma.$transaction([prisma.task.deleteMany(), prisma.leadHistory.deleteMany(), prisma.lead.deleteMany()]);
      await seedPrismaState(prisma, seedState());
      return;
    }
    case "toggleTask": {
      const current = await prisma.task.findUnique({ where: { id: command.taskId } });
      if (!current) throw new Error("Tarefa nao encontrada.");
      await prisma.task.update({
        where: { id: command.taskId },
        data: {
          done: !current.done,
          doneAt: current.done ? null : new Date(),
        },
      });
      return;
    }
    case "changeLeadStatus": {
      const current = await prisma.lead.findUnique({ where: { id: command.leadId } });
      if (!current) throw new Error("Lead não encontrado.");
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: command.leadId },
          data: {
            statusFunil: toPrismaFunnelStatus(command.status),
            statusMatricula: command.status === "Matriculado" ? PrismaEnrollmentStatus.MATRICULADO : undefined,
          },
        }),
        prisma.leadHistory.create({
          data: {
            leadId: command.leadId,
            userId: actor?.id,
            action: `Status alterado de ${fromPrismaFunnelStatus(current.statusFunil)} para ${command.status}`,
            note: actor?.name || "Atualizado no CRM",
          },
        }),
      ]);
      return;
    }
    case "addHistory": {
      if (!command.note.trim()) return;
      await prisma.leadHistory.create({
        data: {
          leadId: command.leadId,
          userId: actor?.id,
          action: "Atendimento registrado",
          note: command.note.trim(),
        },
      });
      return;
    }
    case "addTask": {
      if (!command.title.trim()) return;
      await prisma.$transaction([
        prisma.task.create({
          data: {
            leadId: command.leadId,
            title: command.title.trim(),
            owner: command.owner,
            dueDate: parseDateOnly(command.dueDate),
          },
        }),
        prisma.lead.update({
          where: { id: command.leadId },
          data: { proximoContato: parseDateOnly(command.dueDate) },
        }),
        prisma.leadHistory.create({
          data: {
            leadId: command.leadId,
            userId: actor?.id,
            action: "Tarefa de follow-up criada",
            note: `${command.title.trim()} - ${command.dueDate}`,
          },
        }),
      ]);
      return;
    }
    case "upsertLead": {
      const validation = validateLead(command.lead);
      if (validation) throw new Error(validation);

      if (!command.leadId) {
        await prisma.$transaction(async (tx) => {
          await lockLeadIdentity(tx, command.lead);
          const duplicate = await findLeadDuplicateInPrisma(tx, command.lead);
          if (duplicate) {
            if (shouldReuseDuplicateLead({ lead: command.lead, actor, source: command.source })) {
              return;
            }
            throw new Error(`Ja existe um lead com este ${duplicate.field} (${duplicate.leadName}).`);
          }

          const ownerAssignment = await resolveLeadOwnerAssignment(tx, command.lead, actor, command.source);
          const created = await tx.lead.create({ data: mapLeadInputToPrisma(command.lead, ownerAssignment) });
          const automaticWhatsappLead = shouldAutoAssignLeadWithRoundRobin({ lead: command.lead, actor, source: command.source });
          await tx.leadHistory.create({
            data: {
              leadId: created.id,
              userId: actor?.id,
              action: automaticWhatsappLead ? "Lead cadastrado automaticamente" : "Lead cadastrado manualmente",
              note: [
                command.lead.origem,
                command.lead.curso_de_interesse || "Sem curso definido",
                automaticWhatsappLead ? "Origem do cadastro: inbox automatico" : `Origem do cadastro: ${command.source ?? "manual"}`,
                `Responsável: ${ownerAssignment.name}`,
              ].join(" - "),
            },
          });

          if (automaticWhatsappLead) {
            await tx.leadHistory.create({
              data: {
                leadId: created.id,
                userId: actor?.id,
                action: "Responsavel definido pela roleta",
                note: `Distribuido automaticamente para ${ownerAssignment.name}.`,
              },
            });
          }
        });
        return;
      }

      const current = await prisma.lead.findUnique({ where: { id: command.leadId } });
      if (!current) throw new Error("Lead não encontrado.");

      await prisma.$transaction(async (tx) => {
        await lockLeadIdentity(tx, command.lead);
        const duplicate = await findLeadDuplicateInPrisma(tx, command.lead, command.leadId);
        if (duplicate) {
          throw new Error(`Ja existe um lead com este ${duplicate.field} (${duplicate.leadName}).`);
        }

        const ownerAssignment = await resolveLeadOwnerAssignment(tx, command.lead, actor, command.source);

        await tx.lead.update({
          where: { id: current.id },
          data: mapLeadInputToPrisma(command.lead, ownerAssignment),
        });

        if (fromPrismaFunnelStatus(current.statusFunil) !== command.lead.status_funil) {
          await tx.leadHistory.create({
            data: {
              leadId: current.id,
              userId: actor?.id,
              action: `Status alterado de ${fromPrismaFunnelStatus(current.statusFunil)} para ${command.lead.status_funil}`,
              note: command.lead.objecao_principal || "Atualizacao manual",
            },
          });
        }
      });
      return;
    }
    case "deleteLead": {
      const current = await prisma.lead.findUnique({ where: { id: command.leadId } });
      if (!current || current.archivedAt) throw new Error("Lead não encontrado.");

      await prisma.$transaction([
        prisma.task.updateMany({
          where: { leadId: command.leadId, archivedAt: null },
          data: { archivedAt: new Date() },
        }),
        prisma.lead.update({
          where: { id: command.leadId },
          data: { archivedAt: new Date() },
        }),
      ]);
      return;
    }
  }
}

export async function seedPrismaState(prisma: PrismaClient, state: CrmState) {
  for (const lead of state.leads) {
    await prisma.lead.create({
      data: {
        id: lead.id,
        ...mapLeadInputToPrisma(lead),
        history: {
          create: lead.history.map((entry) => ({
            id: entry.id,
            action: entry.action,
            note: entry.note,
            createdAt: new Date(entry.createdAt),
          })),
        },
        tasks: {
          create: state.tasks.filter((task) => task.leadId === lead.id).map((task) => ({
            id: task.id,
            title: task.title,
            owner: task.owner,
            dueDate: parseDateOnly(task.dueDate),
            done: task.done,
            doneAt: task.done ? parseDateOnly(task.dueDate) : null,
          })),
        },
      },
    });
  }
}

type DuplicateLeadMatch = {
  field: "telefone" | "email";
  leadId: string;
  leadName: string;
};

type LeadOriginContext = {
  source?: LeadCreationSource;
  actor: SessionUser | null;
  lead: UpsertLeadInput | Lead;
};

async function lockLeadIdentity(tx: Prisma.TransactionClient, lead: UpsertLeadInput | Lead) {
  const normalizedPhone = normalizeLeadPhone(lead.telefone || lead.whatsapp || "");
  const normalizedEmail = normalizeLeadEmail(lead.email || "");
  const lockKeys = [normalizedPhone ? `lead-phone:${normalizedPhone}` : "", normalizedEmail ? `lead-email:${normalizedEmail}` : ""]
    .filter(Boolean)
    .sort();

  for (const lockKey of lockKeys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }
}

async function findLeadDuplicateInPrisma(
  tx: Prisma.TransactionClient,
  lead: UpsertLeadInput | Lead,
  currentLeadId?: string | null,
): Promise<DuplicateLeadMatch | null> {
  const normalizedPhone = normalizeLeadPhone(lead.telefone || lead.whatsapp || "");
  const normalizedEmail = normalizeLeadEmail(lead.email || "");

  if (normalizedPhone) {
    const phoneMatches = await tx.$queryRaw<Array<{ id: string; nome: string }>>(Prisma.sql`
      SELECT "id", "nome"
      FROM "Lead"
      WHERE "archivedAt" IS NULL
        ${currentLeadId ? Prisma.sql`AND "id" <> ${currentLeadId}` : Prisma.empty}
        AND (
          regexp_replace(COALESCE("telefone", ''), '\D', '', 'g') = ${normalizedPhone}
          OR regexp_replace(COALESCE("whatsapp", ''), '\D', '', 'g') = ${normalizedPhone}
        )
      ORDER BY "createdAt" ASC
      LIMIT 1
    `);

    if (phoneMatches[0]) {
      return {
        field: "telefone",
        leadId: phoneMatches[0].id,
        leadName: phoneMatches[0].nome,
      };
    }
  }

  if (normalizedEmail) {
    const emailMatches = await tx.$queryRaw<Array<{ id: string; nome: string }>>(Prisma.sql`
      SELECT "id", "nome"
      FROM "Lead"
      WHERE "archivedAt" IS NULL
        ${currentLeadId ? Prisma.sql`AND "id" <> ${currentLeadId}` : Prisma.empty}
        AND lower(btrim(COALESCE("email", ''))) = ${normalizedEmail}
      ORDER BY "createdAt" ASC
      LIMIT 1
    `);

    if (emailMatches[0]) {
      return {
        field: "email",
        leadId: emailMatches[0].id,
        leadName: emailMatches[0].nome,
      };
    }
  }

  return null;
}

function isAutomaticWhatsappInboxLead({ source, actor, lead }: LeadOriginContext) {
  if (source === "automatic_whatsapp_inbox") return true;
  return !actor && lead.origem === "WhatsApp" && lead.captado_via === "Conversa WhatsApp";
}

function shouldReuseDuplicateLead(context: LeadOriginContext) {
  return isAutomaticWhatsappInboxLead(context);
}

function shouldAutoAssignLeadWithRoundRobin(context: LeadOriginContext) {
  return isAutomaticWhatsappInboxLead(context);
}

async function resolveLeadOwnerAssignment(
  tx: Prisma.TransactionClient,
  lead: UpsertLeadInput | Lead,
  actor: SessionUser | null,
  source?: LeadCreationSource,
): Promise<{ name: string; id: string | null }> {
  if (shouldAutoAssignLeadWithRoundRobin({ lead, actor, source })) {
    return pickNextAgentWithClient(tx);
  }

  const requestedOwner = lead.responsavel.trim() || UNASSIGNED_OWNER;
  if (requestedOwner === UNASSIGNED_OWNER) {
    return { name: UNASSIGNED_OWNER, id: null };
  }

  const owner = await tx.user.findFirst({
    where: { name: requestedOwner },
    select: { id: true, name: true },
  });

  return {
    name: requestedOwner,
    id: owner?.id ?? null,
  };
}

export function mapLeadInputToPrisma(
  lead: UpsertLeadInput | Lead,
  ownerAssignment: { name: string; id: string | null } = {
    name: lead.responsavel?.trim() || UNASSIGNED_OWNER,
    id: null,
  },
) {
  const predictiveScore = "predictive_score" in lead ? lead.predictive_score : null;
  const predictiveScoreConfidence = "predictive_score_confidence" in lead ? lead.predictive_score_confidence : "";
  const predictiveScoreReasons = "predictive_score_reasons" in lead ? lead.predictive_score_reasons : [];
  const predictiveScoreRisks = "predictive_score_risks" in lead ? lead.predictive_score_risks : [];
  const predictiveScoreSource = "predictive_score_source" in lead ? lead.predictive_score_source : "";
  const predictiveScoreUpdatedAt = "predictive_score_updated_at" in lead ? lead.predictive_score_updated_at : "";

  return {
    nome: lead.nome,
    telefone: lead.telefone,
    whatsapp: lead.whatsapp || null,
    email: lead.email || null,
    cursoDeInteresse: lead.curso_de_interesse,
    origem: lead.origem,
    origemDetalhe: lead.origem_detalhe || null,
    captadoVia: lead.captado_via || null,
    utmSource: lead.utm_source || null,
    utmMedium: lead.utm_medium || null,
    utmCampaign: lead.utm_campaign || null,
    utmTerm: lead.utm_term || null,
    utmContent: lead.utm_content || null,
    trackingReferrer: lead.tracking_referrer || null,
    trackingLandingPage: lead.tracking_landing_page || null,
    trackingId: lead.tracking_id || null,
    statusFunil: toPrismaFunnelStatus(lead.status_funil),
    statusMatricula: toPrismaEnrollmentStatus(lead.status_matricula),
    responsavelId: ownerAssignment.id,
    responsavelNome: ownerAssignment.name,
    dataEntrada: parseDateOnly(lead.data_entrada),
    proximoContato: lead.proximo_contato ? parseDateOnly(lead.proximo_contato) : null,
    objecaoPrincipal: lead.objecao_principal || null,
    observacoes: lead.observacoes || null,
    jaFoiAluno: lead.ja_foi_aluno === "Sim",
    cidade: lead.cidade || null,
    profissao: lead.profissao || null,
    predictiveScore: typeof predictiveScore === "number" ? Math.round(predictiveScore) : null,
    predictiveScoreConfidence: predictiveScoreConfidence || null,
    predictiveScoreReasons: predictiveScoreReasons ?? [],
    predictiveScoreRisks: predictiveScoreRisks ?? [],
    predictiveScoreSource: predictiveScoreSource || null,
    predictiveScoreUpdatedAt: predictiveScoreUpdatedAt ? new Date(predictiveScoreUpdatedAt) : null,
  };
}

export function mapPrismaLead(lead: PrismaLeadLike): Lead {
  return {
    id: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    whatsapp: lead.whatsapp ?? "",
    email: lead.email ?? "",
    curso_de_interesse: lead.cursoDeInteresse,
    origem: lead.origem,
    origem_detalhe: lead.origemDetalhe ?? "",
    captado_via: lead.captadoVia ?? "",
    utm_source: lead.utmSource ?? "",
    utm_medium: lead.utmMedium ?? "",
    utm_campaign: lead.utmCampaign ?? "",
    utm_term: lead.utmTerm ?? "",
    utm_content: lead.utmContent ?? "",
    tracking_referrer: lead.trackingReferrer ?? "",
    tracking_landing_page: lead.trackingLandingPage ?? "",
    tracking_id: lead.trackingId ?? "",
    status_funil: fromPrismaFunnelStatus(lead.statusFunil as PrismaFunnelStatus),
    status_matricula: fromPrismaEnrollmentStatus(lead.statusMatricula as PrismaEnrollmentStatus),
    responsavel: lead.responsavelNome,
    data_entrada: formatDateOnly(lead.dataEntrada),
    proximo_contato: lead.proximoContato ? formatDateOnly(lead.proximoContato) : "",
    objecao_principal: lead.objecaoPrincipal ?? "",
    observacoes: lead.observacoes ?? "",
    ja_foi_aluno: lead.jaFoiAluno ? "Sim" : "Não",
    cidade: lead.cidade ?? "",
    profissao: lead.profissao ?? "",
    predictive_score: typeof lead.predictiveScore === "number" ? lead.predictiveScore : null,
    predictive_score_confidence:
      lead.predictiveScoreConfidence === "alta" ||
      lead.predictiveScoreConfidence === "media" ||
      lead.predictiveScoreConfidence === "baixa"
        ? lead.predictiveScoreConfidence
        : "",
    predictive_score_reasons: lead.predictiveScoreReasons ?? [],
    predictive_score_risks: lead.predictiveScoreRisks ?? [],
    predictive_score_source:
      lead.predictiveScoreSource === "openrouter" ||
      lead.predictiveScoreSource === "fallback" ||
      lead.predictiveScoreSource === "rules"
        ? lead.predictiveScoreSource
        : "",
    predictive_score_updated_at: lead.predictiveScoreUpdatedAt ? lead.predictiveScoreUpdatedAt.toISOString() : "",
    history: lead.history.map((entry) => ({
      id: entry.id,
      action: entry.action,
      note: entry.note ?? "",
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

export function mapPrismaTask(task: PrismaTaskLike): Task {
  return {
    id: task.id,
    leadId: task.leadId,
    title: task.title,
    owner: task.owner,
    dueDate: formatDateOnly(task.dueDate),
    done: task.done,
  };
}

export function mapPrismaUser(user: PrismaUserLike): StoredUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role as StoredUser["role"],
    active: user.active,
    isAgent: user.isAgent ?? false,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toPrismaFunnelStatus(status: FunnelStatus) {
  switch (status) {
    case "Novo Lead":
      return PrismaFunnelStatus.NOVO_LEAD;
    case "Em Conversa":
      return PrismaFunnelStatus.EM_CONVERSA;
    case "Aguardando Retorno":
      return PrismaFunnelStatus.AGUARDANDO_RETORNO;
    case "Negociação":
      return PrismaFunnelStatus.NEGOCIACAO;
    case "Matriculado":
      return PrismaFunnelStatus.MATRICULADO;
  }
}

export function fromPrismaFunnelStatus(status: PrismaFunnelStatus): FunnelStatus {
  switch (status) {
    case PrismaFunnelStatus.NOVO_LEAD:
      return "Novo Lead";
    case PrismaFunnelStatus.EM_CONVERSA:
      return "Em Conversa";
    case PrismaFunnelStatus.AGUARDANDO_RETORNO:
      return "Aguardando Retorno";
    case PrismaFunnelStatus.NEGOCIACAO:
      return "Negociação";
    case PrismaFunnelStatus.MATRICULADO:
      return "Matriculado";
  }
  throw new Error(`Status de funil desconhecido: ${String(status)}`);
}

export function toPrismaEnrollmentStatus(status: EnrollmentStatus) {
  switch (status) {
    case "Não iniciado":
      return PrismaEnrollmentStatus.NAO_INICIADO;
    case "Interessado":
      return PrismaEnrollmentStatus.INTERESSADO;
    case "Aguardando pagamento":
      return PrismaEnrollmentStatus.AGUARDANDO_PAGAMENTO;
    case "Pagamento confirmado":
      return PrismaEnrollmentStatus.PAGAMENTO_CONFIRMADO;
    case "Matriculado":
      return PrismaEnrollmentStatus.MATRICULADO;
    case "Cancelado":
      return PrismaEnrollmentStatus.CANCELADO;
    case "Remanejado":
      return PrismaEnrollmentStatus.REMANEJADO;
  }
}

export function fromPrismaEnrollmentStatus(status: PrismaEnrollmentStatus): EnrollmentStatus {
  switch (status) {
    case PrismaEnrollmentStatus.NAO_INICIADO:
      return "Não iniciado";
    case PrismaEnrollmentStatus.INTERESSADO:
      return "Interessado";
    case PrismaEnrollmentStatus.AGUARDANDO_PAGAMENTO:
      return "Aguardando pagamento";
    case PrismaEnrollmentStatus.PAGAMENTO_CONFIRMADO:
      return "Pagamento confirmado";
    case PrismaEnrollmentStatus.MATRICULADO:
      return "Matriculado";
    case PrismaEnrollmentStatus.CANCELADO:
      return "Cancelado";
    case PrismaEnrollmentStatus.REMANEJADO:
      return "Remanejado";
  }
  throw new Error(`Status de matricula desconhecido: ${String(status)}`);
}
// Inserts many leads in a single DB transaction - no full state reload between inserts.
export async function batchInsertLeadsInPrisma(
  prisma: PrismaClient,
  leads: UpsertLeadInput[],
  actor: SessionUser | null,
): Promise<void> {
  if (leads.length === 0) return;

  await prisma.$transaction(
    async (tx) => {
      for (const lead of leads) {
        await tx.lead.create({
          data: {
            ...mapLeadInputToPrisma(lead),
            history: {
              create: {
                userId: actor?.id ?? null,
                action: "Lead importado via arquivo",
                note: `${lead.origem} - ${lead.curso_de_interesse}`,
              },
            },
          },
        });
      }
    },
    { timeout: 30_000 },
  );
}
