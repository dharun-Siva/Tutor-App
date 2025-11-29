const { pgClient } = require('../db');

async function findSuperadminUser() {
  // Query for user with superadmin@education.com in data.email
  const res = await pgClient.query(
    `SELECT id, data FROM users WHERE data->>'email' = $1`,
    ['superadmin@education.com']
  );
  if (res.rows.length === 0) {
    console.log('No superadmin user found with email superadmin@education.com');
  } else {
    console.log('Superadmin user found:', res.rows[0]);
  }
  pgClient.end();
}

findSuperadminUser().catch(err => {
  console.error('Query error:', err);
  pgClient.end();
});
