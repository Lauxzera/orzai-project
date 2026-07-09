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
    throw new Error("Nenhuma URL de banco foi configurada.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    console.log("Iniciando migração de ScheduledFollowUp...");

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FollowUpStatus') THEN
          CREATE TYPE "public"."FollowUpStatus" AS ENUM ('PENDING', 'CANCELLED');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."ScheduledFollowUp" (
        "id" TEXT NOT NULL,
        "leadId" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "scheduledFor" TIMESTAMP(3) NOT NULL,
        "status" "public"."FollowUpStatus" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ScheduledFollowUp_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS "ScheduledFollowUp_leadId_idx" ON "public"."ScheduledFollowUp"("leadId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "ScheduledFollowUp_departmentId_idx" ON "public"."ScheduledFollowUp"("departmentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "ScheduledFollowUp_status_idx" ON "public"."ScheduledFollowUp"("status");`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ScheduledFollowUp_leadId_fkey'
        ) THEN
          ALTER TABLE "public"."ScheduledFollowUp" ADD CONSTRAINT "ScheduledFollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ScheduledFollowUp_departmentId_fkey'
        ) THEN
          ALTER TABLE "public"."ScheduledFollowUp" ADD CONSTRAINT "ScheduledFollowUp_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    console.log("Migração de ScheduledFollowUp concluída com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-followup-schema] erro", error);
  process.exitCode = 1;
});
