/**
 * Cron Jobs Setup - Scheduled tasks for billing system and class status updates
 */

const cron = require('node-cron');
const { autoGenerateBillsForMonth } = require('./billGenerationJobs');
const { updateClassStatuses } = require('./classStatusUpdater');

let scheduledJobs = [];

/**
 * Initialize all cron jobs
 */
function initializeCronJobs() {
  console.log('\n========== INITIALIZING CRON JOBS ==========');

  // Check and generate bills on server startup if date >= 25
  (async () => {
    try {
      const currentDate = new Date();
      const currentDay = currentDate.getDate();

      if (currentDay >= 25) {
        console.log('\n🚀 SERVER STARTUP: Checking if bills need to be generated...');
        console.log(`Current date: ${currentDate.toISOString()}`);
        console.log(`Current day: ${currentDay} (Threshold: 25)`);

        // Generate bills for NEXT MONTH ONLY
        let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        let nextMonthYear = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        
        console.log(`\n📅 Generating bills for NEXT MONTH ONLY: ${nextMonthYear}`);
        const result = await autoGenerateBillsForMonth(nextMonthYear);
        console.log(`Bill generation for ${nextMonthYear} completed:`, result);
      }
    } catch (error) {
      console.error('Error checking bills on server startup:', error);
    }
  })();

  // Schedule bill generation - runs every day at 00:05 AM
  // Checks if today is the 25th or later, and generates bills for upcoming months
  // This ensures bills are generated even if system date changes
  const billGenerationJob = cron.schedule('5 0 * * *', async () => {
    try {
      const currentDate = new Date();
      const currentDay = currentDate.getDate();

      // If today is 25th or later, generate bills for upcoming months
      if (currentDay >= 25) {
        console.log('\n========== CRON JOB: Bill Generation Started ==========');
        console.log(`Execution time: ${new Date().toISOString()}`);
        console.log(`Current day: ${currentDay} (Threshold: 25)`);

        // Generate bills for NEXT month
        let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        let nextMonthYear = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        
        const result = await autoGenerateBillsForMonth(nextMonthYear);
        console.log(`Bill generation for ${nextMonthYear} completed:`, result);

        // Also generate for month after next if today is 25th-28th
        if (currentDay <= 28) {
          nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1);
          nextMonthYear = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
          
          const result2 = await autoGenerateBillsForMonth(nextMonthYear);
          console.log(`Bill generation for ${nextMonthYear} completed:`, result2);
        }

        console.log('========== CRON JOB: Bill Generation Ended ==========\n');
      }
    } catch (error) {
      console.error('Error in bill generation cron job:', error);
    }
  });

  scheduledJobs.push({
    name: 'Bill Generation (Daily check at 00:05 AM)',
    job: billGenerationJob,
    schedule: '5 0 * * *'
  });

  console.log('✓ Bill Generation cron job scheduled: Daily at 00:05 AM');
  console.log('  → Checks if date is 25th or later');
  console.log('  → Automatically generates bills for upcoming months');
  console.log('  → Works even if system date changes');

  // Schedule class status update - runs every 5 minutes
  // Auto-transitions classes from 'scheduled' to 'completed' when end dates pass
  const classStatusUpdateJob = cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('\n========== CRON JOB: Class Status Update Started ==========');
      console.log(`Execution time: ${new Date().toISOString()}`);
      
      const result = await updateClassStatuses();
      
      if (result.success) {
        console.log(`✅ Status Update Result: ${result.updated} classes updated`);
        if (result.classes.length > 0) {
          result.classes.forEach(cls => {
            console.log(`   - ${cls.title} (${cls.type})`);
          });
        }
      } else {
        console.error(`❌ Status Update Error: ${result.error}`);
      }
      
      console.log('========== CRON JOB: Class Status Update Ended ==========\n');
    } catch (error) {
      console.error('Error in class status update cron job:', error);
    }
  });

  scheduledJobs.push({
    name: 'Class Status Update (Every 5 minutes)',
    job: classStatusUpdateJob,
    schedule: '*/5 * * * *'
  });

  console.log('✓ Class Status Update cron job scheduled: Every 5 minutes');
  console.log('  → Auto-completes one-time classes after end time');
  console.log('  → Auto-completes recurring classes after end date');
  console.log('  → Uses UTC for all date comparisons');
  console.log('========== CRON JOBS INITIALIZED ==========\n');
}

/**
 * Stop all cron jobs
 */
function stopAllCronJobs() {
  console.log('\n========== STOPPING ALL CRON JOBS ==========');

  for (const jobInfo of scheduledJobs) {
    jobInfo.job.stop();
    console.log(`✓ Stopped: ${jobInfo.name}`);
  }

  scheduledJobs = [];
  console.log('========== ALL CRON JOBS STOPPED ==========\n');
}

/**
 * Get list of all scheduled jobs
 */
function getScheduledJobs() {
  return scheduledJobs.map(j => ({
    name: j.name,
    schedule: j.schedule,
    status: j.job._status === 'started' ? 'Running' : 'Stopped'
  }));
}

module.exports = {
  initializeCronJobs,
  stopAllCronJobs,
  getScheduledJobs
};
