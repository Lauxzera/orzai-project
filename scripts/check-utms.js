const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  const r = await c.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN "utmSource" != '' AND "utmSource" IS NOT NULL THEN 1 END) as com_utm_source,
      COUNT(CASE WHEN "trackingId" != '' AND "trackingId" IS NOT NULL THEN 1 END) as com_tracking_id,
      COUNT(CASE WHEN "trackingLandingPage" != '' AND "trackingLandingPage" IS NOT NULL THEN 1 END) as com_landing_page
    FROM "Lead"
  `);
  console.log('RESUMO UTM:', JSON.stringify(r.rows[0], null, 2));

  const sample = await c.query(`
    SELECT nome, origem, "utmSource", "utmMedium", "utmCampaign", "trackingReferrer", "trackingLandingPage"
    FROM "Lead"
    WHERE "utmSource" != '' AND "utmSource" IS NOT NULL
    LIMIT 3
  `);
  console.log('\nLEADS COM UTM:', JSON.stringify(sample.rows, null, 2));
  c.end();
}).catch(e => { console.error(e.message); c.end(); });
