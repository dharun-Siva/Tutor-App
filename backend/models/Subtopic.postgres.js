const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');

class Subtopic extends Model {}

Subtopic.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  subtopic_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  topic_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'topics',
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
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Subtopic',
  tableName: 'subtopics',
  timestamps: true,
  underscored: true
});

module.exports = Subtopic;