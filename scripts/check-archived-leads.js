const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  // Leads with archivedAt field set
  const byArchivedAt = await c.query(`
    SELECT COUNT(*) as total FROM "Lead" WHERE "archivedAt" IS NOT NULL
  `);
  console.log('Leads com archivedAt preenchido:', byArchivedAt.rows[0].total);

  // Leads by closing status (Matriculado, Perdido, Reativar Futuramente)
  const byStatus = await c.query(`
    SELECT "statusFunil", COUNT(*) as total
    FROM "Lead"
    WHERE "statusFunil" IN ('MATRICULADO', 'PERDIDO', 'REATIVAR_FUTURAMENTE')
    GROUP BY "statusFunil"
    ORDER BY total DESC
  `);
  console.log('\nLeads por status de fechamento:');
  byStatus.rows.forEach(r => console.log(` ${r.statusFunil}: ${r.total}`));

  // Total geral
  const total = await c.query('SELECT COUNT(*) as total FROM "Lead"');
  console.log('\nTotal geral de leads:', total.rows[0].total);

  // Sample dos arquivados
  const sample = await c.query(`
    SELECT nome, "statusFunil", "archivedAt", "updatedAt"
    FROM "Lead"
    WHERE "archivedAt" IS NOT NULL
    LIMIT 5
  `);
  if (sample.rows.length > 0) {
    console.log('\nExemplos (archivedAt preenchido):');
    sample.rows.forEach(r => console.log(` ${r.nome} | ${r.statusFunil} | arquivado em: ${r.archivedAt}`));
  }

  c.end();
}).catch(e => { console.error(e.message); c.end(); });
