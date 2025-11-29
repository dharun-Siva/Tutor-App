
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database/config');

const Class = sequelize.define('Class', {
  id: {
    type: DataTypes.STRING(24),
    primaryKey: true,
    allowNull: false,
    defaultValue: () => require('crypto').randomBytes(12).toString('hex') // 24-char hex string
  },
  // Basic class information
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Subject information
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Tutor assignment
  tutorId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  // Students enrolled
  students: {
    type: DataTypes.ARRAY(DataTypes.STRING), // Array of User IDs
    allowNull: true
  },
  // Class capacity
  maxCapacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  },
  // Time and schedule information
  startTime: {
    type: DataTypes.STRING, // Format: "HH:MM"
    allowNull: false
  },
  // Timezone in which the class was scheduled (stored for conversion purposes)
  scheduledTimeZone: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'UTC',
    comment: 'Timezone in which startTime was originally specified'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 35
  },
  customDuration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Date scheduling
  scheduleType: {
    type: DataTypes.ENUM('one-time', 'weekly-recurring'),
    allowNull: false,
    defaultValue: 'one-time'
  },
  classDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  recurringDays: {
    type: DataTypes.ARRAY(DataTypes.STRING), // Array of days
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Class status
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'scheduled'
  },
  // Payment status
  paymentStatus: {
    type: DataTypes.ENUM('unpaid', 'paid', 'democlass'),
    allowNull: false,
    defaultValue: 'unpaid'
  },
  // Billing amount and currency
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'USD'
  },
  // Meeting integration
  meetingId: { type: DataTypes.STRING, allowNull: true, unique: true, field: 'meetingId' },
  meetingLink: { type: DataTypes.STRING, allowNull: true, field: 'meetingLink' },
  meetingPlatform: {
    type: DataTypes.ENUM('agora', 'zoom', 'meet'),
    allowNull: false,
    defaultValue: 'agora'
  },
  joinWindowMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15
  },
  // Administrative information
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  centerId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: 'centers', key: 'id' }
  },
  // Additional metadata
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Sessions for recurring classes
  sessions: {
    type: DataTypes.JSONB, // Array of session objects
    allowNull: true
  }
}, {
  tableName: 'Classes',
  timestamps: true
});


// Sequelize association for eager loading tutor details
const User = require('./user');
Class.belongsTo(User, { foreignKey: 'tutorId', as: 'tutor' });

module.exports = Class;
