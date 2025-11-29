const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');
const bcrypt = require('bcrypt');

// Map emails to passwords. Set desired passwords for each user.
const passwordMap = {
  'superadmin@education.com': 'SuperAdmin123',
  'admin@center1.com': 'Admin123',
  'parent@education.com': 'Parent123',
  'student@education.com': 'Student123',
  // Add more mappings as needed
};

// Default password for unmapped users
const defaultPassword = 'Default123';

async function updateAllUserPasswords() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');
    const users = await User.findAll();
    for (const user of users) {
      const plainPassword = passwordMap[user.email] || defaultPassword;
      user.password = await bcrypt.hash(plainPassword, 12);
      await user.save();
      console.log(`Updated password for: ${user.email}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

updateAllUserPasswords();
