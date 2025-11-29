const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');
const bcrypt = require('bcrypt');

const email = 'superadmin@education.com';
const passwordPlain = 'SuperAdmin123'; // Change this to your desired password
const username = 'superadmin';
const firstName = 'Super';
const lastName = 'Admin';

async function updateSuperadminFields() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');
    const user = await User.findOne({
      where: { email }
    });
    if (!user) {
      console.log('Superadmin user not found.');
      return;
    }
    user.role = 'superadmin';
    user.password = await bcrypt.hash(passwordPlain, 12);
    user.username = username;
    user.firstName = firstName;
    user.lastName = lastName;
    await user.save();
    console.log('Superadmin fields updated:', {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      password: user.password
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

updateSuperadminFields();
