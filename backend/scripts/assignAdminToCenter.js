
// Usage: node scripts/assignAdminToCenter.js <adminEmail> <centerId>
// Example: node scripts/assignAdminToCenter.js karthik_kvp@yahoo.com 68fb0e937d4b7bf52fe5ddcd


const User = require('../models/sequelize/User');
const sequelize = require('../config/database/config');

async function assignCenterToAllAdmins(centerId) {
  try {
    await sequelize.authenticate();
    const admins = await User.findAll({ where: { role: 'admin', center_id: null } });
    if (!admins.length) {
      console.log('No admin users found without center_id.');
      process.exit(0);
    }
    for (const admin of admins) {
      admin.center_id = centerId;
      await admin.save();
      console.log(`✅ Admin ${admin.email} (${admin.id}) assigned to center ${centerId}`);
    }
    console.log(`Finished assigning center_id to ${admins.length} admin(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Error assigning center to admins:', err);
    process.exit(1);
  }
}

const [,, centerId] = process.argv;
if (!centerId) {
  console.error('Usage: node scripts/assignAdminToCenter.js <centerId>');
  process.exit(1);
}
assignCenterToAllAdmins(centerId);
