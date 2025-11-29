// const { DataTypes } = require('sequelize');
// const sequelize = require('../../config/database/config');

// const SessionParticipant = sequelize.define('SessionParticipant', {
//   id: {
//     type: DataTypes.STRING(24),
//     primaryKey: true,
//     allowNull: false,
//     defaultValue: () => require('crypto').randomBytes(12).toString('hex')
//   },
//   participant_id: {
//     type: DataTypes.STRING,
//     allowNull: false,
//     references: { model: 'users', key: 'id' }
//   },
//   meeting_class_id: {
//     type: DataTypes.STRING,
//     allowNull: false,
//     references: { model: 'Classes', key: 'id' }
//   },
//   participant_type: {
//     type: DataTypes.ENUM('student', 'tutor'),
//     allowNull: false
//   },
//   joined_at: {
//     type: DataTypes.DATE,
//     allowNull: false
//   },
//   ended_at: {
//     type: DataTypes.DATE,
//     allowNull: true
//   },
//   status: {
//     type: DataTypes.STRING,
//     allowNull: true
//   },
//   center_id: {
//     type: DataTypes.STRING,
//     allowNull: true,
//     references: { model: 'centers', key: 'id' }
//   }
// }, {
//   tableName: 'SessionParticipants',
//   timestamps: true
// });

// // Sequelize associations for eager loading
// const User = require('./User');
// const Class = require('./Class');
// SessionParticipant.belongsTo(User, { foreignKey: 'participant_id', as: 'participant' });
// SessionParticipant.belongsTo(Class, { foreignKey: 'meeting_class_id', as: 'meeting_class' });

// module.exports = (sequelize, DataTypes) => {
//   const SessionParticipant = sequelize.define('SessionParticipant', {
//     id: { type: DataTypes.STRING(24), primaryKey: true, allowNull: false, defaultValue: () => require('crypto').randomBytes(12).toString('hex') },
//     participant_id: { type: DataTypes.STRING, allowNull: false, references: { model: 'users', key: 'id' } },
//     meeting_class_id: { type: DataTypes.STRING, allowNull: false, references: { model: 'Classes', key: 'id' } },
//     participant_type: { type: DataTypes.ENUM('student', 'tutor'), allowNull: false },
//     joined_at: { type: DataTypes.DATE, allowNull: false },
//     ended_at: { type: DataTypes.DATE, allowNull: true },
//     status: { type: DataTypes.STRING, allowNull: true },
//     center_id: { type: DataTypes.STRING, allowNull: true, references: { model: 'centers', key: 'id' } }
//   }, {
//     tableName: 'SessionParticipants',
//     timestamps: true
//   });
//   return SessionParticipant;
// };


'use strict';

module.exports = (sequelize, DataTypes) => {
  const SessionParticipant = sequelize.define('SessionParticipant', {
    id: {
      type: DataTypes.STRING(24),
      primaryKey: true,
      allowNull: false,
      defaultValue: () => require('crypto').randomBytes(12).toString('hex')
    },
    participant_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    meeting_class_id: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: 'classes', key: 'id' }
    },
    participant_type: {
      type: DataTypes.ENUM('student', 'tutor'),
      allowNull: false
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true
    },
    center: {
      type: DataTypes.STRING,
      allowNull: true,
      references: { model: 'centers', key: 'id' }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true
    },
    start_time: {
      type: DataTypes.STRING,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    billing_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    tax_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    total_payable: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'USD'
    },
    payment_status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Unpaid'
    },
    classes_paymentType: {
      type: DataTypes.ENUM('unpaid', 'paid', 'democlass'),
      allowNull: true,
      defaultValue: 'unpaid',
      field: 'classes_paymenttype'
    },
    agoraUid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'agorauid'
    }
  
  }, {
    tableName: 'sessionparticipants',
    timestamps: true,
    underscored: true
  });

  // ✅ Associations (called automatically by models/index.js)
  SessionParticipant.associate = (models) => {
    if (models.User) {
      SessionParticipant.belongsTo(models.User, {
        foreignKey: 'participant_id',
        as: 'participant'
      });
    }
    if (models.Class) {
      SessionParticipant.belongsTo(models.Class, {
        foreignKey: 'meeting_class_id',
        as: 'meeting_class'
      });
    }
    if (models.Center) {
      SessionParticipant.belongsTo(models.Center, {
        foreignKey: 'center_id',
        as: 'center'
      });
    }
  };

  return SessionParticipant;
};
