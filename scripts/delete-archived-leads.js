const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  // Get IDs first
  const leads = await c.query(`SELECT id, nome FROM "Lead" WHERE "archivedAt" IS NOT NULL`);
  console.log(`Deletando ${leads.rows.length} leads arquivados:`);
  leads.rows.forEach(r => console.log(` - ${r.nome} (${r.id})`));

  // Delete tasks and history first (cascade safety)
  const leadIds = leads.rows.map(r => `'${r.id}'`).join(',');
  if (!leadIds) { console.log('Nenhum lead para deletar.'); c.end(); return; }

  await c.query(`DELETE FROM "Task" WHERE "leadId" IN (${leadIds})`);
  await c.query(`DELETE FROM "LeadHistory" WHERE "leadId" IN (${leadIds})`);
  const result = await c.query(`DELETE FROM "Lead" WHERE "archivedAt" IS NOT NULL`);

  console.log(`\n✅ ${result.rowCount} lead(s) deletado(s) com sucesso.`);

  const remaining = await c.query('SELECT COUNT(*) as total FROM "Lead"');
  console.log(`Leads restantes no banco: ${remaining.rows[0].total}`);
  c.end();
}).catch(e => { console.error(e.message); c.end(); });
