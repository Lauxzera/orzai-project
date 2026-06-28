import bcrypt from "bcryptjs";
import { UserRole } from "@/lib/generated/prisma/client";
import { buildAssignableOwners, normalizeCrmCustomizations, UNASSIGNED_OWNER } from "@/lib/crm";
import { appendAdminAuditEntry, readAdminAuditStore } from "@/lib/server/crm/admin-audit-store";
import {
  ensureCustomizationStore,
  readCustomizationStore,
  writeCustomizationStore,
} from "@/lib/server/crm/customization-store";
import {
  buildUserUpdateChangeTypes,
  buildUserUpdateDetails,
  parseDateOnly,
  toAdminUserRecord,
  toSessionUser,
} from "@/lib/server/crm/shared";
import { ensureLeadListStore, readLeadListStore, writeLeadListStore } from "@/lib/server/crm/lead-list-store";
import { mutateFileStore, readFileStore, ensureFileStore } from "@/lib/server/crm/file-store";
import {
  applyCommandWithPrisma,
  batchInsertLeadsInPrisma,
  ensurePrismaSeed,
  getPrismaClient,
  loadPrismaState,
  mapLeadInputToPrisma,
  mapPrismaLead,
  mapPrismaTask,
  mapPrismaUser,
} from "@/lib/server/crm/prisma-store";
import { applyCommandToState } from "@/lib/server/crm/state-commands";
import type {
  AdminUserRecord,
  NewUserData,
  Repository,
  SessionUser,
  StoredUser,
} from "@/lib/server/crm/types";

