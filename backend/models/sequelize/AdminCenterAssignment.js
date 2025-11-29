const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminCenterAssignment = sequelize.define('AdminCenterAssignment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    centerId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Centers',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  }, {
    tableName: 'admin_center_assignments',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['adminId', 'centerId'],
      },
    ],
  });

  return AdminCenterAssignment;
};
