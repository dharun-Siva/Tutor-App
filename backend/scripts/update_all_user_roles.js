const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');

// Map emails to roles. Add/modify as needed for your users.
const roleMap = {
  'superadmin@education.com': 'superadmin',
  'admin@center1.com': 'admin',
  'parent@education.com': 'parent',
  'student@education.com': 'student',
  // Add more mappings as needed
};

async function updateAllUserRoles() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');
    const users = await User.findAll();
    for (const user of users) {
      const newRole = roleMap[user.email];
      if (newRole) {
        user.role = newRole;
        await user.save();
        console.log(`Updated: ${user.email} -> ${newRole}`);
      } else {
        // Optionally, set a default role or skip
        // user.role = 'student';
        // await user.save();
        console.log(`No role mapping for: ${user.email}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

updateAllUserRoles();
