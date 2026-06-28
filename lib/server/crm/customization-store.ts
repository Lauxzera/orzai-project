import { promises as fs } from "node:fs";
import { defaultCrmCustomizations, normalizeCrmCustomizations, type CrmCustomizations } from "@/lib/crm";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { DATA_DIR } from "@/lib/server/crm/shared";

const CUSTOMIZATION_FILE = `${DATA_DIR}\\crm-customizations.json`;
const CUSTOMIZATION_ROW_ID = "crm-default";
let customizationWriteQueue = Promise.resolve();
let prismaBootstrapPromise: Promise<void> | null = null;

function shouldUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureCustomizationFileStore() {
  try {
    await fs.access(CUSTOMIZATION_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CUSTOMIZATION_FILE, JSON.stringify(defaultCrmCustomizations, null, 2), "utf8");
  }
}

async function readCustomizationFileStore() {
  await ensureCustomizationFileStore();
  const raw = await fs.readFile(CUSTOMIZATION_FILE, "utf8");
  const parsed = JSON.parse(raw) as Partial<CrmCustomizations>;
  return normalizeCrmCustomizations(parsed);
}

async function writeCustomizationFileStore(next: CrmCustomizations) {
  const normalized = normalizeCrmCustomizations(next);
  customizationWriteQueue = customizationWriteQueue.then(() =>
    fs.writeFile(CUSTOMIZATION_FILE, JSON.stringify(normalized, null, 2), "utf8"),
  );
  await customizationWriteQueue;
  return normalized;
}

async function ensureCustomizationPrismaStore() {
  if (prismaBootstrapPromise) {
    await prismaBootstrapPromise;
    return;
  }

  prismaBootstrapPromise = (async () => {
    const prisma = getPrismaClient() as any;
    const exists = await prisma.crmCustomizationState.findUnique({ where: { id: CUSTOMIZATION_ROW_ID } });
    if (exists) return;

    let defaults: CrmCustomizations;
    try {
      defaults = await readCustomizationFileStore();
    } catch {
      defaults = defaultCrmCustomizations;
    }
    const normalized = normalizeCrmCustomizations(defaults);
    await prisma.crmCustomizationState.create({
      data: {
        id: CUSTOMIZATION_ROW_ID,
        courses: normalized.courses,
        courseSegmentsFormacao: normalized.courseSegments.formacao,
        courseSegmentsEspecializacao: normalized.courseSegments.especializacao,
        origins: normalized.origins,
        leadCaptureMethods: normalized.leadCaptureMethods,
        owners: normalized.owners,
      },
    });
  })();

  await prismaBootstrapPromise;
}

function mapCustomizationRecord(record: {
  courses: string[];
  courseSegmentsFormacao: string[];
  courseSegmentsEspecializacao: string[];
  origins: string[];
  leadCaptureMethods: string[];
  owners: string[];
}) {
  return normalizeCrmCustomizations({
    courses: record.courses,
    courseSegments: {
      formacao: record.courseSegmentsFormacao,
      especializacao: record.courseSegmentsEspecializacao,
    },
    origins: record.origins,
    leadCaptureMethods: record.leadCaptureMethods,
    owners: record.owners,
  });
}

export async function ensureCustomizationStore() {
  if (shouldUsePrisma()) {
    await ensureCustomizationPrismaStore();
    return;
  }
  await ensureCustomizationFileStore();
}

export async function readCustomizationStore() {
  if (shouldUsePrisma()) {
    await ensureCustomizationPrismaStore();
    const prisma = getPrismaClient() as any;
    const record = await prisma.crmCustomizationState.findUnique({ where: { id: CUSTOMIZATION_ROW_ID } });
    return record ? mapCustomizationRecord(record) : defaultCrmCustomizations;
  }
  return readCustomizationFileStore();
}

export async function writeCustomizationStore(next: CrmCustomizations) {
  const normalized = normalizeCrmCustomizations(next);
  if (shouldUsePrisma()) {
    await ensureCustomizationPrismaStore();
    const prisma = getPrismaClient() as any;
    await prisma.crmCustomizationState.upsert({
      where: { id: CUSTOMIZATION_ROW_ID },
      update: {
        courses: normalized.courses,
        courseSegmentsFormacao: normalized.courseSegments.formacao,
        courseSegmentsEspecializacao: normalized.courseSegments.especializacao,
        origins: normalized.origins,
        leadCaptureMethods: normalized.leadCaptureMethods,
        owners: normalized.owners,
      },
      create: {
        id: CUSTOMIZATION_ROW_ID,
        courses: normalized.courses,
        courseSegmentsFormacao: normalized.courseSegments.formacao,
        courseSegmentsEspecializacao: normalized.courseSegments.especializacao,
        origins: normalized.origins,
        leadCaptureMethods: normalized.leadCaptureMethods,
        owners: normalized.owners,
      },
    });
    return normalized;
  }
  return writeCustomizationFileStore(normalized);
}
