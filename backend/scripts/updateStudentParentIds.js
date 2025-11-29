const mongoose = require('mongoose');
const User = require('../models/User');

async function updateStudentParentIds() {
  try {
    console.log('🔄 Starting student parentId migration...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutor1', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Find all students
    const students = await User.find({ role: 'student' });
    console.log(`📊 Found ${students.length} students to check`);

    let updatedCount = 0;

    for (const student of students) {
      // Check if student has parentId in studentProfile
      if (!student.studentProfile?.parentId) {
        // Look for a parent who has this student in their children
        const parent = await User.findOne({
          role: 'parent',
          'assignments.children': student._id
        });

        if (parent) {
          // Update student's parentId
          student.studentProfile = student.studentProfile || {};
          student.studentProfile.parentId = parent._id;
          await student.save();

          console.log(`✅ Updated student ${student.firstName} ${student.lastName} with parentId: ${parent._id}`);
          updatedCount++;
        }
      }
    }

    console.log(`🎉 Migration completed! Updated ${updatedCount} students with parentId`);

    // Now update existing billing transactions that have null parentId
    const ClassBillingTransaction = require('../models/ClassBillingTransaction');

    const transactionsWithoutParent = await ClassBillingTransaction.find({ parentId: null })
      .populate('studentId', 'studentProfile.parentId');

    console.log(`📊 Found ${transactionsWithoutParent.length} transactions without parentId`);

    let transactionUpdates = 0;
    for (const transaction of transactionsWithoutParent) {
      if (transaction.studentId?.studentProfile?.parentId) {
        await ClassBillingTransaction.findByIdAndUpdate(transaction._id, {
          parentId: transaction.studentId.studentProfile.parentId
        });
        transactionUpdates++;
        console.log(`✅ Updated transaction ${transaction._id} with parentId: ${transaction.studentId.studentProfile.parentId}`);
      }
    }

    console.log(`🎉 Updated ${transactionUpdates} billing transactions with parentId`);

    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
updateStudentParentIds();