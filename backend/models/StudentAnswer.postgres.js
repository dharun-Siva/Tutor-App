const { DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');

const StudentAnswer = sequelize.define('StudentAnswer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    assignment_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    student_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    exercise_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    total_pages: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    current_page: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    pages: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    grading: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    analytics: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    correct_answers: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    summary: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
            totalQuestions: 0,
            correct: 0,
            percentage: 0,
            status: 'not_started'
        }
    },
    study_tracking: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
            totalTimeSpent: 0,
            isActive: false,
            dailyTime: [],
            taskProgress: []
        }
    }
}, {
    sequelize,
    modelName: 'StudentAnswer',
    tableName: 'studentanswers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = StudentAnswer;