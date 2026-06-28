const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const before = await client.query('SELECT "redirectUri", "metaAppId", "metaAppConfigId", "embeddedSignupEnabled", "coexistenceEnabled", "onboardingStatus" FROM "MessageChannelConfigRecord" WHERE id = \'meta\'');
  console.log('Antes:', before.rows[0]);

  await client.query(`
    UPDATE "MessageChannelConfigRecord"
    SET
      "redirectUri" = 'https://crm-institutobelart.vercel.app/auth/meta/callback',
      "metaAppId" = '1250488524805073',
      "metaAppConfigId" = '2041214766787970',
      "embeddedSignupEnabled" = true,
      "coexistenceEnabled" = true,
      "onboardingStatus" = 'ready',
      "updatedAt" = NOW()
    WHERE id = 'meta'
  `);

  const after = await client.query('SELECT "redirectUri", "metaAppId", "metaAppConfigId", "embeddedSignupEnabled", "coexistenceEnabled", "onboardingStatus" FROM "MessageChannelConfigRecord" WHERE id = \'meta\'');
  console.log('Depois:', after.rows[0]);

  await client.end();
  console.log('Configuração atualizada com sucesso.');
}

main().catch(e => { console.error(e); client.end(); });