export function createFileRepository(): Repository {
  return {
    async ensureInitialized() {
      await ensureFileStore();
      await ensureCustomizationStore();
    },
    async getState() {
      return (await readFileStore()).crmState;
    },
    async findLeadWithTasks(leadId) {
      const state = (await readFileStore()).crmState;
      const lead = state.leads.find((item) => item.id === leadId);
      if (!lead) return null;
      return { lead, tasks: state.tasks.filter((task) => task.leadId === leadId) };
    },
    async findUserByUsername(username) {
      const normalized = username.trim().toLowerCase();
      return (await readFileStore()).users.find((user) => user.username.toLowerCase() === normalized) ?? null;
    },
    async findUserById(userId) {
      return (await readFileStore()).users.find((user) => user.id === userId) ?? null;
    },
    async createUser({ name, username, password }) {
      const normalized = username.trim().toLowerCase();
      const store = await readFileStore();
      if (store.users.find((u) => u.username.toLowerCase() === normalized)) {
        throw new Error("Nome de usuário já está em uso.");
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date().toISOString();
      const newUser: StoredUser = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        username: normalized,
        passwordHash,
        role: "SALES",
        active: true,
        isAgent: true,
        createdAt: now,
        updatedAt: now,
      };
      await mutateFileStore((s) => {
        s.users.push(newUser);
        return s;
      });
      return toSessionUser(newUser);
    },
    async listUsers() {
      const store = await readFileStore();
      return store.users.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(toAdminUserRecord);
    },
    async listAssignableOwners() {
      const store = await readFileStore();
      const agentNames = store.users
        .filter((u) => u.active && (u.isAgent ?? (u.role === "SALES")))
        .map((u) => u.name)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
      return [...new Set([...agentNames, UNASSIGNED_OWNER])];
    },
    async getCustomizations() {
      return readCustomizationStore();
    },
    async updateCustomizations(customizations) {
      return writeCustomizationStore(normalizeCrmCustomizations(customizations));
    },
    async listAdminAudit(limit) {
      const entries = await readAdminAuditStore();
      return entries.slice(0, limit);
    },
    async adminCreateUser({ name, username, password, role, active = true, isAgent }, actor) {
      const normalized = username.trim().toLowerCase();
      const store = await readFileStore();
      if (store.users.find((u) => u.username.toLowerCase() === normalized)) {
        throw new Error("Nome de usuário já está em uso.");
      }
      const resolvedIsAgent = isAgent ?? (role === "SALES");
      const now = new Date().toISOString();
      const newUser: StoredUser = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        username: normalized,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        active,
        isAgent: resolvedIsAgent,
        createdAt: now,
        updatedAt: now,
      };
      await mutateFileStore((s) => {
        s.users.push(newUser);
        return s;
      });
      await appendAdminAuditEntry({
        actor,
        action: "USER_CREATED",
        targetUserId: newUser.id,
        targetUserName: newUser.name,
        details: `Perfil ${newUser.role}${newUser.active ? " ativo" : " bloqueado"}${resolvedIsAgent ? ", atendente" : ""} criado por administrador.`,
        changeTypes: ["create", "role", "status"],
      });
      return toAdminUserRecord(newUser);
    },
    async updateUserByAdmin(userId, data, actor) {
      const store = await readFileStore();
      const target = store.users.find((user) => user.id === userId);
      if (!target) throw new Error("Usuário não encontrado.");
      if (actor.id === userId) {
        if (data.active === false) throw new Error("Você não pode bloquear o próprio usuário.");
        if (data.role && data.role !== target.role) throw new Error("Você não pode alterar a própria permissão.");
      }
      const nextUsername = data.username?.trim().toLowerCase();
      if (nextUsername && store.users.some((user) => user.id !== userId && user.username.toLowerCase() === nextUsername)) {
        throw new Error("Nome de usuário já está em uso.");
      }
      const activeAdminCount = store.users.filter((user) => user.active && user.role === "ADMIN").length;
      if (target.role === "ADMIN" && activeAdminCount <= 1 && (data.active === false || (data.role && data.role !== "ADMIN"))) {
        throw new Error("É preciso manter pelo menos um administrador ativo.");
      }
      const previousName = target.name;
      let updatedUser: StoredUser | null = null;
      await mutateFileStore(async (s) => {
        s.users = await Promise.all(
          s.users.map(async (user) => {
            if (user.id !== userId) return user;
            updatedUser = {
              ...user,
              name: data.name?.trim() || user.name,
              username: nextUsername || user.username,
              role: data.role || user.role,
              active: typeof data.active === "boolean" ? data.active : user.active,
              isAgent: typeof data.isAgent === "boolean" ? data.isAgent : (user.isAgent ?? (user.role === "SALES")),
              passwordHash: data.password ? await bcrypt.hash(data.password, 10) : user.passwordHash,
              updatedAt: new Date().toISOString(),
            };
            return updatedUser!;
          }),
        );
        if (updatedUser && updatedUser.name !== previousName) {
          s.crmState.leads = s.crmState.leads.map((lead) =>
            lead.responsavel === previousName ? { ...lead, responsavel: updatedUser!.name } : lead,
          );
          s.crmState.tasks = s.crmState.tasks.map((task) =>
            task.owner === previousName ? { ...task, owner: updatedUser!.name } : task,
          );
        }
        return s;
      });
      await appendAdminAuditEntry({
        actor,
        action: "USER_UPDATED",
        targetUserId: updatedUser!.id,
        targetUserName: updatedUser!.name,
        details: buildUserUpdateDetails(target, updatedUser!),
        changeTypes: buildUserUpdateChangeTypes(target, updatedUser!, Boolean(data.password)),
      });
      return toAdminUserRecord(updatedUser!);
    },
    async deleteUserByAdmin(userId, actor) {
      const store = await readFileStore();
      const target = store.users.find((user) => user.id === userId);
      if (!target) throw new Error("Usuário não encontrado.");
      if (actor.id === userId) throw new Error("Você não pode excluir o próprio usuário.");
      const activeAdminCount = store.users.filter((user) => user.active && user.role === "ADMIN").length;
      if (target.role === "ADMIN" && target.active && activeAdminCount <= 1) {
        throw new Error("É preciso manter pelo menos um administrador ativo.");
      }
      await mutateFileStore((s) => {
        s.users = s.users.filter((user) => user.id !== userId);
        s.crmState.leads = s.crmState.leads.map((lead) =>
          lead.responsavel === target.name ? { ...lead, responsavel: UNASSIGNED_OWNER } : lead,
        );
        s.crmState.tasks = s.crmState.tasks.map((task) =>
          task.owner === target.name ? { ...task, owner: UNASSIGNED_OWNER } : task,
        );
        return s;
      });
      await appendAdminAuditEntry({
        actor,
        action: "USER_DELETED",
        targetUserId: target.id,
        targetUserName: target.name,
        details: "Usuário excluído e vínculos operacionais reassociados para Equipe Comercial.",
      });
    },
    async applyCommand(command, actor) {
      const next = await mutateFileStore((store) => {
        store.crmState = applyCommandToState(store.crmState, command, actor);
        return store;
      });
      return next.crmState;
    },
    async batchInsertLeads(leads, actor) {
      await mutateFileStore((store) => {
        for (const lead of leads) {
          store.crmState = applyCommandToState(store.crmState, { type: "upsertLead", leadId: null, lead }, actor);
        }
        return store;
      });
    },
  };
}

