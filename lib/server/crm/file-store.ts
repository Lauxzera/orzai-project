import { promises as fs } from "node:fs";
import bcrypt from "bcryptjs";
import { normalizeCrmState, owners, seedState } from "@/lib/crm";
import { ensureAdminAuditStore } from "@/lib/server/crm/admin-audit-store";
import { DATA_DIR, DATA_FILE, DEFAULT_PASSWORD, DEFAULT_USERNAME } from "@/lib/server/crm/shared";
import type { FileStore, StoredUser } from "@/lib/server/crm/types";

let fileWriteQueue = Promise.resolve();

export async function ensureFileStore() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const users = await createSeedUsers();
    const store: FileStore = {
      users,
      crmState: seedState(),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  }
  await ensureAdminAuditStore();
}

async function createSeedUsers() {
  const now = new Date().toISOString();
  const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const roleUsers: Array<{ id: string; name: string; username: string; password: string; role: StoredUser["role"] }> = [
    { id: "user-role-admin", name: "Admin", username: "admin", password: "admin123", role: "ADMIN" },
    { id: "user-role-manager", name: "Manager", username: "manager", password: "manager123", role: "MANAGER" },
    { id: "user-role-sales", name: "Sales", username: "sales", password: "sales123", role: "SALES" },
    { id: "user-role-viewer", name: "Viewer", username: "viewer", password: "viewer123", role: "VIEWER" },
  ];

  const roleUsersWithHash = await Promise.all(
    roleUsers.map(async ({ password, ...rest }) => ({
      ...rest,
      passwordHash: await bcrypt.hash(password, 10),
      active: true,
      createdAt: now,
      updatedAt: now,
    })),
  );

  return [
    {
      id: "user-admin-laux",
      name: "Administrador Base",
      username: DEFAULT_USERNAME.toLowerCase(),
      passwordHash: defaultHash,
      role: "ADMIN" as const,
      active: true,
      isAgent: false,
      createdAt: now,
      updatedAt: now,
    },
    ...owners.map((owner, index) => ({
      id: `user-owner-${index + 1}`,
      name: owner,
      username: owner.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "."),
      passwordHash: defaultHash,
      role: "SALES" as const,
      active: true,
      isAgent: true,
      createdAt: now,
      updatedAt: now,
    })),
    ...roleUsersWithHash.map((u) => ({ ...u, isAgent: u.role === "SALES" })),
  ];
}

export async function readFileStore() {
  await ensureFileStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  let parsed: FileStore;
  try {
    parsed = JSON.parse(raw) as FileStore;
  } catch {
    console.error("[file-store] Arquivo de dados corrompido — recriando com estado padrão.");
    const users = await createSeedUsers();
    parsed = { users, crmState: seedState() };
    await fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2), "utf8");
  }
  return {
    ...parsed,
    crmState: normalizeCrmState(parsed.crmState),
  } as FileStore;
}

export async function mutateFileStore(mutator: (store: FileStore) => FileStore | Promise<FileStore>) {
  fileWriteQueue = fileWriteQueue.then(async () => {
    const current = await readFileStore();
    const next = await mutator(current);
    await fs.writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  await fileWriteQueue;
  return readFileStore();
}
