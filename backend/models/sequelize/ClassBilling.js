'use strict';

module.exports = (sequelize, DataTypes) => {
  const ClassBilling = sequelize.define('ClassBilling', {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => require('crypto').randomBytes(12).toString('hex')
    },
    student_id: {
      type: DataTypes.STRING(24),
      allowNull: false,
      index: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    parent_id: {
      type: DataTypes.STRING(24),
      allowNull: false,
      index: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    month_year: {
      type: DataTypes.STRING(7), // Format: "YYYY-MM" (e.g., "2025-11")
      allowNull: false,
      index: true
    },
    total_classes_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'USD'
    },
    status: {
      type: DataTypes.ENUM('unpaid', 'paid', 'cancelled'),
      allowNull: false,
      defaultValue: 'unpaid',
      index: true
    },
    billing_generated_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    class_ids: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    transaction_date_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    transaction_details: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    }
  }, {
    tableName: 'class_billing',
    timestamps: true,
    underscored: false
  });

  // Associations
  ClassBilling.associate = (models) => {
    ClassBilling.belongsTo(models.User, {
      foreignKey: 'student_id',
      as: 'student'
    });
    ClassBilling.belongsTo(models.User, {
      foreignKey: 'parent_id',
      as: 'parent'
    });
  };

  // Instance method: Check if bill is for current month
  ClassBilling.prototype.isCurrentMonth = function() {
    const currentDate = new Date();
    const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    return this.month_year === currentMonthYear;
  };

  // Instance method: Check if bill is overdue
  ClassBilling.prototype.isOverdue = function() {
    if (this.status === 'paid' || !this.due_date) {
      return false;
    }
    return new Date() > new Date(this.due_date);
  };

  return ClassBilling;
};
