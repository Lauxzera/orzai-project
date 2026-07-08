const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const crypto = require("node:crypto");

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
    console.log("Iniciando migração de Multi-Setor (Department)...");

    // 1. Criar novas tabelas
    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."Department" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."UserDepartmentRole" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "role" "public"."UserRole" NOT NULL DEFAULT 'SALES',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserDepartmentRole_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UserDepartmentRole_userId_departmentId_key" ON "public"."UserDepartmentRole"("userId", "departmentId");
      CREATE INDEX IF NOT EXISTS "UserDepartmentRole_userId_idx" ON "public"."UserDepartmentRole"("userId");
      CREATE INDEX IF NOT EXISTS "UserDepartmentRole_departmentId_idx" ON "public"."UserDepartmentRole"("departmentId");
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."BotConfig" (
        "id" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "prompt" TEXT NOT NULL,
        "model" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "BotConfig_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "BotConfig_departmentId_idx" ON "public"."BotConfig"("departmentId");
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."KnowledgeBase" (
        "id" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "KnowledgeBase_departmentId_idx" ON "public"."KnowledgeBase"("departmentId");
    `);

    // 2. Adicionar departmentId às tabelas existentes
    const tablesToAlter = [
      'Lead',
      'MessageConversation',
      'RoundRobinState',
      'MessageChannelConfigRecord'
    ];

    for (const table of tablesToAlter) {
      await client.query(`
        ALTER TABLE "public"."${table}"
        ADD COLUMN IF NOT EXISTS "departmentId" TEXT
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS "${table}_departmentId_idx"
        ON "public"."${table}"("departmentId")
      `);
    }

    // 3. Criar "Setor Padrão" se não existir
    const defaultDeptQuery = await client.query(`
      SELECT id FROM "public"."Department" WHERE name = 'Geral' LIMIT 1
    `);
    
    let defaultDeptId;
    if (defaultDeptQuery.rowCount === 0) {
      // Criar cuid simplificado (como o fallback que usam em node js as vezes) ou uuid
      // Como o ID default do Prisma cuid começa com c, vamos usar 'c' + rand
      const randStr = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      defaultDeptId = 'c' + randStr.padEnd(24, 'a').substring(0, 24);
      
      await client.query(`
        INSERT INTO "public"."Department" ("id", "name", "description")
        VALUES ($1, $2, $3)
      `, [defaultDeptId, 'Geral', 'Setor Padrão gerado automaticamente']);
      console.log(`Setor Padrão criado com ID: ${defaultDeptId}`);
    } else {
      defaultDeptId = defaultDeptQuery.rows[0].id;
      console.log(`Setor Padrão já existe com ID: ${defaultDeptId}`);
    }

    // 4. Associar registros atuais ao Setor Padrão (onde departmentId é NULL)
    for (const table of tablesToAlter) {
      const res = await client.query(`
        UPDATE "public"."${table}"
        SET "departmentId" = $1
        WHERE "departmentId" IS NULL
      `, [defaultDeptId]);
      console.log(`Tabela ${table} atualizada: ${res.rowCount} registros vinculados ao Setor Padrão.`);
    }

    // 5. Vincular usuários existentes ao Setor Padrão
    const users = await client.query(`SELECT id, role FROM "public"."User"`);
    for (const user of users.rows) {
      const exists = await client.query(`
        SELECT id FROM "public"."UserDepartmentRole" WHERE "userId" = $1 AND "departmentId" = $2
      `, [user.id, defaultDeptId]);
      
      if (exists.rowCount === 0) {
        const randStr = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        const roleId = 'c' + randStr.padEnd(24, 'b').substring(0, 24);
        
        await client.query(`
          INSERT INTO "public"."UserDepartmentRole" ("id", "userId", "departmentId", "role")
          VALUES ($1, $2, $3, $4)
        `, [roleId, user.id, defaultDeptId, user.role || 'SALES']);
      }
    }
    console.log(`${users.rowCount} usuários verificados e vinculados ao Setor Padrão.`);

    // 6. Adicionar chaves estrangeiras depois de popular
    const foreignKeys = [
      { table: 'UserDepartmentRole', col: 'userId', ref: 'User' },
      { table: 'UserDepartmentRole', col: 'departmentId', ref: 'Department' },
      { table: 'BotConfig', col: 'departmentId', ref: 'Department' },
      { table: 'KnowledgeBase', col: 'departmentId', ref: 'Department' },
      { table: 'Lead', col: 'departmentId', ref: 'Department' },
      { table: 'MessageConversation', col: 'departmentId', ref: 'Department' },
      { table: 'RoundRobinState', col: 'departmentId', ref: 'Department' },
      { table: 'MessageChannelConfigRecord', col: 'departmentId', ref: 'Department' }
    ];

    for (const fk of foreignKeys) {
      try {
        await client.query(`
          ALTER TABLE "public"."${fk.table}"
          ADD CONSTRAINT "${fk.table}_${fk.col}_fkey" FOREIGN KEY ("${fk.col}") REFERENCES "public"."${fk.ref}"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        console.log(`Constraint FOREIGN KEY adicionada em ${fk.table}.${fk.col} referenciando ${fk.ref}`);
      } catch (err) {
        // Ignorar se a constraint já existe ou falhar
        if (err.code !== '42710') { // 42710 é duplicate object
           console.warn(`Aviso ao adicionar constraint em ${fk.table}: ${err.message}`);
        }
      }
    }

    console.log("Migração concluída com sucesso!");

  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[apply-department-schema] erro", error);
  process.exitCode = 1;
});
