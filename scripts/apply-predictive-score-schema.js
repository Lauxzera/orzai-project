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
    throw new Error("Nenhuma URL de banco foi configurada para aplicar o schema do score preditivo.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(`
      ALTER TABLE "public"."Lead"
      ADD COLUMN IF NOT EXISTS "predictiveScore" INTEGER,
      ADD COLUMN IF NOT EXISTS "predictiveScoreConfidence" TEXT,
      ADD COLUMN IF NOT EXISTS "predictiveScoreReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS "predictiveScoreRisks" TEXT[] DEFAULT ARRAY[]::TEXT[],
      ADD COLUMN IF NOT EXISTS "predictiveScoreSource" TEXT,
      ADD COLUMN IF NOT EXISTS "predictiveScoreUpdatedAt" TIMESTAMP(3)
    `);

    await client.query(`
      UPDATE "public"."Lead"
      SET
        "predictiveScoreReasons" = COALESCE("predictiveScoreReasons", ARRAY[]::TEXT[]),
        "predictiveScoreRisks" = COALESCE("predictiveScoreRisks", ARRAY[]::TEXT[])
      WHERE "predictiveScoreReasons" IS NULL
         OR "predictiveScoreRisks" IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "Lead_predictiveScoreUpdatedAt_idx"
      ON "public"."Lead"("predictiveScoreUpdatedAt")
    `);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-predictive-score-schema] erro", error);
  process.exitCode = 1;
});
