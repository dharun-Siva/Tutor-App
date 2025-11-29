const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');

async function updateSuperadminRole() {
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
    user.role = 'superadmin';
    await user.save();
    console.log('Superadmin role updated:', {
      id: user.id,
      email: user.email,
      role: user.role
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

updateSuperadminRole();
