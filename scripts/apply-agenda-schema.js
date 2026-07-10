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
    console.log("Iniciando migração da Agenda (Professional, TimeBlock, Appointment.professionalId/notes)...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."Professional" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "userId" TEXT,
        "businessHours" JSONB,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS "Professional_departmentId_idx" ON "public"."Professional"("departmentId");`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Professional_departmentId_fkey'
        ) THEN
          ALTER TABLE "public"."Professional" ADD CONSTRAINT "Professional_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."TimeBlock" (
        "id" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "professionalId" TEXT,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3) NOT NULL,
        "reason" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS "TimeBlock_departmentId_startTime_idx" ON "public"."TimeBlock"("departmentId", "startTime");`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'TimeBlock_departmentId_fkey'
        ) THEN
          ALTER TABLE "public"."TimeBlock" ADD CONSTRAINT "TimeBlock_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'TimeBlock_professionalId_fkey'
        ) THEN
          ALTER TABLE "public"."TimeBlock" ADD CONSTRAINT "TimeBlock_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`ALTER TABLE "public"."Appointment" ADD COLUMN IF NOT EXISTS "professionalId" TEXT;`);
    await client.query(`ALTER TABLE "public"."Appointment" ADD COLUMN IF NOT EXISTS "notes" TEXT;`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Appointment_professionalId_idx" ON "public"."Appointment"("professionalId");`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Appointment_professionalId_fkey'
        ) THEN
          ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    // Backfill best-effort: copia a anamnese registrada em LeadHistory ("Consulta agendada")
    // para Appointment.notes quando o registro do histórico foi criado até 2 minutos
    // após o appointment (mesma transação de criação via executeBookAppointment).
    const backfill = await client.query(`
      UPDATE "public"."Appointment" a
      SET "notes" = (
        SELECT lh."note"
        FROM "public"."LeadHistory" lh
        WHERE lh."leadId" = a."leadId"
          AND lh."action" = 'Consulta agendada'
          AND lh."note" IS NOT NULL
          AND lh."createdAt" BETWEEN a."createdAt" - INTERVAL '2 minutes' AND a."createdAt" + INTERVAL '2 minutes'
        ORDER BY lh."createdAt" ASC
        LIMIT 1
      )
      WHERE a."notes" IS NULL
        AND EXISTS (
          SELECT 1
          FROM "public"."LeadHistory" lh
          WHERE lh."leadId" = a."leadId"
            AND lh."action" = 'Consulta agendada'
            AND lh."note" IS NOT NULL
            AND lh."createdAt" BETWEEN a."createdAt" - INTERVAL '2 minutes' AND a."createdAt" + INTERVAL '2 minutes'
        );
    `);

    console.log(`Backfill de notes: ${backfill.rowCount} appointment(s) atualizados.`);
    console.log("Migração da Agenda concluída com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-agenda-schema] erro", error);
  process.exitCode = 1;
});
