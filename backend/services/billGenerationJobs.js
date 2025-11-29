/**
 * Bill Generation Jobs - Handles scheduled bill generation
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');
const { generateOrUpdateBill } = require('./billingService');

// Import models
const Class = require('../models/sequelize/Class');
const User = require('../models/sequelize/user');
const ClassBilling = require('../models/sequelize/ClassBilling')(sequelize, DataTypes);

/**
 * Get all students who have classes scheduled for a specific month
 * @param {string} monthYear - Format: "YYYY-MM"
 * @returns {Promise<Array>} Array of student objects with their parent info
 */
async function getStudentsWithClassesInMonth(monthYear) {
  try {
    console.log(`\n========== BILL GENERATION JOB START ==========`);
    console.log(`Getting students with classes in month: ${monthYear}`);

    const [year, month] = monthYear.split('-');
    const monthStartDate = new Date(year, parseInt(month) - 1, 1);
    const monthEndDate = new Date(year, parseInt(month), 0, 23, 59, 59);

    console.log(`📅 Checking classes for ${monthYear}: ${monthStartDate.toDateString()} to ${monthEndDate.toDateString()}`);

    // Find all classes that could have instances in this month
    const allClasses = await Class.findAll({
      where: {
        status: { [Op.in]: ['scheduled'] }
      },
      raw: true
    });

    console.log(`Found ${allClasses.length} total classes in database`);

    // Extract unique students with classes in this month
    const studentSet = new Set();
    const studentClassMap = new Map();

    for (const cls of allClasses) {
      let hasClassInMonth = false;

      // Check one-time classes
      if (cls.scheduleType === 'one-time') {
        const classDate = new Date(cls.classDate);
        if (classDate >= monthStartDate && classDate <= monthEndDate) {
          hasClassInMonth = true;
          console.log(`✅ One-time class "${cls.title}" on ${classDate.toDateString()} is in ${monthYear}`);
        }
      }
      
      // Check recurring classes
      else if (cls.scheduleType === 'weekly-recurring' || cls.scheduleType === 'one-time-recurring') {
        const recurringStartDate = new Date(cls.startDate);
        const recurringEndDate = new Date(cls.endDate);

        // Check if recurring class overlaps with this month
        if (recurringStartDate <= monthEndDate && recurringEndDate >= monthStartDate) {
          // Calculate how many instances fall in this month
          let classCount = 0;
          const recurringDays = cls.recurringDays || [];
          
          let currentDate = new Date(monthStartDate);
          while (currentDate <= monthEndDate) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

            // Check if this date matches a recurring day AND is within the class's date range
            if (recurringDays.includes(dayName) && currentDate >= recurringStartDate && currentDate <= recurringEndDate) {
              classCount++;
            }

            currentDate.setDate(currentDate.getDate() + 1);
          }

          if (classCount > 0) {
            hasClassInMonth = true;
            console.log(`✅ Recurring class "${cls.title}" has ${classCount} instances in ${monthYear}`);
          }
        }
      }

      // If class has instances in this month, add students
      if (hasClassInMonth) {
        const students = cls.students || [];
        for (const studentId of students) {
          studentSet.add(studentId);
          if (!studentClassMap.has(studentId)) {
            studentClassMap.set(studentId, []);
          }
          studentClassMap.get(studentId).push(cls.id);
        }
      }
    }

    console.log(`✅ Found ${studentSet.size} unique students with classes in ${monthYear}`);

    // Get student objects with their parent info
    const students = await User.findAll({
      where: {
        id: { [Op.in]: Array.from(studentSet) },
        role: 'student'
      },
      attributes: ['id', 'firstName', 'lastName', 'student_profile', 'assignments'],
      raw: true
    });

    console.log(`Retrieved ${students.length} student records with parent info`);

    // Extract parent_id from student_profile for each student
    const studentsWithParentId = students.map(student => {
      let parentId = null;
      
      if (student.student_profile) {
        // Try to get parent_id from student_profile
        if (typeof student.student_profile === 'string') {
          try {
            const profile = JSON.parse(student.student_profile);
            parentId = profile.parent_id || profile.parentId || profile.parent;
          } catch (e) {
            console.warn(`Failed to parse student_profile for student ${student.id}`);
          }
        } else if (typeof student.student_profile === 'object') {
          parentId = student.student_profile.parent_id || student.student_profile.parentId || student.student_profile.parent;
        }
      }

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        parentId: parentId,
        assignments: student.assignments
      };
    });

    return studentsWithParentId;
  } catch (error) {
    console.error('Error getting students with classes in month:', error);
    throw error;
  }
}

