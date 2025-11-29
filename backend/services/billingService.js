/**
 * Billing Service - Handles all billing calculations and operations
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');

// Import models
const Class = require('../models/sequelize/Class');
const User = require('../models/sequelize/user'); // Correct Sequelize User model
const ClassBilling = require('../models/sequelize/ClassBilling')(sequelize, DataTypes);

/**
 * Calculate the number of classes in a specific month for a student
 * @param {string} studentId - The student's ID
 * @param {string} monthYear - Format: "YYYY-MM" (e.g., "2025-11")
 * @returns {Promise<{classes: Array, totalClasses: number, totalAmount: number}>}
 */
async function getStudentClassesForMonth(studentId, monthYear) {
  try {
    const [year, month] = monthYear.split('-');
    const startDate = new Date(year, parseInt(month) - 1, 1); // First day of month
    const endDate = new Date(year, parseInt(month), 0, 23, 59, 59); // Last day of month

    console.log(`Calculating classes for student ${studentId} in ${monthYear}`);
    console.log(`Date range: ${startDate} to ${endDate}`);

    // Find all classes for this student in the given month
    const classes = await Class.findAll({
      where: {
        students: {
          [Op.contains]: [studentId]
        },
        status: {
          [Op.in]: ['scheduled']
        }
      },
      raw: true,
      attributes: ['id', 'title', 'amount', 'currency', 'scheduleType', 'classDate', 'startDate', 'endDate', 'recurringDays']
    });

    console.log(`Found ${classes.length} classes for student in database`);

    let classesInMonth = [];
    let totalAmount = 0;

    // Process each class to check if it falls in the given month
    for (const cls of classes) {
      // Handle one-time classes
      if (cls.scheduleType === 'one-time') {
        const classDate = new Date(cls.classDate);
        if (classDate >= startDate && classDate <= endDate) {
          classesInMonth.push({
            id: cls.id,
            title: cls.title,
            amount: parseFloat(cls.amount),
            type: 'one-time',
            date: classDate
          });
          totalAmount += parseFloat(cls.amount);
        }
      }
      // Handle recurring classes
      else if (cls.scheduleType === 'weekly-recurring' || cls.scheduleType === 'one-time-recurring') {
        const recurringStartDate = new Date(cls.startDate);
        const recurringEndDate = new Date(cls.endDate);

        // Check if recurring class overlaps with the given month
        if (recurringStartDate <= endDate && recurringEndDate >= startDate) {
          const recurringDays = cls.recurringDays || [];

          // Calculate all dates in this month for this recurring class
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            // Check if this date is a valid recurring day
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

            if (recurringDays.includes(dayName)) {
              // Make sure the date is within the recurring class's start and end dates
              if (currentDate >= recurringStartDate && currentDate <= recurringEndDate) {
                classesInMonth.push({
                  id: cls.id,
                  title: cls.title,
                  amount: parseFloat(cls.amount),
                  type: 'recurring',
                  date: new Date(currentDate)
                });
                totalAmount += parseFloat(cls.amount);
              }
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }
    }

    console.log(`Total classes in month: ${classesInMonth.length}, Total amount: ${totalAmount}`);

    return {
      classes: classesInMonth,
      totalClasses: classesInMonth.length,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      currency: classes.length > 0 ? classes[0].currency : 'USD'
    };
  } catch (error) {
    console.error('Error calculating classes for month:', error);
    throw error;
  }
}

/**
 * Generate or update a bill for a student for a specific month
 * @param {string} studentId - The student's ID
 * @param {string} parentId - The parent's ID
 * @param {string} monthYear - Format: "YYYY-MM"
 * @returns {Promise<Object>} Created/updated bill object
 */
async function generateOrUpdateBill(studentId, parentId, monthYear) {
  try {
    console.log(`Generating bill for student ${studentId}, parent ${parentId}, month ${monthYear}`);

    // Calculate classes and amounts for this month
    const classData = await getStudentClassesForMonth(studentId, monthYear);

    if (classData.totalClasses === 0) {
      console.log(`No classes found for student ${studentId} in month ${monthYear}, creating zero bill`);
    }

    // Check if bill already exists
    let bill = await ClassBilling.findOne({
      where: {
        student_id: studentId,
        parent_id: parentId,
        month_year: monthYear
      }
    });

    // Calculate due date (25th of current month if bill is for future month, or today if current month)
    const [year, month] = monthYear.split('-');
    const dueDate = new Date(year, parseInt(month) - 1, 25); // 25th of the billing month

    if (bill) {
      // Update existing bill
      console.log(`Updating existing bill for ${studentId} in ${monthYear}`);
      bill.total_classes_count = classData.totalClasses;
      bill.amount = classData.totalAmount;
      bill.currency = classData.currency;
      bill.class_ids = classData.classes.map(c => c.id);
      bill.due_date = dueDate;
      bill.notes = bill.notes || ''; // Preserve existing notes

      await bill.save();
      return bill;
    } else {
      // Create new bill
      console.log(`Creating new bill for ${studentId} in ${monthYear}`);
      bill = await ClassBilling.create({
        student_id: studentId,
        parent_id: parentId,
        month_year: monthYear,
        total_classes_count: classData.totalClasses,
        amount: classData.totalAmount,
        currency: classData.currency,
        status: 'unpaid',
        billing_generated_date: new Date(),
        due_date: dueDate,
        class_ids: classData.classes.map(c => c.id),
        notes: `Auto-generated bill for ${monthYear}`
      });

      return bill;
    }
  } catch (error) {
    console.error('Error generating bill:', error);
    throw error;
  }
}

/**
 * Get all bills for a parent (all their children's bills)
 * @param {string} parentId - The parent's ID
 * @param {string} monthYear - Optional: filter by specific month
 * @returns {Promise<Array>} Array of bills
 */
async function getParentBills(parentId, monthYear = null) {
  try {
    const query = {
      parent_id: parentId
    };

    if (monthYear) {
      query.month_year = monthYear;
    }

    const bills = await ClassBilling.findAll({
      where: query,
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['month_year', 'DESC'], ['createdAt', 'DESC']],
      raw: false
    });

    return bills;
  } catch (error) {
    console.error('Error fetching parent bills:', error);
    throw error;
  }
}

/**
 * Get current month's bills for a parent
 * @param {string} parentId - The parent's ID
 * @returns {Promise<Array>} Array of bills for current month
 */
async function getParentCurrentMonthBills(parentId) {
  const currentDate = new Date();
  const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  return getParentBills(parentId, monthYear);
}

/**
 * Handle class deletion - recalculate affected bills
 * @param {string} classId - The deleted class ID
 * @returns {Promise<Array>} Array of affected bills
 */
async function handleClassDeletion(classId) {
  try {
    console.log(`Handling deletion of class ${classId}`);

    // Find all bills that include this class
    const affectedBills = await ClassBilling.findAll({
      where: {
        class_ids: {
          [Op.contains]: [classId]
        }
      }
    });

    console.log(`Found ${affectedBills.length} bills affected by class deletion`);

    const updatedBills = [];

    for (const bill of affectedBills) {
      // Remove the class from the bill
      bill.class_ids = (bill.class_ids || []).filter(id => id !== classId);

      // Recalculate the bill
      const classData = await getStudentClassesForMonth(bill.student_id, bill.month_year);
      bill.total_classes_count = classData.totalClasses;
      bill.amount = classData.totalAmount;

      // Add note about the deletion
      const deletionNote = `\nClass ${classId} was deleted on ${new Date().toLocaleDateString()}`;
      bill.notes = (bill.notes || '') + deletionNote;

      // If bill is paid and amount changed, flag for admin
      if (bill.status === 'paid' && bill.amount < parseFloat(bill.amount)) {
        bill.notes += ' - REFUND REQUIRED (class cancelled after payment)';
      }

      await bill.save();
      updatedBills.push(bill);
    }

    return updatedBills;
  } catch (error) {
    console.error('Error handling class deletion:', error);
    throw error;
  }
}

/**
 * Generate IMMEDIATE bill when a class is scheduled (for remaining classes in current month)
 * This is called when a new class is created
 * 
 * @param {Object} classData - The class object with id, students, amount, etc.
 * @param {string} scheduleType - 'one-time' or 'weekly-recurring'
 * @param {Date} classDate - For one-time classes
 * @param {Date} startDate - For recurring classes
 * @param {Date} endDate - For recurring classes
 * @param {Array} recurringDays - For recurring classes (e.g., ['monday', 'wednesday'])
 * @returns {Promise<Array>} Array of created/updated bills
 */
async function generateImmediateBillingForClass(classData) {
  try {
    console.log(`\n🔔 [IMMEDIATE BILLING] Generating bills for class: ${classData.id}`);
    console.log(`Schedule Type: ${classData.scheduleType}`);
    
    const studentIds = classData.students || [];
    const createdBills = [];
    
    if (studentIds.length === 0) {
      console.log('⚠️ No students enrolled in this class, skipping billing');
      return [];
    }

    // Get current month in YYYY-MM format
    const today = new Date();
    const currentMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    console.log(`📅 Current Month: ${currentMonthYear}`);
    console.log(`📅 Date Range: ${currentMonthStart} to ${currentMonthEnd}`);

    // Process each student
    for (const studentId of studentIds) {
      try {
        // Get student details including parentId from student_profile or assignments
        const student = await User.findByPk(studentId, {
          attributes: ['id', 'firstName', 'lastName', 'student_profile', 'assignments']
        });

        if (!student) {
          console.warn(`⚠️ Student ${studentId} not found, skipping billing`);
          continue;
        }

        // Get parentId from student_profile (try multiple field names for compatibility)
        let parentId = student.student_profile?.parent_id || student.student_profile?.parentId || student.student_profile?.parent;
        
        // If no parent_id in student_profile, find parent from parent's assignments.children
        if (!parentId) {
          console.log(`🔍 No parent_id in student_profile, searching for parent in assignments...`);
          // Find all parents and check if this student is in their children array
          const allParents = await User.findAll({
            where: { role: 'parent' },
            attributes: ['id', 'firstName', 'lastName', 'assignments'],
            raw: true
          });
          
          for (const parent of allParents) {
            const children = parent.assignments?.children || [];
            if (children.includes(studentId)) {
              parentId = parent.id;
              console.log(`✅ Found parent ${parent.firstName} ${parent.lastName} (${parent.id}) via assignments`);
              break;
            }
          }
        }
        
        // If still no parent_id, skip this student for now
        // (they need to be linked to a parent first)
        if (!parentId) {
          console.warn(`⚠️ Student ${studentId} (${student.firstName} ${student.lastName}) has no parent linked`);
          continue;
        }

        console.log(`👤 Student: ${student.firstName} ${student.lastName}, Parent: ${parentId}`);

        // Calculate remaining classes in current month for THIS specific class
        let remainingClassesInMonth = 0;
        let classIds = [];

        if (classData.scheduleType === 'one-time') {
          // One-time class
          const classDate = new Date(classData.classDate);
          
          // Check if class date is in current month
          if (classDate >= currentMonthStart && classDate <= currentMonthEnd) {
            remainingClassesInMonth = 1;
            classIds = [classData.id];
            console.log(`📅 One-time class on ${classDate.toDateString()} is in current month`);
          } else {
            console.log(`📅 One-time class on ${classDate.toDateString()} is NOT in current month`);
          }
        } 
        else if (classData.scheduleType === 'weekly-recurring') {
          // Recurring class - count remaining classes in current month
          const recurringStart = new Date(classData.startDate);
          const recurringEnd = new Date(classData.endDate);
          const recurringDays = classData.recurringDays || [];

          console.log(`🔄 Recurring class from ${recurringStart.toDateString()} to ${recurringEnd.toDateString()}`);
          console.log(`🔄 Days: ${recurringDays.join(', ')}`);

          // Count occurrences from today onwards in current month
          let currentDate = new Date(today);
          
          while (currentDate <= currentMonthEnd && currentDate <= recurringEnd) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

            if (recurringDays.includes(dayName) && currentDate >= recurringStart) {
              remainingClassesInMonth++;
              classIds.push(classData.id); // All instances use same class ID
              console.log(`  ✅ ${dayName.toUpperCase()} ${currentDate.toDateString()} - Class ${remainingClassesInMonth}`);
            }

            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        // If there are classes in current month, generate bill
        if (remainingClassesInMonth > 0) {
          console.log(`💰 Remaining classes this month: ${remainingClassesInMonth}`);
          
          const billAmount = parseFloat(classData.amount) * remainingClassesInMonth;
          const dueDate = new Date(today.getFullYear(), today.getMonth(), 25); // 25th of current month

          console.log(`💰 Bill Amount: ${billAmount} ${classData.currency} (${classData.amount} × ${remainingClassesInMonth})`);

          // Always create a NEW bill entry for each class (one-time, weekly, etc. have separate entries)
          try {
            const newBill = await ClassBilling.create({
              student_id: studentId,
              parent_id: parentId,
              month_year: currentMonthYear,
              total_classes_count: remainingClassesInMonth,
              amount: billAmount,
              currency: classData.currency,
              status: 'unpaid',
              billing_generated_date: new Date(),
              due_date: dueDate,
              class_ids: [classData.id],
              notes: `Auto-generated for class: ${classData.title || classData.subject}`
            });

            createdBills.push(newBill);
            console.log(`✅ Bill created for student ${studentId}, Class: ${classData.title}, Amount: ${billAmount}`);
          } catch (createError) {
            console.error(`❌ Error creating bill for student ${studentId}:`, createError.message);
            if (createError.errors) {
              createError.errors.forEach(err => {
                console.error(`   - ${err.path}: ${err.message}`);
              });
            }
            console.error('Full error:', createError);
            throw createError;
          }
        } else {
          console.log(`⏭️ No classes scheduled for current month, skipping bill for student ${studentId}`);
        }

        // ===== NEW: Generate bill for NEXT MONTH ONLY if current day >= 25 =====
        console.log(`\n📅 Checking for next month bill...`);
        console.log(`Today is: ${today.getDate()} (Threshold: 25)`);
        
        const todayDay = today.getDate();
        
        // ONLY generate next month bill if today >= 25
        // Future months will be handled by cron job on the 25th of their previous month
        if (todayDay >= 25 && classData.scheduleType === 'weekly-recurring') {
          const recurringStart = new Date(classData.startDate);
          const recurringEnd = new Date(classData.endDate);
          const recurringDays = classData.recurringDays || [];

          // Check NEXT month only
          let nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          
          // Only process if next month is within the class's recurring end date
          if (nextMonthDate <= recurringEnd) {
            const nextMonthYear = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
            const nextMonthStart = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 1);
            const nextMonthEnd = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0, 23, 59, 59);

            console.log(`  📌 Next month ${nextMonthYear}: Today is ${todayDay} (>= 25), GENERATING IMMEDIATELY`);
            
            // Count classes in next month
            let nextMonthClassCount = 0;
            let currentDate = new Date(nextMonthStart);
            
            while (currentDate <= nextMonthEnd) {
              const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              
              if (recurringDays.includes(dayName) && currentDate >= recurringStart && currentDate <= recurringEnd) {
                nextMonthClassCount++;
              }
              
              currentDate.setDate(currentDate.getDate() + 1);
            }

            if (nextMonthClassCount > 0) {
              const nextMonthBillAmount = parseFloat(classData.amount) * nextMonthClassCount;
              const nextMonthDueDate = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), 25);

              try {
                const nextMonthBill = await ClassBilling.create({
                  student_id: studentId,
                  parent_id: parentId,
                  month_year: nextMonthYear,
                  total_classes_count: nextMonthClassCount,
                  amount: nextMonthBillAmount,
                  currency: classData.currency,
                  status: 'unpaid',
                  billing_generated_date: new Date(),
                  due_date: nextMonthDueDate,
                  class_ids: [classData.id],
                  notes: `Auto-generated for class: ${classData.title || classData.subject}`
                });

                createdBills.push(nextMonthBill);
                console.log(`  ✅ Next month bill created for ${nextMonthYear}: ${nextMonthClassCount} classes, ${nextMonthBillAmount} ${classData.currency}`);
              } catch (nextMonthError) {
                console.error(`  ❌ Error creating next month bill for ${nextMonthYear}:`, nextMonthError.message);
              }
            }
          }
        } else if (todayDay < 25 && classData.scheduleType === 'weekly-recurring') {
          console.log(`  ⏳ Today is ${todayDay} (< 25), future month bills will be generated by cron on 25th of each month`);
        } else if (classData.scheduleType === 'one-time') {
          console.log(`  ℹ️ One-time class: future months will be handled by cron job`);
        }

      } catch (studentError) {
        console.error(`❌ Error processing billing for student ${studentId}:`, studentError.message);
        if (studentError.errors) {
          studentError.errors.forEach(err => {
            console.error(`   Field Error - ${err.path}: ${err.message}`);
          });
        }
        // Continue processing other students
      }
    }

    console.log(`\n✅ [IMMEDIATE BILLING] Generated ${createdBills.length} bills`);
    return createdBills;

  } catch (error) {
    console.error('❌ [IMMEDIATE BILLING] Error generating immediate billing:', error);
    throw error;
  }
}

module.exports = {
  getStudentClassesForMonth,
  generateOrUpdateBill,
  getParentBills,
  getParentCurrentMonthBills,
  handleClassDeletion,
  generateImmediateBillingForClass
};
