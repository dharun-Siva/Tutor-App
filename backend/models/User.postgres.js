const { DataTypes } = require('sequelize');
const sequelize = require('../config/database/config');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(24), // Using character varying(24) as per DB
    primaryKey: true,
    defaultValue: () => {
      // Generate a 24-character hex ID (similar to MongoDB ObjectId)
      const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
      const random = Math.floor(Math.random() * 0xffffff).toString(16).padStart(12, '0');
      const counter = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
      const id = (timestamp + random + counter).slice(0, 24); // Ensure exactly 24 chars
      return id;
    },
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING(50), // Updated to character varying(50) as per DB
    allowNull: false,
    unique: true,
    validate: {
      len: {
        args: [3, 50], // Updated validation to match new length
        msg: 'Username must be between 3 and 50 characters long'
      }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(20), // Using character varying(20) as per DB
    allowNull: false,
    validate: {
      isIn: [['superadmin', 'admin', 'tutor', 'parent', 'student']]
    }
  },
  first_name: {
    type: DataTypes.STRING, // Using character varying as per DB
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING, // Using character varying as per DB
    allowNull: false
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  center_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  password_changed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  lock_until: {
    type: DataTypes.DATE,
    allowNull: true
  },
  account_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    allowNull: false
  },
    assignments: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'assignments',
      defaultValue: { center: null, classes: [], children: [] }
    },
    tutorProfile: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'tutor_profile',
      defaultValue: {
        address: {},
        availability: {
          monday: { available: false, timeSlots: [], timeSlotsZones: [] },
          tuesday: { available: false, timeSlots: [], timeSlotsZones: [] },
          wednesday: { available: false, timeSlots: [], timeSlotsZones: [] },
          thursday: { available: false, timeSlots: [], timeSlotsZones: [] },
          friday: { available: false, timeSlots: [], timeSlotsZones: [] },
          saturday: { available: false, timeSlots: [], timeSlotsZones: [] },
          sunday: { available: false, timeSlots: [], timeSlotsZones: [] }
        },
        rating: { average: 0, count: 0, experience: 0 },
        subjects: [],
        hourlyRate: 0,
        currency: "",
        specializations: [],
        languagesSpoken: [],
        verificationStatus: "",
        education: [],
        certifications: [],
        documents: []
      }
    },
    studentProfile: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'student_profile',
      defaultValue: {
        address: { country: "US" },
        parentContact: { relationship: "Mother" },
        academicInfo: { subjects: [], preferredSubjects: [], strugglingSubjects: [] },
        learningStyle: "Mixed",
        availability: {
          monday: { available: false, timeSlots: [], timeSlotsZones: [] },
          tuesday: { available: false, timeSlots: [], timeSlotsZones: [] },
          wednesday: { available: false, timeSlots: [], timeSlotsZones: [] },
          thursday: { available: false, timeSlots: [], timeSlotsZones: [] },
          friday: { available: false, timeSlots: [], timeSlotsZones: [] },
          saturday: { available: false, timeSlots: [], timeSlotsZones: [] },
          sunday: { available: false, timeSlots: [], timeSlotsZones: [] }
        },
        hourlyRate: 0,
        currency: "USD",
        status: "enrolled",
        enrollmentDate: "2025-10-11T10:35:37.299+00:00"
      }
    },
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  tableName: 'users',
  timestamps: false,
  underscored: true
});

// Add static hashPassword method for password hashing
User.hashPassword = async function(password) {
  return await bcrypt.hash(password, 12);
};

module.exports = User;