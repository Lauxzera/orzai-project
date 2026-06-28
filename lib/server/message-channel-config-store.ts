import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { Prisma } from "@/lib/generated/prisma/client";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";

export type MessageChannelConfig = {
  id: string;
  provider: "meta";
  mode: "cloud-api";
  embeddedSignupEnabled: boolean;
  coexistenceEnabled: boolean;
  metaAppId: string;
  metaAppConfigId: string;
  redirectUri: string;
  onboardingStatus: "not-started" | "ready" | "awaiting-callback" | "callback-received" | "linked";
  lastEventType: string | null;
  lastEventPayload: Record<string, unknown> | null;
  lastCode: string | null;
  lastWabaId: string | null;
  lastPhoneNumberId: string | null;
  lastBusinessAccountId: string | null;
  linkedAccessToken: string | null;
  linkedTokenType: string | null;
  linkedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FileStore = {
  config: MessageChannelConfig;
};

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "message-channel-config.json");

let writeQueue = Promise.resolve();
let prismaBootstrapPromise: Promise<void> | null = null;

function shouldUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function nowIso() {
  return new Date().toISOString();
}

function envString(name: string) {
  return (process.env[name] ?? "").trim();
}

export function defaultMessageChannelConfig(): MessageChannelConfig {
  const appId = envString("META_EMBEDDED_SIGNUP_APP_ID");
  const configId = envString("META_EMBEDDED_SIGNUP_CONFIG_ID");
  // /auth/meta/callback is the canonical OAuth redirect URI registered in Meta Developers.
  const redirectUri =
    envString("META_EMBEDDED_SIGNUP_REDIRECT_URI") ||
    envString("APP_URL").replace(/\/$/, "") + "/auth/meta/callback";

  const enabled = ["true", "1", "yes", "sim"].includes(envString("META_EMBEDDED_SIGNUP_ENABLED").toLowerCase());
  const coexistence = ["true", "1", "yes", "sim"].includes(envString("META_COEXISTENCE_ENABLED").toLowerCase());

  // If no APP_URL is set, redirectUri resolves to "/auth/meta/callback" — treat as unconfigured.
  return {
    id: "meta",
    provider: "meta",
    mode: "cloud-api",
    embeddedSignupEnabled: enabled,
    coexistenceEnabled: coexistence,
    metaAppId: appId,
    metaAppConfigId: configId,
    redirectUri: redirectUri === "/auth/meta/callback" ? "" : redirectUri,
    onboardingStatus: enabled && appId && configId ? "ready" : "not-started",
    lastEventType: null,
    lastEventPayload: null,
    lastCode: null,
    lastWabaId: null,
    lastPhoneNumberId: null,
    lastBusinessAccountId: null,
    linkedAccessToken: null,
    linkedTokenType: null,
    linkedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function normalizeConfig(input: Partial<MessageChannelConfig> | null | undefined): MessageChannelConfig {
  const base = defaultMessageChannelConfig();
  return {
    ...base,
    ...input,
    id: "meta",
    provider: "meta",
    mode: "cloud-api",
    metaAppId: input?.metaAppId || base.metaAppId,
    metaAppConfigId: input?.metaAppConfigId || base.metaAppConfigId,
    redirectUri: input?.redirectUri || base.redirectUri,
    embeddedSignupEnabled:
      input?.embeddedSignupEnabled === true ? true : base.embeddedSignupEnabled || Boolean(input?.embeddedSignupEnabled),
    coexistenceEnabled:
      input?.coexistenceEnabled === true ? true : base.coexistenceEnabled || Boolean(input?.coexistenceEnabled),
    onboardingStatus: (input?.onboardingStatus as MessageChannelConfig["onboardingStatus"]) ?? base.onboardingStatus,
    lastEventType: input?.lastEventType ?? null,
    lastEventPayload:
      input?.lastEventPayload && typeof input.lastEventPayload === "object"
        ? input.lastEventPayload
        : null,
    lastCode: input?.lastCode ?? null,
    lastWabaId: input?.lastWabaId ?? null,
    lastPhoneNumberId: input?.lastPhoneNumberId ?? null,
    lastBusinessAccountId: input?.lastBusinessAccountId ?? null,
    linkedAccessToken: input?.linkedAccessToken ?? null,
    linkedTokenType: input?.linkedTokenType ?? null,
    linkedAt: input?.linkedAt ?? null,
    createdAt: input?.createdAt ?? base.createdAt,
    updatedAt: input?.updatedAt ?? base.updatedAt,
  };
}

async function ensureFileStore() {
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.mkdir(STORE_DIR, { recursive: true });
    const initial: FileStore = { config: defaultMessageChannelConfig() };
    await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readFileStore() {
  await ensureFileStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as Partial<FileStore>;
    return {
      config: normalizeConfig(parsed.config),
    } satisfies FileStore;
  } catch {
    const fallback: FileStore = { config: defaultMessageChannelConfig() };
    await fs.writeFile(STORE_FILE, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

async function mutateFileStore(mutator: (store: FileStore) => FileStore | Promise<FileStore>) {
  writeQueue = writeQueue.then(async () => {
    const current = await readFileStore();
    const next = await mutator(current);
    await fs.writeFile(STORE_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  await writeQueue;
  return readFileStore();
}

function mapPrismaRecord(record: {
  id: string;
  provider: string;
  mode: string;
  embeddedSignupEnabled: boolean;
  coexistenceEnabled: boolean;
  metaAppId: string | null;
  metaAppConfigId: string | null;
  redirectUri: string | null;
  onboardingStatus: string;
  lastEventType: string | null;
  lastEventPayload: unknown;
  lastCode: string | null;
  lastWabaId: string | null;
  lastPhoneNumberId: string | null;
  lastBusinessAccountId: string | null;
  linkedAccessToken: string | null;
  linkedTokenType: string | null;
  linkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MessageChannelConfig {
  return normalizeConfig({
    id: record.id,
    provider: "meta",
    mode: "cloud-api",
    embeddedSignupEnabled: record.embeddedSignupEnabled,
    coexistenceEnabled: record.coexistenceEnabled,
    metaAppId: record.metaAppId ?? "",
    metaAppConfigId: record.metaAppConfigId ?? "",
    redirectUri: record.redirectUri ?? "",
    onboardingStatus: record.onboardingStatus as MessageChannelConfig["onboardingStatus"],
    lastEventType: record.lastEventType,
    lastEventPayload:
      record.lastEventPayload && typeof record.lastEventPayload === "object"
        ? (record.lastEventPayload as Record<string, unknown>)
        : null,
    lastCode: record.lastCode,
    lastWabaId: record.lastWabaId,
    lastPhoneNumberId: record.lastPhoneNumberId,
    lastBusinessAccountId: record.lastBusinessAccountId,
    linkedAccessToken: record.linkedAccessToken,
    linkedTokenType: record.linkedTokenType,
    linkedAt: record.linkedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

async function ensurePrismaStore() {
  if (prismaBootstrapPromise) {
    await prismaBootstrapPromise;
    return;
  }

  prismaBootstrapPromise = (async () => {
    const prisma = getPrismaClient() as any;
    const count = await prisma.messageChannelConfigRecord.count();
    if (count > 0) return;

    let config: MessageChannelConfig;
    try {
      const legacy = await readFileStore();
      config = normalizeConfig(legacy.config);
    } catch {
      config = defaultMessageChannelConfig();
    }

    await prisma.messageChannelConfigRecord.create({
      data: {
        id: config.id,
        provider: config.provider,
        mode: config.mode,
        embeddedSignupEnabled: config.embeddedSignupEnabled,
        coexistenceEnabled: config.coexistenceEnabled,
        metaAppId: config.metaAppId || null,
        metaAppConfigId: config.metaAppConfigId || null,
        redirectUri: config.redirectUri || null,
        onboardingStatus: config.onboardingStatus,
        lastEventType: config.lastEventType,
        lastEventPayload: config.lastEventPayload as Prisma.InputJsonValue | null,
        lastCode: config.lastCode,
        lastWabaId: config.lastWabaId,
        lastPhoneNumberId: config.lastPhoneNumberId,
        lastBusinessAccountId: config.lastBusinessAccountId,
        linkedAccessToken: config.linkedAccessToken,
        linkedTokenType: config.linkedTokenType,
        linkedAt: config.linkedAt ? new Date(config.linkedAt) : null,
        createdAt: new Date(config.createdAt),
        updatedAt: new Date(config.updatedAt),
      },
    });
  })();

  await prismaBootstrapPromise;
}

export async function getMessageChannelConfig() {
  if (shouldUsePrisma()) {
    try {
      await ensurePrismaStore();
      const prisma = getPrismaClient() as any;
      const record = await prisma.messageChannelConfigRecord.findUnique({ where: { id: "meta" } });
      if (!record) return defaultMessageChannelConfig();

      const normalized = mapPrismaRecord(record);
      const base = defaultMessageChannelConfig();
      const shouldHydrateFromEnv =
        normalized.metaAppId !== base.metaAppId ||
        normalized.metaAppConfigId !== base.metaAppConfigId ||
        normalized.redirectUri !== base.redirectUri ||
        normalized.embeddedSignupEnabled !== base.embeddedSignupEnabled ||
        normalized.coexistenceEnabled !== base.coexistenceEnabled;

      if (shouldHydrateFromEnv) {
        await prisma.messageChannelConfigRecord.update({
          where: { id: "meta" },
          data: {
            metaAppId: normalized.metaAppId || null,
            metaAppConfigId: normalized.metaAppConfigId || null,
            redirectUri: normalized.redirectUri || null,
            embeddedSignupEnabled: normalized.embeddedSignupEnabled,
            coexistenceEnabled: normalized.coexistenceEnabled,
            onboardingStatus:
              normalized.onboardingStatus === "not-started" &&
              normalized.embeddedSignupEnabled &&
              normalized.metaAppId &&
              normalized.metaAppConfigId
                ? "ready"
                : normalized.onboardingStatus,
          },
        });
      }

      return normalized;
    } catch (error) {
      console.error("[message-channel-config] fallback para arquivo local em getMessageChannelConfig", error);
    }
  }

  return (await readFileStore()).config;
}

export async function updateMessageChannelConfig(
  payload: Partial<
    Pick<
      MessageChannelConfig,
      | "embeddedSignupEnabled"
      | "coexistenceEnabled"
      | "metaAppId"
      | "metaAppConfigId"
      | "redirectUri"
      | "onboardingStatus"
      | "lastEventType"
      | "lastEventPayload"
      | "lastCode"
      | "lastWabaId"
      | "lastPhoneNumberId"
      | "lastBusinessAccountId"
      | "linkedAccessToken"
      | "linkedTokenType"
      | "linkedAt"
    >
  >,
) {
  if (shouldUsePrisma()) {
    try {
      await ensurePrismaStore();
      const prisma = getPrismaClient() as any;
      const current = await getMessageChannelConfig();
      const updated = await prisma.messageChannelConfigRecord.upsert({
        where: { id: "meta" },
        update: {
          embeddedSignupEnabled: payload.embeddedSignupEnabled ?? current.embeddedSignupEnabled,
          coexistenceEnabled: payload.coexistenceEnabled ?? current.coexistenceEnabled,
          metaAppId: (payload.metaAppId ?? current.metaAppId) || null,
          metaAppConfigId: (payload.metaAppConfigId ?? current.metaAppConfigId) || null,
          redirectUri: (payload.redirectUri ?? current.redirectUri) || null,
          onboardingStatus: payload.onboardingStatus ?? current.onboardingStatus,
          lastEventType: payload.lastEventType ?? current.lastEventType,
          lastEventPayload:
            (payload.lastEventPayload as Prisma.InputJsonValue | undefined) ??
            (current.lastEventPayload as Prisma.InputJsonValue | null),
          lastCode: payload.lastCode ?? current.lastCode,
          lastWabaId: payload.lastWabaId ?? current.lastWabaId,
          lastPhoneNumberId: payload.lastPhoneNumberId ?? current.lastPhoneNumberId,
          lastBusinessAccountId: payload.lastBusinessAccountId ?? current.lastBusinessAccountId,
          linkedAccessToken: payload.linkedAccessToken ?? current.linkedAccessToken,
          linkedTokenType: payload.linkedTokenType ?? current.linkedTokenType,
          linkedAt: payload.linkedAt ? new Date(payload.linkedAt) : current.linkedAt ? new Date(current.linkedAt) : null,
        },
        create: {
          id: "meta",
          provider: "meta",
          mode: "cloud-api",
          embeddedSignupEnabled: payload.embeddedSignupEnabled ?? current.embeddedSignupEnabled,
          coexistenceEnabled: payload.coexistenceEnabled ?? current.coexistenceEnabled,
          metaAppId: (payload.metaAppId ?? current.metaAppId) || null,
          metaAppConfigId: (payload.metaAppConfigId ?? current.metaAppConfigId) || null,
          redirectUri: (payload.redirectUri ?? current.redirectUri) || null,
          onboardingStatus: payload.onboardingStatus ?? current.onboardingStatus,
          lastEventType: payload.lastEventType ?? current.lastEventType,
          lastEventPayload:
            (payload.lastEventPayload as Prisma.InputJsonValue | undefined) ??
            (current.lastEventPayload as Prisma.InputJsonValue | null),
          lastCode: payload.lastCode ?? current.lastCode,
          lastWabaId: payload.lastWabaId ?? current.lastWabaId,
          lastPhoneNumberId: payload.lastPhoneNumberId ?? current.lastPhoneNumberId,
          lastBusinessAccountId: payload.lastBusinessAccountId ?? current.lastBusinessAccountId,
          linkedAccessToken: payload.linkedAccessToken ?? current.linkedAccessToken,
          linkedTokenType: payload.linkedTokenType ?? current.linkedTokenType,
          linkedAt: payload.linkedAt ? new Date(payload.linkedAt) : current.linkedAt ? new Date(current.linkedAt) : null,
        },
      });
      return mapPrismaRecord(updated);
    } catch (error) {
      console.error("[message-channel-config] fallback para arquivo local em updateMessageChannelConfig", error);
    }
  }

  const store = await mutateFileStore((current) => ({
    config: normalizeConfig({
      ...current.config,
      ...payload,
      updatedAt: nowIso(),
    }),
  }));
  return store.config;
}
