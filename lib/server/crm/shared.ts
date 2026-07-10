import path from "node:path";
import { currentDate } from "@/lib/crm";
import type { AdminAuditEntry, AdminUserRecord, SessionUser, StoredUser } from "@/lib/server/crm/types";

export { uid } from "@/lib/server/crm/uid";

export const DATA_DIR = path.join(process.cwd(), "data");
export const DATA_FILE = path.join(DATA_DIR, "crm-store.json");
export const AUDIT_FILE = path.join(DATA_DIR, "admin-audit.json");
export const DEFAULT_PASSWORD = "laux123";
export const DEFAULT_USERNAME = "Laux";

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export function toAdminUserRecord(user: StoredUser): AdminUserRecord {
  return {
    ...toSessionUser(user),
    active: user.active,
    isAgent: user.isAgent ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function parseDateOnly(value: string) {
  return new Date(`${value || currentDate(0)}T12:00:00`);
}

export function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function buildUserUpdateDetails(previous: StoredUser, next: StoredUser) {
  const changes: string[] = [];
  if (previous.name !== next.name) changes.push(`nome: ${previous.name} -> ${next.name}`);
  if (previous.username !== next.username) changes.push(`usuário: ${previous.username} -> ${next.username}`);
  if (previous.role !== next.role) changes.push(`permissão: ${previous.role} -> ${next.role}`);
  if (previous.active !== next.active) {
    changes.push(`status: ${previous.active ? "ativo" : "bloqueado"} -> ${next.active ? "ativo" : "bloqueado"}`);
  }
  const prevAgent = previous.isAgent ?? false;
  const nextAgent = next.isAgent ?? false;
  if (prevAgent !== nextAgent) {
    changes.push(`atendente: ${prevAgent ? "sim" : "não"} -> ${nextAgent ? "sim" : "não"}`);
  }

  return changes.length ? changes.join(" | ") : "Dados de usuário atualizados sem alteração estrutural visível.";
}

export function buildUserUpdateChangeTypes(
  previous: StoredUser,
  next: StoredUser,
  passwordChanged: boolean,
): NonNullable<AdminAuditEntry["changeTypes"]> {
  const changes: NonNullable<AdminAuditEntry["changeTypes"]> = [];
  if (previous.name !== next.name) changes.push("name");
  if (previous.username !== next.username) changes.push("username");
  if (previous.role !== next.role) changes.push("role");
  if (previous.active !== next.active) changes.push("status");
  if ((previous.isAgent ?? false) !== (next.isAgent ?? false)) changes.push("isAgent");
  if (passwordChanged) changes.push("password");
  return changes.length ? changes : ["name"];
}

