const User = require('./user');
const Center = require('./Center');
const AdminCenterAssignmentModel = require('./AdminCenterAssignment');

// Initialize join table model (Sequelize v6 pattern)

let AdminCenterAssignment;
module.exports.init = (sequelize) => {
  AdminCenterAssignment = AdminCenterAssignmentModel(sequelize);
  // Many-to-many: User (admin) <-> Center
  User.belongsToMany(Center, {
    through: AdminCenterAssignment,
    as: 'assignedCenters',
    foreignKey: 'adminId',
    otherKey: 'centerId',
  });
  Center.belongsToMany(User, {
    through: AdminCenterAssignment,
    as: 'assignedAdmins',
    foreignKey: 'centerId',
    otherKey: 'adminId',
  });

  // Center belongs to User (as admin)
  Center.belongsTo(User, {
    foreignKey: 'adminId',
    as: 'admin'
  });

  // User has one Center (as admin)
  User.hasOne(Center, {
    foreignKey: 'adminId',
    as: 'adminCenter'
  });

  // For legacy code compatibility
  return { User, Center, AdminCenterAssignment };
};

module.exports.User = User;
module.exports.Center = Center;
module.exports.AdminCenterAssignment = AdminCenterAssignment;