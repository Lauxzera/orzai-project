import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ConversationAttempt,
  ConversationPriority,
  ConversationServiceStatus,
  ConversationWorkspace,
} from "@/lib/messages";
import { Prisma } from "@/lib/generated/prisma/client";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "message-workspaces.json");

type WorkspaceStore = {
  items: Record<string, ConversationWorkspace>;
};

let writeQueue = Promise.resolve();
let prismaBootstrapPromise: Promise<void> | null = null;

function shouldUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function nowIso() {
  return new Date().toISOString();
}

function defaultWorkspace(conversationKey: string): ConversationWorkspace {
  return {
    conversationKey,
    priority: "normal",
    serviceStatus: "fila",
    tags: [],
    pinnedNote: "",
    attempts: [],
    updatedAt: nowIso(),
  };
}

function normalizeWorkspace(conversationKey: string, workspace: Partial<ConversationWorkspace> | undefined) {
  const base = defaultWorkspace(conversationKey);
  return {
    ...base,
    ...workspace,
    conversationKey,
    priority: workspace?.priority ?? base.priority,
    serviceStatus: workspace?.serviceStatus ?? base.serviceStatus,
    tags: Array.isArray(workspace?.tags) ? workspace.tags : base.tags,
    attempts: Array.isArray(workspace?.attempts) ? workspace.attempts : base.attempts,
    pinnedNote: workspace?.pinnedNote ?? base.pinnedNote,
    updatedAt: workspace?.updatedAt ?? base.updatedAt,
  } satisfies ConversationWorkspace;
}

