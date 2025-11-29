// Migration for admin_center_assignments join table
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('admin_center_assignments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      adminId: {
        type: Sequelize.STRING(24),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      centerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'centers',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    });
    await queryInterface.addConstraint('admin_center_assignments', {
      fields: ['adminId', 'centerId'],
      type: 'unique',
      name: 'unique_admin_center_assignment'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('admin_center_assignments');
  }
};
