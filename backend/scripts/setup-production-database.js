#!/usr/bin/env node

/**
 * Database Setup and Migration Script for Production
 * This script helps set up the database for production deployment
 */

const mongoose = require('mongoose');
require('dotenv').config();

class DatabaseSetup {
  constructor() {
    this.connectionString = process.env.MONGO_URI;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  async connect() {
    try {
      console.log('🔗 Connecting to MongoDB...');
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: this.isProduction ? 10 : 5, // Maintain up to 10 socket connections in production
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        bufferCommands: false, // Disable mongoose buffering
        bufferMaxEntries: 0 // Disable mongoose buffering
      };

      if (this.isProduction) {
        // Additional production-specific options
        options.retryWrites = true;
        options.w = 'majority';
        options.readPreference = 'primary';
      }

      await mongoose.connect(this.connectionString, options);
      console.log('✅ Connected to MongoDB successfully');
      
      // Test the connection
      await this.testConnection();
      
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async testConnection() {
    try {
      console.log('🔍 Testing database connection...');
      
      const adminDb = mongoose.connection.db.admin();
      const result = await adminDb.ping();
      
      if (result.ok === 1) {
        console.log('✅ Database ping successful');
      }
      
      // Get database stats
      const stats = await mongoose.connection.db.stats();
      console.log('📊 Database Statistics:');
      console.log(`   - Database: ${mongoose.connection.name}`);
      console.log(`   - Collections: ${stats.collections}`);
      console.log(`   - Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   - Index Size: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`);
      
    } catch (error) {
      console.error('❌ Database test failed:', error);
    }
  }

  async createIndexes() {
    try {
      console.log('🏗️  Creating database indexes for performance...');

      // Import models to ensure indexes are created
      require('../models/User');
      require('../models/Class');
      require('../models/Center');
      require('../models/SessionParticipant');
      require('../models/BillingTransaction');
      require('../models/Homework');
      require('../models/HomeworkAssignment');

      // Create compound indexes for better query performance
      const User = mongoose.model('User');
      const Class = mongoose.model('Class');
      const Center = mongoose.model('Center');
      const SessionParticipant = mongoose.model('SessionParticipant');
      const BillingTransaction = mongoose.model('BillingTransaction');

      // User indexes
      await User.collection.createIndex({ email: 1 }, { unique: true });
      await User.collection.createIndex({ username: 1 }, { unique: true });
      await User.collection.createIndex({ role: 1, accountStatus: 1 });
      await User.collection.createIndex({ centerId: 1, role: 1 });

      // Class indexes
      await Class.collection.createIndex({ tutorId: 1, startTime: 1 });
      await Class.collection.createIndex({ studentIds: 1, startTime: 1 });
      await Class.collection.createIndex({ centerId: 1, startTime: 1 });
      await Class.collection.createIndex({ status: 1, startTime: 1 });

      // Session participant indexes
      await SessionParticipant.collection.createIndex({ userId: 1, classId: 1 });
      await SessionParticipant.collection.createIndex({ classId: 1, joinedAt: 1 });

      // Billing indexes
      await BillingTransaction.collection.createIndex({ centerId: 1, periodMonth: 1, periodYear: 1 });
      await BillingTransaction.collection.createIndex({ status: 1, createdAt: -1 });

      console.log('✅ Database indexes created successfully');

    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }

  async setupProductionSecurity() {
    if (!this.isProduction) {
      console.log('⚠️  Skipping production security setup (not in production mode)');
      return;
    }

    try {
      console.log('🔒 Setting up production security measures...');

      // Check if authentication is enabled
      const adminDb = mongoose.connection.db.admin();
      const users = await adminDb.listUsers();
      
      if (users.users.length === 0) {
        console.log('⚠️  WARNING: No database users found. Please set up authentication!');
        console.log('   1. Create a database admin user');
        console.log('   2. Create an application user with limited permissions');
        console.log('   3. Enable authentication in MongoDB configuration');
      } else {
        console.log('✅ Database authentication appears to be configured');
      }

      console.log('🔐 Production Security Checklist:');
      console.log('   □ Enable MongoDB authentication');
      console.log('   □ Use SSL/TLS for database connections');
      console.log('   □ Create application-specific database user');
      console.log('   □ Enable database auditing');
      console.log('   □ Set up regular automated backups');
      console.log('   □ Configure firewall rules');
      console.log('   □ Enable database monitoring');

    } catch (error) {
      console.error('❌ Error checking production security:', error);
    }
  }

  async createBackupScript() {
    const backupScript = `#!/bin/bash

# MongoDB Backup Script for Production
# Run this script regularly to backup your production database

DATABASE_NAME="${mongoose.connection.name || 'tutor_production'}"
BACKUP_DIR="/var/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create the backup
echo "Creating backup of $DATABASE_NAME..."
mongodump --db $DATABASE_NAME --out $BACKUP_FILE

# Compress the backup
tar -czf "$BACKUP_FILE.tar.gz" -C $BACKUP_DIR "backup_$DATE"
rm -rf $BACKUP_FILE

# Clean up old backups (keep only last 7 days)
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.tar.gz"

# Optional: Upload to cloud storage
# aws s3 cp "$BACKUP_FILE.tar.gz" s3://your-backup-bucket/mongodb/
`;

    require('fs').writeFileSync('scripts/backup-database.sh', backupScript);
    console.log('📁 Created backup script: scripts/backup-database.sh');
  }

  async validateData() {
    try {
      console.log('🔍 Validating data integrity...');

      const User = mongoose.model('User');
      const Class = mongoose.model('Class');

      // Check for orphaned records
      const orphanedClasses = await Class.find({
        $or: [
          { tutorId: { $exists: false } },
          { studentIds: { $size: 0 } }
        ]
      }).countDocuments();

      if (orphanedClasses > 0) {
        console.log(`⚠️  Found ${orphanedClasses} classes with missing tutor or students`);
      } else {
        console.log('✅ No orphaned class records found');
      }

      // Check for duplicate emails
      const duplicateEmails = await User.aggregate([
        { $group: { _id: "$email", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]);

      if (duplicateEmails.length > 0) {
        console.log(`⚠️  Found ${duplicateEmails.length} duplicate email addresses`);
        duplicateEmails.forEach(dup => {
          console.log(`   - ${dup._id} (${dup.count} occurrences)`);
        });
      } else {
        console.log('✅ No duplicate email addresses found');
      }

    } catch (error) {
      console.error('❌ Error validating data:', error);
    }
  }

  async run() {
    try {
      await this.connect();
      await this.createIndexes();
      await this.setupProductionSecurity();
      await this.validateData();
      await this.createBackupScript();
      
      console.log('\n🎉 Database setup completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Set up automated backups using the generated script');
      console.log('2. Configure database monitoring');
      console.log('3. Test database connection from your application');
      console.log('4. Set up SSL/TLS for database connections');
      console.log('5. Configure database firewall rules');
      
    } catch (error) {
      console.error('❌ Database setup failed:', error);
    } finally {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from database');
    }
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  const dbSetup = new DatabaseSetup();
  dbSetup.run();
}

module.exports = DatabaseSetup;