export function createPrismaRepository(): Repository {
  const prisma = getPrismaClient();

  return {
    async ensureInitialized() {
      await ensurePrismaSeed(prisma);
      await ensureLeadListStore();
      await ensureCustomizationStore();
    },
    async getState() {
      const state = await loadPrismaState(prisma);
      return {
        ...state,
        leadLists: await readLeadListStore(),
      };
    },
    async findLeadWithTasks(leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          tasks: true,
          history: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!lead) return null;
      const mapped = mapPrismaLead(lead);
      return {
        lead: mapped,
        tasks: lead.tasks.map(mapPrismaTask),
      };
    },
    async findUserByUsername(username) {
      const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
      return user ? mapPrismaUser(user) : null;
    },
    async findUserById(userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      return user ? mapPrismaUser(user) : null;
    },
    async createUser({ name, username, password }) {
      const normalized = username.trim().toLowerCase();
      const exists = await prisma.user.findUnique({ where: { username: normalized } });
      if (exists) throw new Error("Nome de usuário já está em uso.");
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { name: name.trim(), username: normalized, passwordHash, role: UserRole.SALES, active: true },
      });
      return toSessionUser(mapPrismaUser(user));
    },
    async listUsers() {
      const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
      return users.map((user) => toAdminUserRecord(mapPrismaUser(user)));
    },
    async listAssignableOwners() {
      const users = await prisma.user.findMany({
        where: { active: true, isAgent: true },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      const names = users.map((u) => u.name);
      return [...new Set([...names, UNASSIGNED_OWNER])];
    },
    async getCustomizations() {
      return readCustomizationStore();
    },
    async updateCustomizations(customizations) {
      return writeCustomizationStore(normalizeCrmCustomizations(customizations));
    },
    async listAdminAudit(limit) {
      const entries = await readAdminAuditStore();
      return entries.slice(0, limit);
    },
    async adminCreateUser({ name, username, password, role, active = true, isAgent }, actor) {
      const normalized = username.trim().toLowerCase();
      const exists = await prisma.user.findUnique({ where: { username: normalized } });
      if (exists) throw new Error("Nome de usuário já está em uso.");
      const resolvedIsAgent = isAgent ?? (role === "SALES");
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { name: name.trim(), username: normalized, passwordHash, role: role as UserRole, active, isAgent: resolvedIsAgent },
      });
      await appendAdminAuditEntry({
        actor,
        action: "USER_CREATED",
        targetUserId: user.id,
        targetUserName: user.name,
        details: `Perfil ${role}${active ? " ativo" : " bloqueado"}${resolvedIsAgent ? ", atendente" : ""} criado por administrador.`,
      });
      return toAdminUserRecord(mapPrismaUser(user));
    },
    async updateUserByAdmin(userId, data, actor) {
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) throw new Error("Usuário não encontrado.");
      if (actor.id === userId) {
        if (data.active === false) throw new Error("Você não pode bloquear o próprio usuário.");
        if (data.role && data.role !== target.role) throw new Error("Você não pode alterar a própria permissão.");
      }
      const nextUsername = data.username?.trim().toLowerCase();
      if (nextUsername) {
        const exists = await prisma.user.findUnique({ where: { username: nextUsername } });
        if (exists && exists.id !== userId) throw new Error("Nome de usuário já está em uso.");
      }
      const activeAdminCount = await prisma.user.count({ where: { active: true, role: UserRole.ADMIN } });
      if (target.role === UserRole.ADMIN && activeAdminCount <= 1 && (data.active === false || (data.role && data.role !== "ADMIN"))) {
        throw new Error("É preciso manter pelo menos um administrador ativo.");
      }
      const nextName = data.name?.trim();
      const updated = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            name: nextName,
            username: nextUsername,
            role: data.role as UserRole | undefined,
            active: data.active,
            isAgent: typeof data.isAgent === "boolean" ? data.isAgent : undefined,
            passwordHash: data.password ? await bcrypt.hash(data.password, 10) : undefined,
          },
        });

        if (nextName && nextName !== target.name) {
          await tx.lead.updateMany({
            where: { OR: [{ responsavelId: userId }, { responsavelNome: target.name }] },
            data: { responsavelNome: nextName },
          });
          await tx.task.updateMany({
            where: { owner: target.name },
            data: { owner: nextName },
          });
        }

        return updatedUser;
      });
      await appendAdminAuditEntry({
        actor,
        action: "USER_UPDATED",
        targetUserId: updated.id,
        targetUserName: updated.name,
        details: buildUserUpdateDetails(mapPrismaUser(target), mapPrismaUser(updated)),
      });
      return toAdminUserRecord(mapPrismaUser(updated));
    },
    async deleteUserByAdmin(userId, actor) {
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target) throw new Error("Usuário não encontrado.");
      if (actor.id === userId) throw new Error("Você não pode excluir o próprio usuário.");
      const activeAdminCount = await prisma.user.count({ where: { active: true, role: UserRole.ADMIN } });
      if (target.role === UserRole.ADMIN && target.active && activeAdminCount <= 1) {
        throw new Error("É preciso manter pelo menos um administrador ativo.");
      }
      await prisma.$transaction(async (tx) => {
        await tx.task.updateMany({
          where: { owner: target.name },
          data: { owner: UNASSIGNED_OWNER },
        });
        await tx.lead.updateMany({
          where: { OR: [{ responsavelId: userId }, { responsavelNome: target.name }] },
          data: {
            responsavelId: null,
            responsavelNome: UNASSIGNED_OWNER,
          },
        });
        await tx.leadHistory.updateMany({
          where: { userId },
          data: { userId: null },
        });
        await tx.user.delete({ where: { id: userId } });
      });
      await appendAdminAuditEntry({
        actor,
        action: "USER_DELETED",
        targetUserId: target.id,
        targetUserName: target.name,
        details: "Usuário excluído e vínculos operacionais reassociados para Equipe Comercial.",
        changeTypes: ["delete"],
      });
    },
    async applyCommand(command, actor) {
      if (
        command.type === "createLeadList" ||
        command.type === "updateLeadList" ||
        command.type === "deleteLeadList" ||
        command.type === "deleteLead"
      ) {
        const currentState = {
          ...(await loadPrismaState(prisma)),
          leadLists: await readLeadListStore(),
        };
        const nextState = applyCommandToState(currentState, command, actor);
        if (command.type === "createLeadList" || command.type === "updateLeadList" || command.type === "deleteLeadList" || command.type === "deleteLead") {
          await writeLeadListStore(nextState.leadLists);
        }
        if (command.type === "deleteLead") {
          await applyCommandWithPrisma(prisma, command, actor);
        }
        return nextState;
      }

      await applyCommandWithPrisma(prisma, command, actor);
      const state = await loadPrismaState(prisma);
      return {
        ...state,
        leadLists: await readLeadListStore(),
      };
    },
    async batchInsertLeads(leads, actor) {
      await batchInsertLeadsInPrisma(prisma, leads, actor);
    },
  };
}