async function ensureFileStore() {
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.mkdir(STORE_DIR, { recursive: true });
    const initial: WorkspaceStore = { items: {} };
    await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readFileStore() {
  await ensureFileStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as WorkspaceStore;
    return parsed?.items ? parsed : { items: {} };
  } catch {
    const fallback: WorkspaceStore = { items: {} };
    await fs.writeFile(STORE_FILE, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

async function mutateFileStore(mutator: (store: WorkspaceStore) => WorkspaceStore | Promise<WorkspaceStore>) {
  writeQueue = writeQueue.then(async () => {
    const current = await readFileStore();
    const next = await mutator(current);
    await fs.writeFile(STORE_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  await writeQueue;
  return readFileStore();
}

async function ensurePrismaStore() {
  if (prismaBootstrapPromise) {
    await prismaBootstrapPromise;
    return;
  }

  prismaBootstrapPromise = (async () => {
    const prisma = getPrismaClient() as any;
    const count = await prisma.messageWorkspaceRecord.count();
    if (count > 0) return;

    let entries: [string, ConversationWorkspace][] = [];
    try {
      const legacy = await readFileStore();
      entries = Object.entries(legacy.items);
    } catch {
      return;
    }
    for (const [key, workspace] of entries) {
      const normalized = normalizeWorkspace(key, workspace);
      await prisma.messageWorkspaceRecord.upsert({
        where: { conversationKey: key },
        update: {
          priority: normalized.priority,
          serviceStatus: normalized.serviceStatus,
          tags: normalized.tags,
          pinnedNote: normalized.pinnedNote,
          attempts: normalized.attempts as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(normalized.updatedAt),
        },
        create: {
          conversationKey: key,
          priority: normalized.priority,
          serviceStatus: normalized.serviceStatus,
          tags: normalized.tags,
          pinnedNote: normalized.pinnedNote,
          attempts: normalized.attempts as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(normalized.updatedAt),
        },
      });
    }
  })();

  await prismaBootstrapPromise;
}

function mapPrismaWorkspace(record: {
  conversationKey: string;
  priority: string;
  serviceStatus: string;
  tags: string[];
  pinnedNote: string;
  attempts: unknown;
  updatedAt: Date;
}): ConversationWorkspace {
  return normalizeWorkspace(record.conversationKey, {
    conversationKey: record.conversationKey,
    priority: record.priority as ConversationPriority,
    serviceStatus: record.serviceStatus as ConversationServiceStatus,
    tags: record.tags,
    attempts: Array.isArray(record.attempts) ? (record.attempts as ConversationAttempt[]) : [],
    pinnedNote: record.pinnedNote,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function buildConversationWorkspaceKey(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function getMessageWorkspace(conversationKey: string) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const record = await prisma.messageWorkspaceRecord.findUnique({ where: { conversationKey } });
    return record ? mapPrismaWorkspace(record) : defaultWorkspace(conversationKey);
  }

  const store = await readFileStore();
  return normalizeWorkspace(conversationKey, store.items[conversationKey]);
}

export async function getMessageWorkspaces(conversationKeys: string[]) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const records = await prisma.messageWorkspaceRecord.findMany({
      where: { conversationKey: { in: conversationKeys } },
    });
    const mapped = new Map<string, ConversationWorkspace>(
      records.map((record: any) => [record.conversationKey, mapPrismaWorkspace(record)]),
    );
    const result: Record<string, ConversationWorkspace> = {};
    for (const key of conversationKeys) {
      result[key] = mapped.get(key) ?? defaultWorkspace(key);
    }
    return result;
  }

  const store = await readFileStore();
  const result: Record<string, ConversationWorkspace> = {};
  for (const key of conversationKeys) {
    result[key] = normalizeWorkspace(key, store.items[key]);
  }
  return result;
}

export async function updateMessageWorkspace(
  conversationKey: string,
  payload: {
    priority?: ConversationPriority;
    serviceStatus?: ConversationServiceStatus;
    tags?: string[];
    pinnedNote?: string;
  },
) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const current = await getMessageWorkspace(conversationKey);
    const updated = await prisma.messageWorkspaceRecord.upsert({
      where: { conversationKey },
      update: {
        priority: payload.priority ?? current.priority,
        serviceStatus: payload.serviceStatus ?? current.serviceStatus,
        tags: payload.tags ?? current.tags,
        pinnedNote: payload.pinnedNote ?? current.pinnedNote,
      },
      create: {
        conversationKey,
        priority: payload.priority ?? current.priority,
        serviceStatus: payload.serviceStatus ?? current.serviceStatus,
        tags: payload.tags ?? current.tags,
        pinnedNote: payload.pinnedNote ?? current.pinnedNote,
        attempts: current.attempts as unknown as Prisma.InputJsonValue,
      },
    });
    return mapPrismaWorkspace(updated);
  }

  const nextStore = await mutateFileStore((store) => {
    const current = normalizeWorkspace(conversationKey, store.items[conversationKey]);
    store.items[conversationKey] = {
      ...current,
      priority: payload.priority ?? current.priority,
      serviceStatus: payload.serviceStatus ?? current.serviceStatus,
      tags: payload.tags ?? current.tags,
      pinnedNote: payload.pinnedNote ?? current.pinnedNote,
      updatedAt: nowIso(),
    };
    return store;
  });

  return normalizeWorkspace(conversationKey, nextStore.items[conversationKey]);
}

export async function addWorkspaceAttempt(conversationKey: string, attempt: ConversationAttempt) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const current = await getMessageWorkspace(conversationKey);
    const attempts = [attempt, ...current.attempts].slice(0, 50);
    const updated = await prisma.messageWorkspaceRecord.upsert({
      where: { conversationKey },
      update: {
        attempts: attempts as unknown as Prisma.InputJsonValue,
      },
      create: {
        conversationKey,
        priority: current.priority,
        serviceStatus: current.serviceStatus,
        tags: current.tags,
        pinnedNote: current.pinnedNote,
        attempts: attempts as unknown as Prisma.InputJsonValue,
      },
    });
    return mapPrismaWorkspace(updated);
  }

  const nextStore = await mutateFileStore((store) => {
    const current = normalizeWorkspace(conversationKey, store.items[conversationKey]);
    store.items[conversationKey] = {
      ...current,
      attempts: [attempt, ...current.attempts].slice(0, 50),
      updatedAt: nowIso(),
    };
    return store;
  });

  return normalizeWorkspace(conversationKey, nextStore.items[conversationKey]);
}
