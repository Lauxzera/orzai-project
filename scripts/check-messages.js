const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  const convs = await client.query('SELECT id, "contactPhone", "contactName", "lastMessage", "lastMessageAt", "unreadCount" FROM "MessageConversation" ORDER BY "lastMessageAt" DESC LIMIT 10');
  console.log('CONVERSAS (' + convs.rows.length + '):', JSON.stringify(convs.rows, null, 2));
  const msgs = await client.query('SELECT COUNT(*) as total FROM "MessageRecord"');
  console.log('TOTAL MENSAGENS NO BANCO:', msgs.rows[0].total);
  if (convs.rows.length > 0) {
    const sample = await client.query('SELECT direction, content, timestamp FROM "MessageRecord" WHERE "conversationId" = $1 ORDER BY timestamp DESC LIMIT 5', [convs.rows[0].id]);
    console.log('ULTIMAS MENSAGENS DA CONV 1:', JSON.stringify(sample.rows, null, 2));
  }
  client.end();
}).catch(e => { console.error(e.message); client.end(); });
