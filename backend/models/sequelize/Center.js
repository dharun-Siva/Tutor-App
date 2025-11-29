const { Model, DataTypes } = require('sequelize');
const sequelize = require('../../config/database/config');

class Center extends Model {}

Center.init({
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  zipCode: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'zip_code', // maps JS zipCode to DB zip_code
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  adminId: {
    type: DataTypes.STRING(24), // Limit to 24 characters for MongoDB-style ObjectId
    allowNull: true,
    field: 'admin_id',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  logoUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'logo_url',
    validate: {
      isUrl: true
    }
  }
}, {
  sequelize,
  modelName: 'Center',
  tableName: 'centers',
  timestamps: true // This will add createdAt and updatedAt fields
});

module.exports = Center;

// Add association for eager loading admin
const User = require('./user');
Center.belongsTo(User, { as: 'admin', foreignKey: 'adminId' });
User.hasOne(Center, { as: 'center', foreignKey: 'adminId' });