const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.POSTGRES_DB || 'Tutor Application',
  process.env.POSTGRES_USER || 'postgres',
  process.env.POSTGRES_PASSWORD || '',
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
    pool: {
      max: parseInt(process.env.SEQUELIZE_POOL_MAX) || 5,
      min: parseInt(process.env.SEQUELIZE_POOL_MIN) || 0,
      acquire: parseInt(process.env.SEQUELIZE_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.SEQUELIZE_POOL_IDLE) || 10000
    }
  }
);

module.exports = sequelize;