// Migration script: MongoDB Centers to Postgres

const path = require('path');
const mongoose = require('mongoose');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Check for required environment variables
if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is not defined in .env file. Please set it in backend/.env');
}
if (!process.env.POSTGRES_URI) {
  throw new Error('POSTGRES_URI is not defined in .env file. Please set it in backend/.env');
}

console.log('Loaded MONGO_URI:', process.env.MONGO_URI.slice(0, 20) + '...');
console.log('Loaded POSTGRES_URI:', process.env.POSTGRES_URI.slice(0, 20) + '...');

// MongoDB connection

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const Center = require('../models/Center');
const MongoUser = require('../models/User'); // Mongoose User model

// Postgres connection
const pgClient = new Client({
  connectionString: process.env.POSTGRES_URI
});

async function migrateCenters() {

  await pgClient.connect();
  console.log('Connected to Postgres');

  // Create centers table if not exists
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS centers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(255),
      city VARCHAR(255),
      state VARCHAR(255),
      country VARCHAR(255),
  zip_code VARCHAR(20),
      email VARCHAR(255),
      phone VARCHAR(50),
      status VARCHAR(20),
      location_city VARCHAR(255),
      location_state VARCHAR(255),
      admin_id VARCHAR(255) REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log('Ensured centers table exists with all required columns');

  // Build MongoDB _id to Postgres id mapping (by email)
  const mongoUsers = await MongoUser.find({}, '_id email');
  const res = await pgClient.query('SELECT id, email FROM users');
  const pgUsers = res.rows;
  // Build mapping: mongoIdToPgId
  const mongoIdToPgId = {};
  for (const mUser of mongoUsers) {
    const match = pgUsers.find(pUser => pUser.email === mUser.email);
    if (match) {
      mongoIdToPgId[mUser._id.toString()] = match.id;
    }
  }
  console.log('Built MongoDB to Postgres user mapping for admin_id');

  // Fetch all centers from MongoDB
  const centers = await Center.find({});
  console.log(`Found ${centers.length} centers in MongoDB`);

  for (const center of centers) {
    // Extract fields
    const name = center.name || '';
    const address = center.address || '';
    const city = center.city || center.location?.city || '';
    const state = center.state || center.location?.state || '';
    const country = center.country || '';
  const zipCode = center.zipCode || '';
    const email = center.email || '';
    const phone = center.phone || '';
    const status = center.status || 'active';
    const location_city = center.location?.city || '';
    const location_state = center.location?.state || '';
    // Map admin ObjectId to Postgres user id
    let adminId = null;
    let adminEmail = null;
    let pgUserMatch = null;
    if (center.admin) {
      // Find MongoDB user by _id
      const mongoAdmin = mongoUsers.find(u => u._id.toString() === center.admin.toString());
      if (mongoAdmin) {
        adminEmail = mongoAdmin.email;
        pgUserMatch = pgUsers.find(pUser => pUser.email === adminEmail);
        if (pgUserMatch) {
          adminId = pgUserMatch.id;
        }
      }
    }
    // Debug output
    console.log(`Center: ${name}`);
    console.log(`  center.admin: ${center.admin ? center.admin.toString() : 'none'}`);
    console.log(`  MongoDB admin email: ${adminEmail}`);
    console.log(`  Postgres user match: ${pgUserMatch ? pgUserMatch.id : 'none'}`);
    console.log(`  Final admin_id: ${adminId}`);

    const createdAt = center.createdAt || new Date();
    const updatedAt = center.updatedAt || new Date();

    await pgClient.query(
      `INSERT INTO centers (name, address, city, state, country, zip_code, email, phone, status, location_city, location_state, admin_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [name, address, city, state, country, zipCode, email, phone, status, location_city, location_state, adminId, createdAt, updatedAt]
    );
    console.log(`Migrated center: ${name} (admin_id: ${adminId})`);
  }

  await pgClient.end();
  mongoose.disconnect();
  console.log('Migration completed!');
}

migrateCenters().catch(err => {
  console.error('Migration error:', err);
  pgClient.end();
  mongoose.disconnect();
});
