const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
  .then(r => { console.log(r.rows.map(x => x.table_name).join('\n')); client.end(); })
  .catch(e => { console.error(e.message); client.end(); });
