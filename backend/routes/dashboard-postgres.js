
const express = require('express');
const router = express.Router();
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');
const User = require('../models/sequelize/user'); // Correct Sequelize User model (lowercase)
const Subject = require('../models/sequelize/Subject');
const Class = require('../models/sequelize/Class');
const { Op } = require('sequelize');
const auth = require('../middleware/auth-postgres');
const { generateImmediateBillingForClass } = require('../services/billingService'); // Import billing service
const gradesRoutes = require('./grades-postgres');

// Admin: Get all subjects for dropdown filtered by center ID
router.get('/admin/subjects', auth(['admin']), async (req, res) => {
  try {
    const subjects = await Subject.findAll({
      where: {
        centerId: req.user.center_id // Filter by admin's center ID
      },
      attributes: ['id', 'subjectCode', 'subjectName', 'gradeId', 'centerId', 'createdAt', 'updatedAt'],
      order: [['subjectName', 'ASC']] // Order alphabetically
    });
    res.json({ subjects });
  } catch (error) {
    console.error('Fetch Subjects Error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects.', details: error.message });
  }
});

router.post('/admin/classes/sample', async (req, res) => {
  try {
    const sampleClass = await Class.create({
      title: 'Math Demo Class',
      description: 'Sample class for math demo',
      subject: 'Mathematics',
      tutorId: 1, // Change to a valid tutor ID in your DB
      students: [2, 3], // Change to valid student IDs
      maxCapacity: 20,
      startTime: '10:00',
      duration: 45,
      customDuration: null,
      scheduleType: 'one-time',
      classDate: new Date(),
      recurringDays: null,
      startDate: null,
      endDate: null,
      status: 'scheduled',
      paymentStatus: 'unpaid',
      amount: 100,
      currency: 'USD',
      meetingId: 'demo123',
      meetingLink: 'https://meet.example.com/demo123',
      meetingPlatform: 'meet',
      joinWindowMinutes: 10,
      createdBy: 1, // Change to a valid admin ID
      centerId: 1, // Change to a valid center ID
      notes: 'This is a sample class.',
      sessions: [{ sessionDate: new Date(), status: 'scheduled', attendees: [], notes: 'First session' }]
    });
    res.status(201).json({ message: 'Sample class inserted.', class: sampleClass });
  } catch (error) {
    res.status(500).json({ error: 'Failed to insert sample class.', details: error.message });
  }
});
// Admin: List Scheduled Classes
router.get('/admin/classes', auth(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, sortField = 'createdAt', sortDirection = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const order = [[sortField, sortDirection.toLowerCase() === 'desc' ? 'DESC' : 'ASC']];

    const { count, rows } = await Class.findAndCountAll({
      offset,
      limit: parseInt(limit),
      order
    });

    res.json({
      classes: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('List Classes Error:', error);
    res.status(500).json({ error: 'Failed to fetch classes.', details: error.message });
  }
});
// ...existing code...
// ...existing code...
// ...existing code...
// ...existing code...
// ...existing code...

// SuperAdmin Dashboard
router.get('/superadmin', auth(['superadmin']), async (req, res) => {
  try {
    // Get counts from PostgreSQL
    const userCounts = await User.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['role']
    });

    const dashboardData = {
      totalUsers: userCounts.reduce((acc, curr) => acc + parseInt(curr.get('count')), 0),
      usersByRole: Object.fromEntries(
        userCounts.map(count => [count.get('role'), parseInt(count.get('count'))])
      ),
      recentUsers: await User.findAll({
        where: {
          center_id: req.user.center_id,
          role: {
            [Op.in]: ['tutor', 'student', 'parent']
          }
        },
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'email', 'username', 'role', 'firstName', 'lastName', 'createdAt']
      })
    };

    res.json({
      message: 'SuperAdmin Dashboard Data',
      user: req.user,
      data: dashboardData
    });

  } catch (error) {
    console.error('SuperAdmin Dashboard Error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
});

