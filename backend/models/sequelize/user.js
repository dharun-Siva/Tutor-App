
const { ObjectId } = require('mongodb');


const { Model, DataTypes } = require('sequelize');

const sequelize = require('../../config/database/config');
const bcrypt = require('bcrypt');
const validator = require('validator');

class User extends Model {
  static async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }
}

User.init({
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  },
  firstName: {
    type: DataTypes.STRING,
    field: 'first_name'
  },
  lastName: {
    type: DataTypes.STRING,
    field: 'last_name'
  },
  id: {
    type: DataTypes.STRING(24), // Limit to 24 characters for MongoDB-style ObjectId
    primaryKey: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  center_id: {
    type: DataTypes.STRING(24), // Limit to 24 characters for MongoDB-style ObjectId
    allowNull: true,
    set(value) {
      if (value) {
        this.setDataValue('center_id', String(value));
      } else {
        this.setDataValue('center_id', null);
      }
    },
    get() {
      const rawValue = this.getDataValue('center_id');
      return rawValue ? String(rawValue) : null;
    }
  },
  phoneNumber: {
    type: DataTypes.STRING,
    field: 'phone_number'
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },
  tutor_profile: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'tutor_profile'
  },
  student_profile: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'student_profile'
  },
  assignments: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    field: 'assignments'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});


module.exports = User;

// Utility to generate a 24-character hex string (MongoDB ObjectId style)
function generateObjectId() {
  const hex = () => Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
  return hex() + hex() + hex();
}

module.exports.generateObjectId = generateObjectId;
