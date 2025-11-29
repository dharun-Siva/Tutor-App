/**
 * Class Status Updater Service
 * Automatically updates class status from 'scheduled' to 'completed' when end dates pass
 * Uses UTC for all date comparisons
 */

const Class = require('../models/sequelize/Class');
const { Op } = require('sequelize');

/**
 * Update class statuses based on end dates
 * - For one-time classes: check if scheduledEndTime has passed
 * - For recurring classes: check if endDate has passed
 * @returns {Promise<{updated: number, classes: Array}>}
 */
async function updateClassStatuses() {
  try {
    const currentDateTime = new Date(); // UTC time
    console.log(`\n🔄 CLASS STATUS UPDATER: Starting at ${currentDateTime.toISOString()}`);

    let updatedCount = 0;
    const updatedClasses = [];

    // ============================================
    // UPDATE ONE-TIME CLASSES
    // ============================================
    // For one-time classes, use classDate + startTime to determine end
    const oneTimeClasses = await Class.findAll({
      where: {
        scheduleType: 'one-time',
        status: 'scheduled',
        classDate: {
          [Op.not]: null
        }
      },
      raw: true
    });

    console.log(`📋 Found ${oneTimeClasses.length} one-time classes with 'scheduled' status`);

    for (const classItem of oneTimeClasses) {
      try {
        // Parse classDate and startTime to calculate end time
        const classDate = new Date(classItem.classDate); // classDate in UTC
        const [hours, minutes] = classItem.startTime.split(':').map(Number);
        
        const classStartTime = new Date(classDate);
        classStartTime.setUTCHours(hours, minutes, 0, 0);
        
        // Calculate end time: start time + duration
        const duration = classItem.customDuration || classItem.duration || 35; // Default 35 min
        const classEndTime = new Date(classStartTime.getTime() + duration * 60000); // Add duration in ms

        // If end time has passed, mark as completed
        if (classEndTime <= currentDateTime) {
          await Class.update(
            { status: 'completed' },
            { where: { id: classItem.id } }
          );
          updatedCount++;
          updatedClasses.push({
            id: classItem.id,
            title: classItem.title,
            type: 'one-time',
            endTime: classEndTime.toISOString()
          });
          console.log(`  ✅ Updated one-time class: ${classItem.title} (ended at ${classEndTime.toISOString()})`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing one-time class ${classItem.id}:`, error.message);
      }
    }

    // ============================================
    // UPDATE RECURRING CLASSES
    // ============================================
    // For recurring classes, check if endDate has passed (represents end of recurring period)
    const recurringClasses = await Class.findAll({
      where: {
        scheduleType: 'weekly-recurring',
        status: 'scheduled',
        endDate: {
          [Op.not]: null
        }
      },
      raw: true
    });

    console.log(`📋 Found ${recurringClasses.length} recurring classes with 'scheduled' status`);

    for (const classItem of recurringClasses) {
      try {
        // For recurring classes, the endDate is when the recurring pattern ends
        // Add 23:59:59 to the end date to ensure it covers the entire last day
        const endDate = new Date(classItem.endDate);
        endDate.setUTCHours(23, 59, 59, 999);

        // If end date has passed, mark as completed
        if (endDate <= currentDateTime) {
          await Class.update(
            { status: 'completed' },
            { where: { id: classItem.id } }
          );
          updatedCount++;
          updatedClasses.push({
            id: classItem.id,
            title: classItem.title,
            type: 'weekly-recurring',
            endDate: endDate.toISOString()
          });
          console.log(`  ✅ Updated recurring class: ${classItem.title} (ended on ${endDate.toISOString()})`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing recurring class ${classItem.id}:`, error.message);
      }
    }

    console.log(`\n✨ CLASS STATUS UPDATER: Completed`);
    console.log(`   Total classes updated: ${updatedCount}`);
    console.log(`========================================\n`);

    return {
      success: true,
      updated: updatedCount,
      classes: updatedClasses,
      timestamp: currentDateTime.toISOString()
    };
  } catch (error) {
    console.error('❌ CLASS STATUS UPDATER: Error:', error);
    return {
      success: false,
      error: error.message,
      updated: 0,
      classes: []
    };
  }
}

module.exports = {
  updateClassStatuses
};
