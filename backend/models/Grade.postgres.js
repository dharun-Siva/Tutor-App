const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');
const { v4: uuidv4 } = require('uuid');

class Grade extends Model {}

Grade.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => {
      // Generate MongoDB-style ObjectId
      const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
      const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
      const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
      const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
      return (timestamp + machineId + processId + counter);
    }
  },
  grade_code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  grade_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  center_id: {
    type: DataTypes.STRING,
    allowNull: true, // Making this optional
    references: {
      model: 'centers',
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'Grade',
  tableName: 'grades',
  underscored: true,
  timestamps: true
});

module.exports = Grade;