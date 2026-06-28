const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const connectionString =
    process.env.DIRECT_URL ||
    process.env.SUPABASE_DIRECT_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    throw new Error("Nenhuma URL de banco foi configurada para aplicar o schema do coexistence.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."MessageChannelConfigRecord" (
        "id" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "mode" TEXT NOT NULL,
        "embeddedSignupEnabled" BOOLEAN NOT NULL DEFAULT false,
        "coexistenceEnabled" BOOLEAN NOT NULL DEFAULT false,
        "metaAppId" TEXT,
        "metaAppConfigId" TEXT,
        "redirectUri" TEXT,
        "onboardingStatus" TEXT NOT NULL DEFAULT 'not-started',
        "lastEventType" TEXT,
        "lastEventPayload" JSONB,
        "lastCode" TEXT,
        "lastWabaId" TEXT,
        "lastPhoneNumberId" TEXT,
        "lastBusinessAccountId" TEXT,
        "linkedAccessToken" TEXT,
        "linkedTokenType" TEXT,
        "linkedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "MessageChannelConfigRecord_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "MessageChannelConfigRecord_provider_idx"
      ON "public"."MessageChannelConfigRecord"("provider")
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "MessageChannelConfigRecord_onboardingStatus_idx"
      ON "public"."MessageChannelConfigRecord"("onboardingStatus")
    `);

    await client.query(`
      ALTER TABLE "public"."MessageChannelConfigRecord"
      ADD COLUMN IF NOT EXISTS "linkedAccessToken" TEXT,
      ADD COLUMN IF NOT EXISTS "linkedTokenType" TEXT,
      ADD COLUMN IF NOT EXISTS "linkedAt" TIMESTAMP(3)
    `);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-coexistence-schema] erro", error);
  process.exitCode = 1;
});
