const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database/config');

const Subject = sequelize.define('Subject', {
  id: {
    type: DataTypes.STRING(24), // To match MongoDB ObjectId format
    primaryKey: true,
    allowNull: false
  },
  subjectCode: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  subjectName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  gradeId: {
    type: DataTypes.STRING(24), // Foreign key to Grade
    allowNull: false
  },
  centerId: {
    type: DataTypes.STRING(24), // Foreign key to Center
    allowNull: false
  }
}, {
  tableName: 'subjects',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['subjectCode', 'gradeId', 'centerId']
    }
  ]
});

module.exports = Subject;
