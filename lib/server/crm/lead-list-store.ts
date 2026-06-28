import { promises as fs } from "node:fs";
import { seedState, type LeadList } from "@/lib/crm";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { DATA_DIR } from "@/lib/server/crm/shared";

const LEAD_LIST_FILE = `${DATA_DIR}\\lead-lists.json`;
let leadListWriteQueue = Promise.resolve();
let prismaBootstrapPromise: Promise<void> | null = null;

function shouldUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureLeadListFileStore() {
  try {
    await fs.access(LEAD_LIST_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LEAD_LIST_FILE, JSON.stringify(seedState().leadLists, null, 2), "utf8");
  }
}

async function readLeadListFileStore() {
  await ensureLeadListFileStore();
  const raw = await fs.readFile(LEAD_LIST_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as LeadList[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("[lead-list-store] Arquivo de listas corrompido — retornando estado padrão.");
    const defaults = seedState().leadLists;
    await fs.writeFile(LEAD_LIST_FILE, JSON.stringify(defaults, null, 2), "utf8");
    return defaults;
  }
}

async function writeLeadListFileStore(next: LeadList[]) {
  leadListWriteQueue = leadListWriteQueue.then(() =>
    fs.writeFile(LEAD_LIST_FILE, JSON.stringify(next, null, 2), "utf8")
  );
  await leadListWriteQueue;
}

async function ensureLeadListPrismaStore() {
  if (prismaBootstrapPromise) {
    await prismaBootstrapPromise;
    return;
  }

  prismaBootstrapPromise = (async () => {
    const prisma = getPrismaClient() as any;
    const count = await prisma.leadListRecord.count();
    if (count > 0) return;

    let defaults: Awaited<ReturnType<typeof readLeadListFileStore>>;
    try {
      defaults = await readLeadListFileStore();
    } catch {
      return;
    }
    if (!defaults.length) return;

    for (const item of defaults) {
      await prisma.leadListRecord.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          description: item.description,
          color: item.color,
          leadIds: item.leadIds,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
        create: {
          id: item.id,
          name: item.name,
          description: item.description,
          color: item.color,
          leadIds: item.leadIds,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        },
      });
    }
  })();

  await prismaBootstrapPromise;
}

function mapRecordToLeadList(record: {
  id: string;
  name: string;
  description: string;
  color: string;
  leadIds: string[];
  createdAt: Date;
  updatedAt: Date;
}): LeadList {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    color: record.color as LeadList["color"],
    leadIds: record.leadIds,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function ensureLeadListStore() {
  if (shouldUsePrisma()) {
    await ensureLeadListPrismaStore();
    return;
  }
  await ensureLeadListFileStore();
}

export async function readLeadListStore() {
  if (shouldUsePrisma()) {
    await ensureLeadListPrismaStore();
    const prisma = getPrismaClient() as any;
    const items = await prisma.leadListRecord.findMany({ orderBy: { updatedAt: "desc" } });
    return items.map(mapRecordToLeadList);
  }
  return readLeadListFileStore();
}

export async function writeLeadListStore(next: LeadList[]) {
  if (shouldUsePrisma()) {
    await ensureLeadListPrismaStore();
    const prisma = getPrismaClient() as any;
    await prisma.$transaction([
      prisma.leadListRecord.deleteMany(),
      ...next.map((item) =>
        prisma.leadListRecord.create({
          data: {
            id: item.id,
            name: item.name,
            description: item.description,
            color: item.color,
            leadIds: item.leadIds,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          },
        }),
      ),
    ]);
    return;
  }
  await writeLeadListFileStore(next);
}
