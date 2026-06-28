import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { Prisma } from "@/lib/generated/prisma/client";
import type { MessageCampaign, MessageCampaignStatus } from "@/lib/messages";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

type CampaignStore = {
  campaigns: MessageCampaign[];
};

const RUNTIME_DIR = process.env.BELART_RUNTIME_DIR?.trim()
  ? path.resolve(process.env.BELART_RUNTIME_DIR)
  : path.join(process.env.LOCALAPPDATA ?? process.cwd(), "BelartCRM", "runtime");
const STORE_DIR = path.join(RUNTIME_DIR, "campaigns");
const STORE_FILE = path.join(STORE_DIR, "message-campaigns.json");

let writeQueue = Promise.resolve();
let prismaBootstrapPromise: Promise<void> | null = null;

function shouldUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function createEmptyStore(): CampaignStore {
  return { campaigns: [] };
}

async function ensureFileStore() {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

async function readFileStore() {
  await ensureFileStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignStore>;
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    } satisfies CampaignStore;
  } catch {
    console.error("[campaign-store] Arquivo de campanhas corrompido — retornando lista vazia.");
    const empty = createEmptyStore();
    await fs.writeFile(STORE_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function mutateFileStore(mutator: (store: CampaignStore) => CampaignStore | Promise<CampaignStore>) {
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
    const count = await prisma.messageCampaignRecord.count();
    if (count > 0) return;

    let legacy: Awaited<ReturnType<typeof readFileStore>>;
    try {
      legacy = await readFileStore();
    } catch {
      return;
    }
    for (const campaign of legacy.campaigns) {
      await prisma.messageCampaignRecord.upsert({
        where: { id: campaign.id },
        update: {
          title: campaign.title,
          messageTemplate: campaign.messageTemplate,
          delaySeconds: campaign.delaySeconds,
          status: campaign.status,
          createdAt: new Date(campaign.createdAt),
          updatedAt: new Date(campaign.updatedAt),
          createdByName: campaign.createdByName,
          startedAt: campaign.startedAt ? new Date(campaign.startedAt) : null,
          completedAt: campaign.completedAt ? new Date(campaign.completedAt) : null,
          nextDispatchAt: campaign.nextDispatchAt ? new Date(campaign.nextDispatchAt) : null,
          recipients: campaign.recipients as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: campaign.id,
          title: campaign.title,
          messageTemplate: campaign.messageTemplate,
          delaySeconds: campaign.delaySeconds,
          status: campaign.status,
          createdAt: new Date(campaign.createdAt),
          updatedAt: new Date(campaign.updatedAt),
          createdByName: campaign.createdByName,
          startedAt: campaign.startedAt ? new Date(campaign.startedAt) : null,
          completedAt: campaign.completedAt ? new Date(campaign.completedAt) : null,
          nextDispatchAt: campaign.nextDispatchAt ? new Date(campaign.nextDispatchAt) : null,
          recipients: campaign.recipients as unknown as Prisma.InputJsonValue,
        },
      });
    }
  })();

  await prismaBootstrapPromise;
}

function mapCampaignRecord(record: {
  id: string;
  title: string;
  messageTemplate: string;
  delaySeconds: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
  startedAt: Date | null;
  completedAt: Date | null;
  nextDispatchAt: Date | null;
  recipients: unknown;
}): MessageCampaign {
  const recipients = Array.isArray(record.recipients) ? (record.recipients as MessageCampaign["recipients"]) : [];
  return {
    id: record.id,
    title: record.title,
    messageTemplate: record.messageTemplate,
    delaySeconds: record.delaySeconds,
    status: record.status as MessageCampaignStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    createdByName: record.createdByName,
    templateConfig: recipients.find((recipient) => recipient.templateConfig)?.templateConfig,
    startedAt: record.startedAt?.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    nextDispatchAt: record.nextDispatchAt?.toISOString(),
    recipients,
  };
}

export async function listMessageCampaigns() {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const records = await prisma.messageCampaignRecord.findMany({ orderBy: { createdAt: "desc" } });
    return records.map(mapCampaignRecord);
  }

  const store = await readFileStore();
  return store.campaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function findMessageCampaign(campaignId: string) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const record = await prisma.messageCampaignRecord.findUnique({ where: { id: campaignId } });
    return record ? mapCampaignRecord(record) : null;
  }
  return (await readFileStore()).campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

export async function createMessageCampaign(campaign: MessageCampaign) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const created = await prisma.messageCampaignRecord.create({
      data: {
        id: campaign.id,
        title: campaign.title,
        messageTemplate: campaign.messageTemplate,
        delaySeconds: campaign.delaySeconds,
        status: campaign.status,
        createdAt: new Date(campaign.createdAt),
        updatedAt: new Date(campaign.updatedAt),
        createdByName: campaign.createdByName,
        startedAt: campaign.startedAt ? new Date(campaign.startedAt) : null,
        completedAt: campaign.completedAt ? new Date(campaign.completedAt) : null,
        nextDispatchAt: campaign.nextDispatchAt ? new Date(campaign.nextDispatchAt) : null,
        recipients: campaign.recipients as unknown as Prisma.InputJsonValue,
      },
    });
    return mapCampaignRecord(created);
  }

  const store = await mutateFileStore((current) => ({
    campaigns: [campaign, ...current.campaigns],
  }));
  return store.campaigns.find((item) => item.id === campaign.id) ?? campaign;
}

export async function updateMessageCampaign(
  campaignId: string,
  updater: (campaign: MessageCampaign) => MessageCampaign,
) {
  if (shouldUsePrisma()) {
    await ensurePrismaStore();
    const prisma = getPrismaClient() as any;
    const current = await findMessageCampaign(campaignId);
    if (!current) return null;
    const next = updater(current);
    const updated = await prisma.messageCampaignRecord.update({
      where: { id: campaignId },
      data: {
        title: next.title,
        messageTemplate: next.messageTemplate,
        delaySeconds: next.delaySeconds,
        status: next.status,
        createdByName: next.createdByName,
        createdAt: new Date(next.createdAt),
        updatedAt: new Date(next.updatedAt),
        startedAt: next.startedAt ? new Date(next.startedAt) : null,
        completedAt: next.completedAt ? new Date(next.completedAt) : null,
        nextDispatchAt: next.nextDispatchAt ? new Date(next.nextDispatchAt) : null,
        recipients: next.recipients as unknown as Prisma.InputJsonValue,
      },
    });
    return mapCampaignRecord(updated);
  }

  const store = await mutateFileStore((current) => ({
    campaigns: current.campaigns.map((campaign) => (campaign.id === campaignId ? updater(campaign) : campaign)),
  }));
  return store.campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

export async function updateMessageCampaignStatus(campaignId: string, status: MessageCampaignStatus) {
  return updateMessageCampaign(campaignId, (campaign) => ({
    ...campaign,
    status,
    updatedAt: new Date().toISOString(),
    startedAt: status === "running" && !campaign.startedAt ? new Date().toISOString() : campaign.startedAt,
    completedAt: status === "completed" ? new Date().toISOString() : status === "running" ? undefined : campaign.completedAt,
    nextDispatchAt:
      status === "running"
        ? campaign.nextDispatchAt ?? new Date().toISOString()
        : status === "completed" || status === "cancelled"
          ? undefined
          : campaign.nextDispatchAt,
  }));
}