/**
 * Auto-generate bills for all students with classes in a specific month
 * This should be called on the 25th of each month for the NEXT month
 * @param {string} monthYear - Format: "YYYY-MM" (e.g., "2025-12" for December)
 * @returns {Promise<Object>} Summary of generated bills
 */
async function autoGenerateBillsForMonth(monthYear) {
  try {
    console.log(`\n========== AUTO-GENERATING BILLS FOR ${monthYear} ==========`);
    const startTime = Date.now();

    const students = await getStudentsWithClassesInMonth(monthYear);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log(`Starting bill generation for ${students.length} students...`);

    // Generate bills for each student
    for (const student of students) {
      try {
        let parentId = student.parentId;

        // If student has no parentId in student_profile, try fallback: search parent's assignments.children
        if (!parentId) {
          console.log(`🔍 No parent_id in student_profile for ${student.id}, searching parent assignments...`);
          
          const allParents = await User.findAll({
            where: { role: 'parent' },
            attributes: ['id', 'firstName', 'lastName', 'assignments'],
            raw: true
          });

          for (const parent of allParents) {
            const children = parent.assignments?.children || [];
            if (Array.isArray(children) && children.includes(student.id)) {
              parentId = parent.id;
              console.log(`✅ Found parent ${parent.firstName} ${parent.lastName} (${parent.id}) via assignments for student ${student.id}`);
              break;
            }
          }
        }

        if (!parentId) {
          console.warn(`⚠️ Student ${student.id} (${student.firstName} ${student.lastName}) has no parent assigned, skipping`);
          errorCount++;
          continue;
        }

        const bill = await generateOrUpdateBill(student.id, parentId, monthYear);
        console.log(`✓ Bill generated for student ${student.id}: ${bill.total_classes_count} classes, ${bill.amount} ${bill.currency}`);
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Error generating bill for student ${student.id}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = {
      monthYear,
      totalStudents: students.length,
      successCount,
      errorCount,
      errors,
      duration: `${duration}s`,
      timestamp: new Date()
    };

    console.log(`\n========== BILL GENERATION COMPLETED ==========`);
    console.log(`Summary:`, summary);

    return summary;
  } catch (error) {
    console.error('Error in auto-generate bills:', error);
    throw error;
  }
}

/**
 * Manually trigger bill generation for current month
 * (For testing or manual execution)
 * @returns {Promise<Object>} Summary of generated bills
 */
async function triggerBillGenerationForCurrentMonth() {
  const currentDate = new Date();
  const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  console.log(`\nManually triggering bill generation for current month: ${currentMonthYear}`);
  return autoGenerateBillsForMonth(currentMonthYear);
}

/**
 * Manually trigger bill generation for next month
 * (For testing or early generation)
 * @returns {Promise<Object>} Summary of generated bills
 */
async function triggerBillGenerationForNextMonth() {
  const currentDate = new Date();
  const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const nextMonthYear = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

  console.log(`\nManually triggering bill generation for next month: ${nextMonthYear}`);
  return autoGenerateBillsForMonth(nextMonthYear);
}

module.exports = {
  getStudentsWithClassesInMonth,
  autoGenerateBillsForMonth,
  triggerBillGenerationForCurrentMonth,
  triggerBillGenerationForNextMonth
};
