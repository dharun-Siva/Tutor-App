const mongoose = require('mongoose');
const HomeworkAssignment = require('../models/HomeworkAssignment');
const Class = require('../models/Class');

async function migrateHomeworkAssignments() {
  try {
    console.log('Starting homework assignments centerId migration...');

    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutor1');
      console.log('Connected to MongoDB');
    }

    // Find all homework assignments that don't have centerId field
    // Use MongoDB native query since Mongoose has issues with $exists on non-existent fields
    const rawAssignments = await mongoose.connection.db.collection('homeworkassignments')
      .find({})
      .toArray();

    console.log(`Total assignments in DB: ${rawAssignments.length}`);

    const assignmentsWithoutCenter = rawAssignments.filter(a => !a.hasOwnProperty('centerId') || a.centerId === null || a.centerId === undefined);
    console.log(`Assignments without centerId: ${assignmentsWithoutCenter.length}`);

    // Populate classId for these assignments
    const assignmentIds = assignmentsWithoutCenter.map(a => a._id);
    const populatedAssignments = await HomeworkAssignment.find({ _id: { $in: assignmentIds } })
      .populate('classId', 'center');

    console.log(`Found ${populatedAssignments.length} assignments to migrate`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const assignment of populatedAssignments) {
      try {
        if (assignment.classId && assignment.classId.center) {
          await HomeworkAssignment.findByIdAndUpdate(assignment._id, {
            centerId: assignment.classId.center
          });
          updatedCount++;
          console.log(`Updated assignment ${assignment._id} with centerId ${assignment.classId.center}`);
        } else {
          console.warn(`Assignment ${assignment._id} has no class or center - skipping`);
          errorCount++;
        }
      } catch (err) {
        console.error(`Error updating assignment ${assignment._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Updated: ${updatedCount} assignments`);
    console.log(`- Errors/Skipped: ${errorCount} assignments`);

    // Verify migration
    const remainingWithoutCenter = await HomeworkAssignment.countDocuments({
      centerId: { $exists: false }
    });

    console.log(`- Remaining without centerId: ${remainingWithoutCenter}`);

    if (remainingWithoutCenter === 0) {
      console.log('✅ Migration successful!');
    } else {
      console.log('⚠️  Migration incomplete - some assignments still missing centerId');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateHomeworkAssignments();
}

module.exports = migrateHomeworkAssignments;