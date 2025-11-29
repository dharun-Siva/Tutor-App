const mongoose = require('mongoose');
const User = require('../models/User');

// MongoDB connection URL
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/tutoring_db';

async function migrateStudentAvailability() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all students with the old availability format
    const students = await User.find({
      role: 'student',
      $or: [
        // Old format: availability has timeSlots but no start/end
        { 'studentProfile.availability.monday.timeSlots': { $exists: true } },
        { 'studentProfile.availability.tuesday.timeSlots': { $exists: true } },
        { 'studentProfile.availability.wednesday.timeSlots': { $exists: true } },
        { 'studentProfile.availability.thursday.timeSlots': { $exists: true } },
        { 'studentProfile.availability.friday.timeSlots': { $exists: true } },
        { 'studentProfile.availability.saturday.timeSlots': { $exists: true } },
        { 'studentProfile.availability.sunday.timeSlots': { $exists: true } }
      ],
      $and: [
        { 'studentProfile.availability.monday.start': { $exists: false } },
        { 'studentProfile.availability.tuesday.start': { $exists: false } },
        { 'studentProfile.availability.wednesday.start': { $exists: false } },
        { 'studentProfile.availability.thursday.start': { $exists: false } },
        { 'studentProfile.availability.friday.start': { $exists: false } },
        { 'studentProfile.availability.saturday.start': { $exists: false } },
        { 'studentProfile.availability.sunday.start': { $exists: false } }
      ]
    });

    console.log(`Found ${students.length} students to migrate`);

    let migratedCount = 0;

    for (const student of students) {
      let updated = false;
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      for (const day of days) {
        const dayAvailability = student.studentProfile?.availability?.[day];
        
        if (dayAvailability && dayAvailability.timeSlots && dayAvailability.timeSlots.length > 0) {
          // Convert timeSlots to start/end format
          const timeSlots = dayAvailability.timeSlots;
          
          // Find the earliest start time and latest end time
          let earliestStart = null;
          let latestEnd = null;
          
          for (const slot of timeSlots) {
            if (typeof slot === 'string' && slot.includes('-')) {
              const [start, end] = slot.split('-');
              if (start && end) {
                if (!earliestStart || start < earliestStart) {
                  earliestStart = start;
                }
                if (!latestEnd || end > latestEnd) {
                  latestEnd = end;
                }
              }
            }
          }

          // Update the availability structure
          if (earliestStart && latestEnd) {
            student.studentProfile.availability[day] = {
              available: true,
              start: earliestStart,
              end: latestEnd,
              timeSlots: timeSlots // Keep original timeSlots for backward compatibility
            };
            updated = true;
          }
        }
      }

      if (updated) {
        await student.save();
        migratedCount++;
        console.log(`Migrated student: ${student.firstName} ${student.lastName} (${student.email})`);
      }
    }

    console.log(`Migration completed. Updated ${migratedCount} students.`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  migrateStudentAvailability()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration script error:', error);
      process.exit(1);
    });
}

module.exports = migrateStudentAvailability;
