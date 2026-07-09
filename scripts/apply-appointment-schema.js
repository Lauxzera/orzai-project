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
    console.log("Iniciando migração de Agendamento Inteligente (Appointment)...");

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
          CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."Appointment" (
        "id" TEXT NOT NULL,
        "externalId" TEXT,
        "leadId" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3) NOT NULL,
        "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS "Appointment_leadId_idx" ON "public"."Appointment"("leadId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Appointment_departmentId_idx" ON "public"."Appointment"("departmentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Appointment_startTime_idx" ON "public"."Appointment"("startTime");`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Appointment_leadId_fkey'
        ) THEN
          ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Appointment_departmentId_fkey'
        ) THEN
          ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`ALTER TABLE "public"."Department" ADD COLUMN IF NOT EXISTS "businessHours" JSONB;`);

    console.log("Migração de Agendamento Inteligente concluída com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-appointment-schema] erro", error);
  process.exitCode = 1;
});
