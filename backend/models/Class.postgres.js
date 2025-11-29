const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const Class = sequelize.define('Class', {
    // Basic class information
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tutorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    students: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      defaultValue: [],
    },
    maxCapacity: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      validate: { min: 1, max: 50 },
    },
    startTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 35,
    },
    customDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    scheduleType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'one-time',
    },
    classDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    recurringDays: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'scheduled',
    },
    paymentStatus: {
      type: DataTypes.STRING,
      defaultValue: 'unpaid',
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Meeting info for Agora
    meetingId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meetingLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meetingPlatform: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'agora',
    },
    joinWindowMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 10,
    },
  }, {
    tableName: 'Classes',
    timestamps: true,
  });

  // Associations can be defined here
  Class.associate = (models) => {
    Class.belongsTo(models.User, { foreignKey: 'tutorId', as: 'tutor' });
    Class.belongsToMany(models.User, { through: 'ClassStudents', as: 'students', foreignKey: 'classId', otherKey: 'userId' });
  };

  return Class;
  // Auto-generate meeting info
  Class.generateMeetingInfo = async function(classData) {
    // Match old MongoDB logic
    if (!classData.meetingId) {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 6);
      classData.meetingId = `class-${timestamp}-${random}`;
    }
    if (!classData.meetingLink) {
      classData.meetingLink = `/meeting/${classData.meetingId}`;
    }
    if (!classData.meetingPlatform) {
      classData.meetingPlatform = 'agora';
    }
    if (!classData.joinWindowMinutes) {
      classData.joinWindowMinutes = 15;
    }
    return classData;
  };

  return Class;
};
