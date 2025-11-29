const { Pool, Client } = require('pg');
require('dotenv').config();

// PostgreSQL configuration from .env file
const dbConfig = {
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

console.log('Connecting to PostgreSQL with:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: 'dharunsiva@1' // Hide password in logs
});

const pgClient = new Client(dbConfig);

const pool = new Pool({
  ...dbConfig,
  max: parseInt(process.env.POSTGRES_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 2000,
});

// Simple ID validator for PostgreSQL
const objectIdHelper = {
    isValid: (id) => {
        return typeof id === 'number' && !isNaN(id) || 
               (typeof id === 'string' && id.trim().length > 0);
    },
    
    formatId: (id) => {
        return typeof id === 'string' ? parseInt(id, 10) : id;
    }
};

pgClient.connect()
  .then(() => console.log('PostgreSQL connected'))
  .catch(err => console.error('PostgreSQL connection error', err));

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = { pgClient, objectIdHelper, pool };
