const mongoose = require('mongoose');
const sequelize = require('../config/database/config');
const Center = require('../models/sequelize/Center');
const User = require('../models/sequelize/user');
require('dotenv').config();

// Define MongoDB schemas
const centerSchema = new mongoose.Schema({
  name: String,
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  contact: {
    email: String,
    phone: String
  },
  status: {
    type: String,
    default: 'active'
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const userSchema = new mongoose.Schema({
  email: String,
  role: String
});

// Register MongoDB models
const MongoCenter = mongoose.model('Center', centerSchema);
const MongoUser = mongoose.model('User', userSchema);

async function migrateCenters() {
  try {
    console.log('🚀 Starting centers migration from MongoDB to PostgreSQL...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tutor1');
    console.log('📌 Connected to MongoDB');

    // Test PostgreSQL connection
    await sequelize.authenticate();
    console.log('📌 Connected to PostgreSQL');

    // Sync the Center model with PostgreSQL (create table if not exists)
    await Center.sync({ force: false });
    console.log('📌 Center table synced with PostgreSQL');

    // Get all centers from MongoDB
    const mongoCenters = await MongoCenter.find({}).populate('admin');
    console.log(`📦 Found ${mongoCenters.length} centers in MongoDB`);

    // Migrate each center
    for (const mongoCenter of mongoCenters) {
      try {
        let adminId = null;
        
        // Check if center already exists in PostgreSQL
        const existingCenter = await Center.findOne({
          where: {
            name: mongoCenter.name
          }
        });

        if (existingCenter) {
          console.log(`⏩ Center ${mongoCenter.name} already exists in PostgreSQL, skipping...`);
          continue;
        }

        // If the center has an admin, find their PostgreSQL ID
        if (mongoCenter.admin && mongoCenter.admin.email) {
          const admin = await User.findOne({
            where: {
              email: mongoCenter.admin.email
            }
          });
          if (admin) {
            adminId = admin.id;
          }
        }

        // Create center in PostgreSQL
        const newCenter = await Center.create({
          name: mongoCenter.name,
          address: mongoCenter.location.address,
          city: mongoCenter.location.city,
          state: mongoCenter.location.state,
          country: mongoCenter.location.country || 'Unknown',
          zipCode: mongoCenter.location.zipCode,
          email: mongoCenter.contact?.email || 'no-email@example.com',
          phone: mongoCenter.contact?.phone || 'N/A',
          status: mongoCenter.status || 'active',
          adminId: adminId
        });

        console.log(`✅ Migrated center: ${newCenter.name}`);
      } catch (error) {
        console.error(`❌ Error migrating center ${mongoCenter.name}:`, error);
      }
    }

    console.log('🎉 Centers migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    // Close both database connections
    await mongoose.connection.close();
    await sequelize.close();
    console.log('📌 Database connections closed');
  }
}

// Run the migration
migrateCenters().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});