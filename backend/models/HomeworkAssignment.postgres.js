const { DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');

const HomeworkAssignment = sequelize.define('HomeworkAssignment', {
    _id: {
        type: DataTypes.STRING(24),
        primaryKey: true,
        allowNull: false,
        field: '_id' // explicitly tell Sequelize to use _id as the column name
    },
    grade_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    subject_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    topic_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    subtopic_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    assigned_by: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    assignment_type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    class_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    student_ids: {
        type: DataTypes.ARRAY(DataTypes.STRING(24)),
        defaultValue: []
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    homework_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    due_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'assigned'
    },
    instructions: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    submissions: {
        type: DataTypes.JSONB,
        defaultValue: []
    }
}, {
    tableName: 'homeworkassignments',
    timestamps: true,
    underscored: true,
    // Disable Sequelize's auto-pluralization
    freezeTableName: true,
    // Map column names explicitly
    hooks: {
        beforeFind: (options) => {
            if (options.attributes) {
                // Map _id to id in queries
                const idIndex = options.attributes.indexOf('id');
                if (idIndex !== -1) {
                    options.attributes[idIndex] = '_id';
                }
            }
        }
    }
});

module.exports = HomeworkAssignment;
