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
    throw new Error("Nenhuma URL de banco foi configurada para aplicar o schema de ChannelIntegration.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."ChannelIntegration" (
          "id" TEXT NOT NULL,
          "provider" TEXT NOT NULL,
          "accessToken" TEXT NOT NULL,
          "providerAccountId" TEXT NOT NULL,
          "departmentId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "ChannelIntegration_pkey" PRIMARY KEY ("id")
      );
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'ChannelIntegration_departmentId_fkey'
        ) THEN
          ALTER TABLE "public"."ChannelIntegration" ADD CONSTRAINT "ChannelIntegration_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "ChannelIntegration_departmentId_idx" ON "public"."ChannelIntegration"("departmentId");
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "ChannelIntegration_provider_idx" ON "public"."ChannelIntegration"("provider");
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "ChannelIntegration_providerAccountId_idx" ON "public"."ChannelIntegration"("providerAccountId");
    `);

    console.log("Migration for ChannelIntegration completed successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-channel-integration-schema] erro", error);
  process.exitCode = 1;
});
