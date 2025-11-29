'use strict';

module.exports = (sequelize, DataTypes) => {
  const Subject = sequelize.define('Subject', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    subjectCode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subjectName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    gradeId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'grades',
        key: 'id'
      }
    },
    centerId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'centers',
        key: 'id'
      }
    }
  }, {
    tableName: 'subjects'
  });

  // Subject.associate = function(models) {
  //   const isSequelizeModel = m => m && typeof m === 'object' && typeof m.getTableName === 'function';
  //   if (!isSequelizeModel(models.Grade)) {
  //     throw new Error('models.Grade is not a valid Sequelize model instance. Check model loader and export format.');
  //   }
  //   if (!isSequelizeModel(models.Center)) {
  //     throw new Error('models.Center is not a valid Sequelize model instance. Check model loader and export format.');
  //   }
  //   Subject.belongsTo(models.Grade, {
  //     foreignKey: 'gradeId',
  //     as: 'grade'
  //   });
  //   Subject.belongsTo(models.Center, {
  //     foreignKey: 'centerId',
  //     as: 'center'
  //   });
  // };
  Subject.associate = (models) => {
  Subject.belongsTo(models.Grade, {
    foreignKey: 'gradeId',
    as: 'grade'
  });
  Subject.belongsTo(models.Center, {
    foreignKey: 'centerId',
    as: 'center'
  });
};

  return Subject;
};