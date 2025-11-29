const { pgClient } = require('../db');

async function inspectUserDataForCenter() {
  // Get all users
  const usersRes = await pgClient.query('SELECT id, data FROM users');
  const users = usersRes.rows;

  for (const user of users) {
    let centerId = null;
    if (user.data && user.data.centerId) {
      centerId = user.data.centerId;
    } else if (user.data && user.data.center) {
      centerId = user.data.center;
    }
    console.log(`User ID: ${user.id}, centerId: ${centerId}`);
  }

  pgClient.end();
}

inspectUserDataForCenter();
