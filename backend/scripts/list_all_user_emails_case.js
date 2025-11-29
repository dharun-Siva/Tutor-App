const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');

async function listAllUserEmails() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');
    const users = await User.findAll();
    users.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

listAllUserEmails();
