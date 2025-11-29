const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');

async function printSuperadminDetails() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');
    const user = await User.findOne({
      where: {
        email: 'superadmin@education.com'
      }
    });
    if (!user) {
      console.log('Superadmin user not found.');
      return;
    }
    console.log('Superadmin details:', {
      id: user.id,
      email: user.email,
      role: user.role,
      password: user.password,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      data: user.data
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

printSuperadminDetails();
