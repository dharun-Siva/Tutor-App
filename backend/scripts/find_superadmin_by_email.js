const User = require('../models/sequelize/user');
const sequelize = require('../config/database/config');

async function findSuperadmin() {
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
    } else {
      console.log('Superadmin found:', {
        id: user.id,
        email: user.email,
        role: user.role,
        data: user.data
      });
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

findSuperadmin();
