const { pgClient } = require('../db');

async function listAllUserEmails() {
  const res = await pgClient.query('SELECT id, data->>\'email\' AS email, data FROM users');
  if (res.rows.length === 0) {
    console.log('No users found.');
  } else {
    res.rows.forEach(row => {
      console.log(`ID: ${row.id}, Email: ${row.email}`);
    });
  }
  pgClient.end();
}

listAllUserEmails().catch(err => {
  console.error('Query error:', err);
  pgClient.end();
});
