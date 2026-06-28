import "server-only";

import bcrypt from "bcryptjs";
import { Prisma } from "@/lib/generated/prisma/client";
import { closingStatuses, currentDate, isOverdue } from "@/lib/crm";
import { createFileRepository, createPrismaRepository } from "@/lib/server/crm/repositories";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { DEFAULT_PASSWORD, DEFAULT_USERNAME, toSessionUser } from "@/lib/server/crm/shared";
import type { CrmCommand, Repository, SessionUser, UpsertLeadInput } from "@/lib/server/crm/types";

export type LeadConversationContext = {
  id: string;
  phone: string;
  name: string;
  leadStatus: string;
  ownerName: string;
};

function getRepository(): Repository {
  if (process.env.DATABASE_URL) {
    return createPrismaRepository();
  }
  return createFileRepository();
}

export async function getCrmState() {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.getState();
}

export async function getCrmFacts() {
  if (process.env.DATABASE_URL) {
    const prisma = getPrismaClient();
    const [totalLeads, activeLeads, archivedLeads, pendingTasks, overdueLeadCandidates] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { archivedAt: null } }),
      prisma.lead.count({ where: { archivedAt: { not: null } } }),
      prisma.task.count({ where: { archivedAt: null, done: false } }),
      prisma.lead.findMany({
        where: {
          archivedAt: null,
          proximoContato: { not: null },
        },
        select: {
          proximoContato: true,
          statusFunil: true,
        },
      }),
    ]);

    const overdueLeads = overdueLeadCandidates.filter((lead) => {
      const status = String(lead.statusFunil);
      const contacto = lead.proximoContato;
      if (!contacto) return false;
      if (status === "MATRICULADO" || status === "PERDIDO" || status === "REATIVAR_FUTURAMENTE") return false;
      return isOverdue(currentDateDiffSafe(contacto));
    }).length;

    return {
      totalLeads,
      activeLeads,
      archivedLeads,
      pendingTasks,
      overdueLeads,
    };
  }

  const state = await getCrmState();
  const activeLeads = state.leads.filter((lead) => !closingStatuses.includes(lead.status_funil)).length;
  const overdueLeads = state.leads.filter(
    (lead) => !closingStatuses.includes(lead.status_funil) && isOverdue(lead.proximo_contato),
  ).length;
  const pendingTasks = state.tasks.filter((task) => !task.done).length;

  return {
    totalLeads: state.leads.length,
    activeLeads,
    archivedLeads: 0,
    pendingTasks,
    overdueLeads,
  };
}

export async function listLeadConversationContexts(): Promise<LeadConversationContext[]> {
  if (process.env.DATABASE_URL) {
    const prisma = getPrismaClient();
    const leads = await prisma.lead.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        nome: true,
        telefone: true,
        whatsapp: true,
        statusFunil: true,
        responsavelNome: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return leads
      .map((lead) => ({
        id: lead.id,
        phone: normalizePhoneForConversationContext(lead.whatsapp || lead.telefone),
        name: lead.nome,
        leadStatus: String(lead.statusFunil),
        ownerName: lead.responsavelNome,
      }))
      .filter((lead) => Boolean(lead.phone));
  }

  const state = await getCrmState();
  return state.leads
    .map((lead) => ({
      id: lead.id,
      phone: normalizePhoneForConversationContext(lead.whatsapp || lead.telefone),
      name: lead.nome,
      leadStatus: lead.status_funil,
      ownerName: lead.responsavel,
    }))
    .filter((lead) => Boolean(lead.phone));
}

export async function listLeadConversationContextsForPhones(phones: string[]): Promise<LeadConversationContext[]> {
  const normalizedPhones = [...new Set(phones.map((phone) => normalizePhoneForConversationContext(phone)).filter(Boolean))];
  if (!normalizedPhones.length) return [];

  if (process.env.DATABASE_URL) {
    const prisma = getPrismaClient();
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      phone: string;
      name: string;
      leadStatus: string;
      ownerName: string;
    }>>(Prisma.sql`
      SELECT DISTINCT ON (phone) id, phone, name, "leadStatus", "ownerName"
      FROM (
        SELECT
          "id",
          regexp_replace(COALESCE(NULLIF("whatsapp", ''), "telefone", ''), '\D', '', 'g') AS phone,
          "nome" AS name,
          CAST("statusFunil" AS text) AS "leadStatus",
          "responsavelNome" AS "ownerName",
          "updatedAt"
        FROM "Lead"
        WHERE "archivedAt" IS NULL
      ) AS lead_context
      WHERE phone IN (${Prisma.join(normalizedPhones)})
      ORDER BY phone, "updatedAt" DESC
    `);

    return rows.filter((row) => Boolean(row.phone));
  }

  const all = await listLeadConversationContexts();
  const phoneSet = new Set(normalizedPhones);
  return all.filter((item) => phoneSet.has(item.phone));
}

export async function findLeadConversationContextByPhone(phone: string): Promise<LeadConversationContext | null> {
  const normalizedPhone = normalizePhoneForConversationContext(phone);
  if (!normalizedPhone) return null;
  const matches = await listLeadConversationContextsForPhones([normalizedPhone]);
  return matches[0] ?? null;
}

export async function findLeadWithTasks(leadId: string) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.findLeadWithTasks(leadId);
}

export async function authenticateUser(username: string, password: string) {
  const repository = getRepository();
  await repository.ensureInitialized();
  const user = await repository.findUserByUsername(username);
  if (!user || !user.active) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return toSessionUser(user);
}

export async function getUserById(userId: string) {
  const repository = getRepository();
  await repository.ensureInitialized();
  const user = await repository.findUserById(userId);
  if (!user || !user.active) return null;
  return toSessionUser(user);
}

export async function createUser(data: { name: string; username: string; password: string }) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.createUser(data);
}

export async function listUsers() {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.listUsers();
}

export async function listAssignableOwners() {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.listAssignableOwners();
}

export async function getCrmCustomizations() {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.getCustomizations();
}

export async function updateCrmCustomizations(
  customizations: Awaited<ReturnType<typeof getCrmCustomizations>>,
  actor?: SessionUser | null,
) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.updateCustomizations(customizations, actor ?? null);
}

export async function listAdminAudit(limit = 20) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.listAdminAudit(limit);
}

export async function adminCreateUser(
  data: {
    name: string;
    username: string;
    password: string;
    role: SessionUser["role"];
    active?: boolean;
  },
  actor: SessionUser,
) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.adminCreateUser(data, actor);
}

export async function updateUserByAdmin(
  userId: string,
  data: {
    name?: string;
    username?: string;
    password?: string;
    role?: SessionUser["role"];
    active?: boolean;
  },
  actor: SessionUser,
) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.updateUserByAdmin(userId, data, actor);
}

export async function deleteUserByAdmin(userId: string, actor: SessionUser) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.deleteUserByAdmin(userId, actor);
}

export async function applyCrmCommand(command: CrmCommand, actor?: SessionUser | null) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.applyCommand(command, actor ?? null);
}

export async function batchInsertLeads(leads: UpsertLeadInput[], actor?: SessionUser | null) {
  const repository = getRepository();
  await repository.ensureInitialized();
  return repository.batchInsertLeads(leads, actor ?? null);
}

export { DEFAULT_PASSWORD, DEFAULT_USERNAME, type CrmCommand, type SessionUser };

function currentDateDiffSafe(value: Date) {
  return value.toISOString().slice(0, 10) || currentDate(0);
}

function normalizePhoneForConversationContext(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
