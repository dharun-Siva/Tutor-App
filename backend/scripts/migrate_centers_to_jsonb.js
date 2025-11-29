const { pgClient } = require('../db');

async function migrateCentersToJsonb() {
  // 1. Get all centers
  const centersRes = await pgClient.query('SELECT * FROM centers');
  const centers = centersRes.rows;

  for (const center of centers) {
    // Build a JSON object for the center
    const centerData = {
      name: center.name,
      address: center.address,
      city: center.city,
      state: center.state,
      country: center.country,
      zipCode: center.zip_code,
      email: center.email,
      phone: center.phone,
      status: center.status,
      adminId: center.admin_id,
      createdAt: center.created_at,
      updatedAt: center.updated_at
    };
    // Store all center fields in a jsonb column (add if not exists)
    await pgClient.query(
      `UPDATE centers SET data = $1 WHERE id = $2`,
      [JSON.stringify(centerData), center.id]
    );
  }

  console.log('Centers migration to jsonb complete.');
}

migrateCentersToJsonb()
  .then(() => pgClient.end())
  .catch(err => {
    console.error('Migration error:', err);
    pgClient.end();
  });
