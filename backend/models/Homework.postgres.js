const { DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');

const Homework = sequelize.define('Homework', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => new Date().getTime().toString() // Using timestamp as ID to match MongoDB format
  },
  homeworkName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gradeId: {
    type: DataTypes.STRING,
    references: {
      model: 'grades',
      key: 'id'
    },
    allowNull: false
  },
  subjectId: {
    type: DataTypes.STRING,
    references: {
      model: 'subjects',
      key: 'id'
    },
    allowNull: false
  },
  topicId: {
    type: DataTypes.STRING,
    references: {
      model: 'topics',
      key: 'id'
    },
    allowNull: false
  },
  subtopicId: {
    type: DataTypes.STRING,
    references: {
      model: 'subtopics',
      key: 'id'
    },
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  exerciseData: {
    type: DataTypes.JSONB,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('exerciseData');
      return rawValue ? JSON.parse(JSON.stringify(rawValue)) : null;
    },
    set(value) {
      this.setDataValue('exerciseData', value);
    }
  },
  csvContent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  correctAnswersSummary: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  totalQuestions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  questionTypes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  exerciseIds: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  createdBy: {
    type: DataTypes.STRING,
    references: {
      model: 'users',
      key: 'id'
    },
    allowNull: false
  },
  center: {
    type: DataTypes.STRING,
    references: {
      model: 'centers',
      key: 'id'
    },
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  sequelize,
  modelName: 'Homework',
  tableName: 'homeworks',
  timestamps: true
});

// Associations will be set up in models/index.js
module.exports = Homework;
