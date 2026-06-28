import { promises as fs } from "node:fs";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { AUDIT_FILE, DATA_DIR, uid } from "@/lib/server/crm/shared";
import type { AdminAuditEntry, SessionUser } from "@/lib/server/crm/types";

let auditWriteQueue = Promise.resolve();
let prismaBootstrapPromise: Promise<void> | null = null;

function shouldUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureAdminAuditFileStore() {
  try {
    await fs.access(AUDIT_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(AUDIT_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

async function readAdminAuditFileStore() {
  await ensureAdminAuditFileStore();
  const raw = await fs.readFile(AUDIT_FILE, "utf8");
  return JSON.parse(raw) as AdminAuditEntry[];
}

async function mutateAdminAuditFileStore(
  mutator: (entries: AdminAuditEntry[]) => AdminAuditEntry[] | Promise<AdminAuditEntry[]>,
) {
  auditWriteQueue = auditWriteQueue.then(async () => {
    const current = await readAdminAuditFileStore();
    const next = await mutator(current);
    await fs.writeFile(AUDIT_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  await auditWriteQueue;
  return readAdminAuditFileStore();
}

async function ensureAdminAuditPrismaStore() {
  if (prismaBootstrapPromise) {
    await prismaBootstrapPromise;
    return;
  }

  prismaBootstrapPromise = (async () => {
    const prisma = getPrismaClient() as any;
    const count = await prisma.adminAuditRecord.count();
    if (count > 0) return;

    let legacy: AdminAuditEntry[] = [];
    try {
      legacy = await readAdminAuditFileStore();
    } catch {
      return;
    }
    if (!legacy.length) return;

    for (const entry of legacy) {
      await prisma.adminAuditRecord.upsert({
        where: { id: entry.id },
        update: {
          actorId: entry.actorId,
          actorName: entry.actorName,
          action: entry.action,
          targetUserId: entry.targetUserId,
          targetUserName: entry.targetUserName,
          details: entry.details,
          changeTypes: entry.changeTypes ?? undefined,
          createdAt: new Date(entry.createdAt),
        },
        create: {
          id: entry.id,
          actorId: entry.actorId,
          actorName: entry.actorName,
          action: entry.action,
          targetUserId: entry.targetUserId,
          targetUserName: entry.targetUserName,
          details: entry.details,
          changeTypes: entry.changeTypes ?? undefined,
          createdAt: new Date(entry.createdAt),
        },
      });
    }
  })();

  await prismaBootstrapPromise;
}

function mapAuditRecord(record: {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetUserId: string;
  targetUserName: string;
  details: string;
  changeTypes: unknown;
  createdAt: Date;
}): AdminAuditEntry {
  return {
    id: record.id,
    actorId: record.actorId,
    actorName: record.actorName,
    action: record.action as AdminAuditEntry["action"],
    targetUserId: record.targetUserId,
    targetUserName: record.targetUserName,
    details: record.details,
    changeTypes: Array.isArray(record.changeTypes) ? (record.changeTypes as AdminAuditEntry["changeTypes"]) : undefined,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function ensureAdminAuditStore() {
  if (shouldUsePrisma()) {
    await ensureAdminAuditPrismaStore();
    return;
  }
  await ensureAdminAuditFileStore();
}

export async function readAdminAuditStore() {
  if (shouldUsePrisma()) {
    await ensureAdminAuditPrismaStore();
    const prisma = getPrismaClient() as any;
    const entries = await prisma.adminAuditRecord.findMany({ orderBy: { createdAt: "desc" } });
    return entries.map(mapAuditRecord);
  }
  return readAdminAuditFileStore();
}

export async function mutateAdminAuditStore(
  mutator: (entries: AdminAuditEntry[]) => AdminAuditEntry[] | Promise<AdminAuditEntry[]>,
) {
  if (shouldUsePrisma()) {
    await ensureAdminAuditPrismaStore();
    const current = await readAdminAuditStore();
    const next = await mutator(current);
    const prisma = getPrismaClient() as any;
    await prisma.$transaction([
      prisma.adminAuditRecord.deleteMany(),
      ...next.map((entry) =>
        prisma.adminAuditRecord.create({
          data: {
            id: entry.id,
            actorId: entry.actorId,
            actorName: entry.actorName,
            action: entry.action,
            targetUserId: entry.targetUserId,
            targetUserName: entry.targetUserName,
            details: entry.details,
            changeTypes: entry.changeTypes ?? undefined,
            createdAt: new Date(entry.createdAt),
          },
        }),
      ),
    ]);
    return readAdminAuditStore();
  }
  return mutateAdminAuditFileStore(mutator);
}

export async function appendAdminAuditEntry({
  actor,
  action,
  targetUserId,
  targetUserName,
  details,
  changeTypes,
}: {
  actor: SessionUser;
  action: AdminAuditEntry["action"];
  targetUserId: string;
  targetUserName: string;
  details: string;
  changeTypes?: AdminAuditEntry["changeTypes"];
}) {
  const entry: AdminAuditEntry = {
    id: uid("audit"),
    actorId: actor.id,
    actorName: actor.name,
    action,
    targetUserId,
    targetUserName,
    details,
    changeTypes,
    createdAt: new Date().toISOString(),
  };

  await mutateAdminAuditStore((entries) => [entry, ...entries].slice(0, 200));
}