// Mount grades routes under admin dashboard
router.use('/admin/grades', auth(['admin']), gradesRoutes);

// Admin Dashboard
router.get('/admin', auth(['admin']), async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // Get counts from PostgreSQL
    const userCounts = await User.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        center_id: req.user.center_id,
        role: {
          [Op.in]: ['tutor', 'student', 'parent']
        }
      },
      group: ['role']
    });

    const dashboardData = {
      totalUsers: userCounts.reduce((acc, curr) => acc + parseInt(curr.get('count')), 0),
      usersByRole: Object.fromEntries(
        userCounts.map(count => [count.get('role'), parseInt(count.get('count'))])
      ),
      recentUsers: await User.findAll({
        where: {
          role: {
            [Op.in]: ['tutor', 'student', 'parent']
          }
        },
        limit: 5,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'email', 'username', 'role', 'firstName', 'lastName', 'createdAt']
      })
    };

    res.json({
      message: 'Admin Dashboard Data',
      user: req.user,
      data: dashboardData
    });

  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
});

module.exports = router;

// Admin: Schedule a Class
router.post('/admin/classes', auth(['admin']), async (req, res) => {
  try {
    // All fields from the Sequelize Class model
    const {
      title, description, subject, tutorId, students, maxCapacity,
      startTime, duration, customDuration, scheduleType, classDate,
      recurringDays, startDate, endDate, status, paymentStatus,
      amount, currency, meetingPlatform,
      joinWindowMinutes, createdBy, centerId, notes, sessions
    } = req.body;

    // Helper to validate and sanitize date fields
    function sanitizeDate(dateValue) {
      if (!dateValue) return null;
      const dateObj = new Date(dateValue);
      // Check for valid date
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }

    const safeClassDate = sanitizeDate(classDate);
    const safeStartDate = sanitizeDate(startDate);
    const safeEndDate = sanitizeDate(endDate);

    
    // ✅ CONFLICT CHECKING LOGIC
    // Convert startTime HH:MM to minutes
    const [hours, minutes] = startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const effectiveDuration = customDuration || duration || 35;
    const endMinutes = startMinutes + effectiveDuration;

    console.log('📅 Conflict Check - Tutor:', tutorId, 'Time:', startTime, 'Duration:', effectiveDuration);

    // Check tutor availability
    if (scheduleType === 'one-time') {
      // Find all one-time classes for this tutor on the same date
      const conflictingClasses = await Class.findAll({
        where: {
          tutorId: tutorId,
          scheduleType: 'one-time',
          status: 'scheduled', // Only check scheduled classes (not completed ones)
          classDate: {
            [Op.gte]: new Date(safeClassDate.getFullYear(), safeClassDate.getMonth(), safeClassDate.getDate()),
            [Op.lt]: new Date(safeClassDate.getFullYear(), safeClassDate.getMonth(), safeClassDate.getDate() + 1)
          }
        }
      });

      console.log(`🔍 Found ${conflictingClasses.length} classes on this date for tutor`);

      // Check for time conflicts
      for (const cls of conflictingClasses) {
        const [clsHours, clsMins] = cls.startTime.split(':').map(Number);
        const clsStartMinutes = clsHours * 60 + clsMins;
        const clsEndMinutes = clsStartMinutes + (cls.customDuration || cls.duration);

        // Check if time slots overlap: (start < other.end) && (end > other.start)
        if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
          console.log('❌ CONFLICT FOUND:', {
            newClass: { start: startMinutes, end: endMinutes },
            existingClass: { start: clsStartMinutes, end: clsEndMinutes }
          });
          return res.status(400).json({
            success: false,
            error: 'Tutor is not available at the specified time. There is a conflict with another class.'
          });
        }
      }
    } else if (scheduleType === 'weekly-recurring') {
      // For recurring classes, find all classes that overlap with the recurring days
      const dayName = new Date(safeStartDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      const conflictingClasses = await Class.findAll({
        where: {
          tutorId: tutorId,
          status: 'scheduled', // Only check scheduled classes
          [Op.or]: [
            // One-time classes during the recurring period
            {
              scheduleType: 'one-time',
              classDate: {
                [Op.gte]: safeStartDate,
                [Op.lte]: safeEndDate
              }
            },
            // Recurring classes that overlap
            {
              scheduleType: 'weekly-recurring',
              startDate: { [Op.lte]: safeEndDate },
              endDate: { [Op.gte]: safeStartDate }
            }
          ]
        }
      });

      console.log(`🔍 Found ${conflictingClasses.length} recurring classes`);

      // Check for time conflicts
      for (const cls of conflictingClasses) {
        const [clsHours, clsMins] = cls.startTime.split(':').map(Number);
        const clsStartMinutes = clsHours * 60 + clsMins;
        const clsEndMinutes = clsStartMinutes + (cls.customDuration || cls.duration);

        // For one-time classes, check if they fall on any of the recurring days
        if (cls.scheduleType === 'one-time') {
          const oneTimeDay = new Date(cls.classDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          if (recurringDays.includes(oneTimeDay)) {
            if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
              console.log('❌ CONFLICT with one-time class');
              return res.status(400).json({
                success: false,
                error: 'Tutor is not available at the specified time. There is a conflict with another class.'
              });
            }
          }
        } else if (cls.scheduleType === 'weekly-recurring') {
          // Check if recurring days overlap
          const daysOverlap = cls.recurringDays && cls.recurringDays.some(day => recurringDays.includes(day));
          if (daysOverlap) {
            if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
              console.log('❌ CONFLICT with recurring class');
              return res.status(400).json({
                success: false,
                error: 'Tutor is not available at the specified time. There is a conflict with another class.'
              });
            }
          }
        }
      }
    }

    console.log('✅ No tutor conflicts found, checking student conflicts...');

    // ✅ CHECK STUDENT AVAILABILITY
    if (students && students.length > 0) {
      console.log('📚 Checking conflicts for', students.length, 'students');

      if (scheduleType === 'one-time') {
        // Find all classes for any of these students on the same date
        const studentConflicts = await Class.findAll({
          where: {
            scheduleType: 'one-time',
            status: 'scheduled',
            classDate: {
              [Op.gte]: new Date(safeClassDate.getFullYear(), safeClassDate.getMonth(), safeClassDate.getDate()),
              [Op.lt]: new Date(safeClassDate.getFullYear(), safeClassDate.getMonth(), safeClassDate.getDate() + 1)
            },
            students: { [Op.overlap]: students }
          }
        });

        console.log(`🔍 Found ${studentConflicts.length} classes with these students on this date`);

        // Check for time conflicts
        for (const cls of studentConflicts) {
          const [clsHours, clsMins] = cls.startTime.split(':').map(Number);
          const clsStartMinutes = clsHours * 60 + clsMins;
          const clsEndMinutes = clsStartMinutes + (cls.customDuration || cls.duration);

          // Check if time slots overlap
          if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
            // Find which students have conflict
            const conflictingStudents = students.filter(s => cls.students.includes(s));
            console.log('❌ STUDENT CONFLICT FOUND for:', conflictingStudents);
            return res.status(400).json({
              success: false,
              error: `One or more students are not available at the specified time. They have a conflict with another class.`
            });
          }
        }
      } else if (scheduleType === 'weekly-recurring') {
        // Find all recurring classes for any of these students that overlap
        const studentConflicts = await Class.findAll({
          where: {
            status: 'scheduled',
            [Op.or]: [
              {
                scheduleType: 'one-time',
                classDate: {
                  [Op.gte]: safeStartDate,
                  [Op.lte]: safeEndDate
                },
                students: { [Op.overlap]: students }
              },
              {
                scheduleType: 'weekly-recurring',
                startDate: { [Op.lte]: safeEndDate },
                endDate: { [Op.gte]: safeStartDate },
                students: { [Op.overlap]: students }
              }
            ]
          }
        });

        console.log(`🔍 Found ${studentConflicts.length} recurring classes with these students`);

        // Check for time conflicts
        for (const cls of studentConflicts) {
          const [clsHours, clsMins] = cls.startTime.split(':').map(Number);
          const clsStartMinutes = clsHours * 60 + clsMins;
          const clsEndMinutes = clsStartMinutes + (cls.customDuration || cls.duration);

          if (cls.scheduleType === 'one-time') {
            const oneTimeDay = new Date(cls.classDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            if (recurringDays.includes(oneTimeDay)) {
              if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
                console.log('❌ STUDENT CONFLICT with one-time class');
                return res.status(400).json({
                  success: false,
                  error: 'One or more students are not available at the specified time. They have a conflict with another class.'
                });
              }
            }
          } else if (cls.scheduleType === 'weekly-recurring') {
            const daysOverlap = cls.recurringDays && cls.recurringDays.some(day => recurringDays.includes(day));
            if (daysOverlap) {
              if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
                console.log('❌ STUDENT CONFLICT with recurring class');
                return res.status(400).json({
                  success: false,
                  error: 'One or more students are not available at the specified time. They have a conflict with another class.'
                });
              }
            }
          }
        }
      }
    }

    console.log('✅ No student conflicts found, creating class...');

    // Generate meetingId and meetingLink in readable format
    function generateMeetingId() {
      const random = () => Math.random().toString(36).substring(2, 10);
      return `class-${random()}-${random().substring(0, 6)}`;
    }
    const meetingId = generateMeetingId();
    const meetingLink = `/meeting/${meetingId}`;

    // Create the class
    const newClass = await Class.create({
      title, description, subject, tutorId, students, maxCapacity,
      startTime, duration, customDuration, scheduleType,
      classDate: safeClassDate,
      recurringDays,
      startDate: safeStartDate,
      endDate: safeEndDate,
      status, paymentStatus,
      amount, currency, meetingId, meetingLink, meetingPlatform,
      joinWindowMinutes, createdBy, centerId, notes, sessions
    });

    // ✅ GENERATE IMMEDIATE BILLING FOR CURRENT MONTH
    // Skip billing for demo classes
    if (students && students.length > 0 && paymentStatus !== 'democlass') {
      try {
        console.log('\n💳 [NEW CLASS] Generating immediate billing for students...');
        
        // Prepare class data for billing (with all the necessary info)
        const classDataForBilling = {
          id: newClass.id,
          title: newClass.title,
          subject: newClass.subject,
          amount: parseFloat(newClass.amount),
          currency: newClass.currency,
          students: students,
          paymentStatus: paymentStatus,
          scheduleType: newClass.scheduleType,
          classDate: newClass.classDate,
          startDate: newClass.startDate,
          endDate: newClass.endDate,
          recurringDays: newClass.recurringDays
        };

        // Call immediate billing function
        const generatedBills = await generateImmediateBillingForClass(classDataForBilling);
        
        console.log(`\n✅ Generated ${generatedBills.length} immediate bills for current month`);
        
      } catch (billingError) {
        console.error('\n❌ Error generating immediate billing:', billingError);
        console.error('Stack trace:', billingError.stack);
        // Don't fail the class creation if billing fails, but log it
        console.warn('⚠️ Class created successfully but immediate billing failed to generate');
      }
    } else if (students && students.length > 0 && paymentStatus === 'democlass') {
      console.log('\n⏭️ [DEMO CLASS] Skipping billing generation for demo class');
    }

    res.status(201).json({ message: 'Class scheduled successfully.', class: newClass });
  } catch (error) {
    console.error('Schedule Class Error:', error);
    if (error.stack) console.error(error.stack);
    res.status(500).json({ error: 'Failed to schedule class.', details: error.message, stack: error.stack });
  }
});
