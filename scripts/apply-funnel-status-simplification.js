const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Mapa das 10 etapas antigas do funil para as 5 etapas novas (design "UI Amigavel").
// PERDIDO e REATIVAR_FUTURAMENTE viram AGUARDANDO_RETORNO: o novo funil nao tem
// mais um estado de "lead perdido" permanente, tudo volta para acompanhamento.
const STATUS_MAP = {
  NOVO_LEAD: "NOVO_LEAD",
  PRIMEIRO_CONTATO_FEITO: "EM_CONVERSA",
  INTERESSADO_NO_CURSO: "EM_CONVERSA",
  INFORMACOES_ENVIADAS: "EM_CONVERSA",
  AGUARDANDO_RETORNO: "AGUARDANDO_RETORNO",
  NEGOCIACAO_MATRICULA: "NEGOCIACAO",
  AGUARDANDO_PAGAMENTO: "NEGOCIACAO",
  MATRICULADO: "MATRICULADO",
  PERDIDO: "AGUARDANDO_RETORNO",
  REATIVAR_FUTURAMENTE: "AGUARDANDO_RETORNO",
};

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
    console.log("Iniciando simplificacao do FunnelStatus (10 -> 5 etapas)...");

    const before = await client.query(
      `SELECT "statusFunil"::text AS status, COUNT(*) AS total FROM "public"."Lead" GROUP BY "statusFunil" ORDER BY total DESC`
    );
    console.log("Distribuicao atual:", before.rows);

    await client.query("BEGIN");

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FunnelStatus_new') THEN
          CREATE TYPE "public"."FunnelStatus_new" AS ENUM ('NOVO_LEAD', 'EM_CONVERSA', 'AGUARDANDO_RETORNO', 'NEGOCIACAO', 'MATRICULADO');
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "statusFunilNew" "public"."FunnelStatus_new";
    `);

    for (const [oldValue, newValue] of Object.entries(STATUS_MAP)) {
      const result = await client.query(
        `UPDATE "public"."Lead" SET "statusFunilNew" = $1::"public"."FunnelStatus_new" WHERE "statusFunil"::text = $2 AND "statusFunilNew" IS NULL`,
        [newValue, oldValue]
      );
      console.log(`  ${oldValue} -> ${newValue}: ${result.rowCount} leads`);
    }

    const unmapped = await client.query(`SELECT COUNT(*) AS total FROM "public"."Lead" WHERE "statusFunilNew" IS NULL`);
    if (Number(unmapped.rows[0].total) > 0) {
      throw new Error(`Existem ${unmapped.rows[0].total} leads sem mapeamento de status. Abortando antes de trocar a coluna.`);
    }

    await client.query(`ALTER TABLE "public"."Lead" ALTER COLUMN "statusFunilNew" SET NOT NULL;`);
    await client.query(`ALTER TABLE "public"."Lead" ALTER COLUMN "statusFunilNew" SET DEFAULT 'NOVO_LEAD';`);
    await client.query(`ALTER TABLE "public"."Lead" DROP COLUMN "statusFunil";`);
    await client.query(`ALTER TABLE "public"."Lead" RENAME COLUMN "statusFunilNew" TO "statusFunil";`);
    await client.query(`DROP TYPE "public"."FunnelStatus";`);
    await client.query(`ALTER TYPE "public"."FunnelStatus_new" RENAME TO "FunnelStatus";`);

    await client.query("COMMIT");

    const after = await client.query(
      `SELECT "statusFunil"::text AS status, COUNT(*) AS total FROM "public"."Lead" GROUP BY "statusFunil" ORDER BY total DESC`
    );
    console.log("Distribuicao apos a migracao:", after.rows);
    console.log("Simplificacao do FunnelStatus concluida com sucesso.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-funnel-status-simplification] erro", error);
  process.exitCode = 1;
});
