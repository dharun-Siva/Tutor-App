const mongoose = require('mongoose');
const User = require('../models/User');

// MongoDB connection URL
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/tutoring_db';

async function migrateStudentTimeSlotsToObjects() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all students with old timeSlots format (string arrays)
    const students = await User.find({
      role: 'student',
      'studentProfile.availability': { $exists: true }
    });

    console.log(`Found ${students.length} students to check for migration`);

    let migratedCount = 0;

    for (const student of students) {
      let updated = false;
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      for (const day of days) {
        const dayAvailability = student.studentProfile?.availability?.[day];
        
        if (dayAvailability && dayAvailability.timeSlots && Array.isArray(dayAvailability.timeSlots)) {
          // Check if timeSlots are strings (old format) 
          const hasStringSlots = dayAvailability.timeSlots.some(slot => typeof slot === 'string');
          
          if (hasStringSlots) {
            // Convert string timeSlots to object format
            const newTimeSlots = [];
            
            for (const slot of dayAvailability.timeSlots) {
              if (typeof slot === 'string') {
                // Handle different string formats
                if (slot.includes('-')) {
                  // Format: "9:00 AM - 10:00 AM" or "9:00-10:00"
                  const parts = slot.split('-').map(s => s.trim());
                  if (parts.length === 2) {
                    newTimeSlots.push({
                      startTime: convertTo24Hour(parts[0]),
                      endTime: convertTo24Hour(parts[1])
                    });
                  }
                } else if (slot.includes('to')) {
                  // Format: "9:00 AM to 10:00 AM"
                  const parts = slot.split('to').map(s => s.trim());
                  if (parts.length === 2) {
                    newTimeSlots.push({
                      startTime: convertTo24Hour(parts[0]),
                      endTime: convertTo24Hour(parts[1])
                    });
                  }
                } else {
                  // Single time - assume 1 hour slot
                  const startTime = convertTo24Hour(slot);
                  const endTime = addOneHour(startTime);
                  newTimeSlots.push({
                    startTime: startTime,
                    endTime: endTime
                  });
                }
              } else if (typeof slot === 'object' && slot.startTime && slot.endTime) {
                // Already in correct format, keep as is
                newTimeSlots.push(slot);
              }
            }

            // Update the timeSlots format
            student.studentProfile.availability[day].timeSlots = newTimeSlots;
            updated = true;
          }
        }
      }

      if (updated) {
        try {
          await student.save();
          migratedCount++;
          console.log(`Migrated student: ${student.firstName} ${student.lastName} (${student.email})`);
        } catch (saveError) {
          console.error(`Failed to save student ${student.email}:`, saveError.message);
        }
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

function convertTo24Hour(timeString) {
  if (!timeString) return '';
  
  // Remove extra spaces
  timeString = timeString.trim();
  
  // If already in 24-hour format (HH:MM), return as is
  if (/^\d{1,2}:\d{2}$/.test(timeString)) {
    const [hour, minute] = timeString.split(':');
    return `${hour.padStart(2, '0')}:${minute}`;
  }
  
  // Handle 12-hour format with AM/PM
  const match = timeString.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?$/i);
  if (!match) return timeString; // Return original if can't parse
  
  let hour = parseInt(match[1]);
  const minute = match[2] || '00';
  const ampm = match[3] ? match[3].toUpperCase() : '';
  
  // Convert to 24-hour format
  if (ampm === 'PM' && hour !== 12) {
    hour += 12;
  } else if (ampm === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

function addOneHour(timeString) {
  if (!timeString) return '';
  
  const [hourStr, minute] = timeString.split(':');
  let hour = parseInt(hourStr);
  
  hour = (hour + 1) % 24; // Add 1 hour, wrap around at 24
  
  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

// Run the migration
if (require.main === module) {
  migrateStudentTimeSlotsToObjects();
}

module.exports = migrateStudentTimeSlotsToObjects;
