const mongoose = require('mongoose');
const Center = require('../models/Center');

// MongoDB connection URL - replace with your actual URL if different
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/tutor-app';

async function migrateCenterStatus() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URL);
        console.log('Connected to MongoDB');

        // Update all centers without a status to have 'active' status
        const result = await Center.updateMany(
            { status: { $exists: false } },
            { $set: { status: 'active' } }
        );

        console.log(`Migration completed successfully:`);
        console.log(`${result.matchedCount} centers found`);
        console.log(`${result.modifiedCount} centers updated`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
migrateCenterStatus();