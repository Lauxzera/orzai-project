const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT id, username, role, "createdAt" FROM "User" ORDER BY "createdAt"'))
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); client.end(); })
  .catch(e => { console.error(e.message); client.end(); });
