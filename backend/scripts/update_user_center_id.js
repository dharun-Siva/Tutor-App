const { pgClient } = require('../db');

async function updateUserCenterId() {
  // Get all users with their original center ObjectId
  const usersRes = await pgClient.query('SELECT id, center FROM users');
  const users = usersRes.rows;

  for (const user of users) {
    // If user has a center ObjectId, set center_id to that value
    if (user.center) {
      await pgClient.query('UPDATE users SET center_id = $1 WHERE id = $2', [user.center, user.id]);
    }
  }

  console.log('User center_id update complete.');
}

updateUserCenterId()
  .then(() => pgClient.end())
  .catch(err => {
    console.error('Update error:', err);
    pgClient.end();
  });
