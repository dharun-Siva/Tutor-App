const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');

class Topic extends Model {}

Topic.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => {
      // Generate MongoDB-style ObjectId (24 hex chars)
      const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
      const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
      const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
      const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
      return (timestamp + machineId + processId + counter);
    }
  },
  topic_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  subject_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'subjects',
      key: 'id'
    }
  },
  center_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'centers',
      key: 'id'
    }
  }
}, {
  sequelize,
  modelName: 'Topic',
  tableName: 'topics',
  underscored: true,
  timestamps: true
});

module.exports = Topic;