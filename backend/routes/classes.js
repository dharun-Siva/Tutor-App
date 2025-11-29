// Logging for /api/classes should be inside route handlers where 'req' is defined
const auth = require('../middleware/auth-postgres');
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
// ...existing code...
// Get classes for logged-in student or tutor (for Join button)
router.get('/my-classes', auth(['student', 'tutor']), async (req, res) => {
  try {
    const userId = req.user.id;
    let classes;
    console.log('🔍 [MY-CLASSES] userId:', userId, 'role:', req.user.role);
    if (req.user.role === 'student') {
      classes = await Class.findAll({
        where: {
          students: { [Op.contains]: [userId] }
        }
      });
      console.log('🔍 [MY-CLASSES] student query result:', classes);
    } else if (req.user.role === 'tutor') {
      classes = await Class.findAll({
        where: {
          tutorId: userId
        }
      });
      console.log('🔍 [MY-CLASSES] tutor query result:', classes);
      // Debug: Log the first class's duration
      if (classes && classes.length > 0) {
        console.log('🔍 [MY-CLASSES] First class duration:', classes[0].duration);
        console.log('🔍 [MY-CLASSES] First class data:', JSON.stringify(classes[0], null, 2));
      }
    } else {
      return res.status(403).json({ success: false, error: 'Invalid role' });
    }
    res.json({ success: true, data: classes });
  } catch (error) {
    console.error('Error fetching my classes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// ...existing code...
// ...existing code...
const Class = require('../models/sequelize/Class'); // Use Sequelize model for PostgreSQL
const User = require('../models/User.postgres'); // Use Sequelize model for Postgres
const { generateImmediateBillingForClass } = require('../services/billingService'); // Import billing service

// Helper function to create billing transactions for Sequelize
async function createBillingTransactionsSequelize(classDoc, paymentStatus = 'unpaid', createdBy = null) {
  try {
    console.log('🔍 [BILLING] Function called with classDoc:', { id: classDoc.id, students: classDoc.students, amount: classDoc.amount });
    const { sequelize, DataTypes } = require('../db'); // Load sequelize when needed
    console.log('🔍 [BILLING] Sequelize loaded:', !!sequelize);
    const ClassBillingTransaction = require('../models/sequelize/ClassBillingTransaction')(sequelize, DataTypes); // Initialize dynamically
    console.log('🔍 [BILLING] ClassBillingTransaction model initialized');
    
    const transactions = [];
    
    // Get students array
    const studentsArray = Array.isArray(classDoc.students) ? classDoc.students : [];
    console.log(`📊 Creating billing transactions for ${studentsArray.length} students for class ${classDoc.id}`);
    
    for (const studentId of studentsArray) {
      const transaction = {
        class_id: classDoc.id,
        tutor_id: classDoc.tutorId,
        student_id: studentId,
        subject: classDoc.subject || 'General',
        status: paymentStatus,
        amount: paymentStatus === 'democlass' ? 0 : (classDoc.amount || 0),
        currency: classDoc.currency || 'USD',
        scheduled_start: classDoc.classDate || new Date(),
        scheduled_end: classDoc.classDate || new Date(),
        duration_minutes: classDoc.duration || classDoc.customDuration || 0
      };
      console.log('📝 Transaction to create:', JSON.stringify(transaction));
      transactions.push(transaction);
    }
    
    if (transactions.length === 0) {
      console.log('⚠️ No transactions to create - no students in class');
      return [];
    }
    
    console.log('📝 About to bulk create', transactions.length, 'transactions');
    // DISABLED: Bulk create moved to new billing system
    // Bills are now auto-generated on 25th of each month from the class_billing table
    // NO LONGER: const created = await ClassBillingTransaction.bulkCreate(transactions);
    console.log(`✅ Skipped ClassBillingTransaction creation - using new class_billing table`);
    return transactions; // Return the transactions array but don't create them
  } catch (error) {
    console.error('❌ Error preparing billing transactions:', error);
    throw error;
  }
}

// Get all classes with pagination and filtering
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      subject,
      tutor,
      student,
      dateFrom,
      dateTo,
      scheduleType
    } = req.query;

  // Build filter object for Sequelize
  const where = {};

  // Debug: Log admin center and filter before querying
  const adminCenterDebug = req.user.center || req.user.assignments?.center;
  console.log('[DEBUG] Admin center:', adminCenterDebug);
  console.log('[DEBUG] User:', req.user);

    // Add center filter (admin can only see classes from their center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id || req.user.center || req.user.assignments?.center;
      if (adminCenter) {
        where.centerId = adminCenter;
      } else {
        // If admin has no center, return empty results
        return res.json({
          success: true,
          data: {
            classes: [],
            pagination: {
              current: parseInt(page),
              total: 0,
              count: 0,
              totalRecords: 0
            }
          }
        });
      }
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (subject && subject !== 'all') {
      // Subject filter - Class.subject stores the subject ID
      where.subject = subject;
    }

    if (tutor) {
      where.tutorId = tutor;
    }

    if (student) {
      where.students = { [Op.contains]: [student] };
    }

    if (scheduleType && scheduleType !== 'all') {
      where.scheduleType = scheduleType;
    }

    // Build OR conditions for search and date filtering
    const orConditions = [];
    
    // Date filtering
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) {
        dateFilter[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter[Op.lte] = new Date(dateTo);
      }
      
      // Apply to both one-time and recurring classes
      orConditions.push(
        { [Op.and]: [{ scheduleType: 'one-time' }, { classDate: dateFilter }] },
        { [Op.and]: [{ scheduleType: 'weekly-recurring' }, { startDate: dateFilter }] }
      );
    }

    // Search functionality
    if (search) {
      orConditions.push(
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } }
      );
    }
    
    // Apply OR conditions if any exist
    if (orConditions.length > 0) {
      where[Op.or] = orConditions;
    }

    // Eager load tutor details for each class
    const classes = await Class.findAll({
      where: where,
      order: [['createdAt', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit,
      include: [
        {
          model: require('../models/sequelize/user'),
          as: 'tutor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }
      ]
    });

    // Fetch all subject IDs from classes and load subject details
    const subjectIds = [...new Set(classes.map(c => c.subject).filter(s => s))];
    let subjectMap = {};
    if (subjectIds.length > 0) {
      const Subject = require('../models/sequelize/Subject');
      const subjects = await Subject.findAll({
        where: { id: subjectIds },
        attributes: ['id', 'subjectCode', 'subjectName']
      });
      subjects.forEach(s => {
        subjectMap[s.id] = s;
      });
    }

    // Fetch all student IDs from classes and load student details
    const allStudentIds = [];
    classes.forEach(cls => {
      if (Array.isArray(cls.students)) {
        allStudentIds.push(...cls.students);
      }
    });
    const uniqueStudentIds = [...new Set(allStudentIds)].filter(Boolean);
    let studentMap = {};
    if (uniqueStudentIds.length > 0) {
      const students = await User.findAll({
        where: { id: uniqueStudentIds },
        attributes: ['id', 'first_name', 'last_name', 'email', 'username']
      });
      students.forEach(s => {
        studentMap[s.id] = s;
      });
    }

    // Attach subject and student details to each class
    const classesWithSubjects = classes.map(classItem => {
      const classData = classItem.toJSON ? classItem.toJSON() : classItem;
      if (classData.subject && subjectMap[classData.subject]) {
        classData.subjectDetails = subjectMap[classData.subject];
        classData.subjectName = subjectMap[classData.subject].subjectName;
        classData.subjectCode = subjectMap[classData.subject].subjectCode;
      }
      
      // Map student IDs to student details
      if (Array.isArray(classData.students)) {
        classData.studentDetails = classData.students
          .map(studentId => studentMap[studentId])
          .filter(Boolean)
          .map(student => ({
            id: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            email: student.email,
            username: student.username
          }));
      } else {
        classData.studentDetails = [];
      }
      
      return classData;
    });

    const total = await Class.count({ where: where });

    res.json({
      success: true,
      data: {
        classes: classesWithSubjects,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get a single class by ID
router.get('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const classItem = await Class.findByPk(req.params.id);

    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can access this class (same center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter && classItem.centerId.toString() !== adminCenter.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: classItem
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a new class
router.post('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    // Check if admin has center assigned
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (!adminCenter) {
        return res.status(400).json({
          success: false,
          error: 'Admin must be assigned to a center before creating classes'
        });
      }
    }

    const {
      title,
      description,
      subject,
      tutor,
      students = [],
      maxCapacity = 10,
      startTime,
      duration,
      customDuration,
      scheduleType,
      classDate,
      recurringDays = [],
      startDate,
      endDate,
      notes,
      paymentStatus = 'unpaid',
      amount,
      currency = 'USD'
    } = req.body;

    console.log('=== CREATE CLASS REQUEST ===');
    console.log('Request body:', req.body);
    console.log('Payment Status from request:', req.body.paymentStatus);

    // Validate required fields
    if (!title || !subject || !tutor || !startTime || !scheduleType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, subject, tutor, startTime, scheduleType'
      });
    }

    // Validate amount
    if (amount === undefined || amount === null || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be a non-negative number'
      });
    }

    // Validate currency
    const validCurrencies = ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD'];
    if (!currency || !validCurrencies.includes(currency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`
      });
    }

    // Validate ObjectId for tutor
    if (!mongoose.Types.ObjectId.isValid(tutor)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tutor ID format'
      });
    }

    // Validate tutor exists and is active
    const tutorUser = await User.findById(tutor);
    if (!tutorUser || tutorUser.role !== 'tutor' || !tutorUser.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive tutor'
      });
    }

    // For admin users, validate tutor is from the same center
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      const tutorCenter = tutorUser.center || tutorUser.assignments?.center;
      if (!tutorCenter || tutorCenter.toString() !== adminCenter.toString()) {
        return res.status(400).json({
          success: false,
          error: 'Tutor must be from the same center as the admin'
        });
      }
    }

    // Validate students ObjectId format and existence
    if (students.length > 0) {
      // First validate all student IDs are valid ObjectIds
      const invalidStudentIds = students.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidStudentIds.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid student ID format: ${invalidStudentIds.join(', ')}`
        });
      }

      const studentUsers = await User.find({
        _id: { $in: students },
        role: 'student',
        isActive: true
      });

      if (studentUsers.length !== students.length) {
        return res.status(400).json({
          success: false,
          error: 'Some students are invalid or inactive'
        });
      }

      // For admin users, validate all students are from the same center
      if (req.user.role === 'admin') {
        const adminCenter = req.user.center || req.user.assignments?.center;
        const invalidStudents = studentUsers.filter(student => {
          const studentCenter = student.center || student.assignments?.center;
          return !studentCenter || studentCenter.toString() !== adminCenter.toString();
        });
        if (invalidStudents.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'All students must be from the same center as the admin'
          });
        }
      }
    }

    // Check capacity
    if (students.length > maxCapacity) {
      return res.status(400).json({
        success: false,
        error: `Number of students (${students.length}) exceeds class capacity (${maxCapacity})`
      });
    }

    // Validate paymentStatus
    if (paymentStatus && !['unpaid', 'paid', 'democlass'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment status. Must be: unpaid, paid, or democlass'
      });
    }

    // Prepare class data
    const classData = {
      title,
      description,
      subject,
      tutor,
      students,
      maxCapacity,
      startTime,
      scheduleType,
      status: 'scheduled',
      paymentStatus,
      amount,
      currency,
      notes,
      createdBy: req.user.id,
      centerId: req.user.center || req.user.assignments?.center || req.user.id // Use admin's center
    };

    // Handle duration
    if (customDuration) {
      classData.customDuration = customDuration;
      classData.duration = 35; // Default value, but customDuration will be used
    } else {
      classData.duration = duration || 35;
    }

    // Handle schedule type specific fields
    if (scheduleType === 'one-time') {
      if (!classDate || !startTime) {
        return res.status(400).json({
          success: false,
          error: 'Class date and start time are required for one-time classes'
        });
      }
      classData.classDate = new Date(classDate);






      // Accepts classDate as 'YYYY-MM-DD' and startTime as 'HH:mm' or 'HH:mm:ss'
      // Validate startTime format and extract 'HH:mm'
      let hhmm = startTime;
      if (/^\d{2}:\d{2}:\d{2}$/.test(startTime)) {
        hhmm = startTime.slice(0,5);
      } else if (!/^\d{2}:\d{2}$/.test(startTime)) {
        // Try to parse as Date and extract time
        const parsed = new Date(startTime);
        if (!isNaN(parsed.getTime())) {
          hhmm = parsed.toTimeString().slice(0,5);
        } else {
          return res.status(400).json({
            success: false,
            error: 'Invalid startTime format for one-time class.'
          });
        }
      }
      // Validate classDate as 'YYYY-MM-DD'
      let classDateStr = classDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
        // Try to parse as Date and extract date
        const parsedDate = new Date(classDate);
        if (!isNaN(parsedDate.getTime())) {
          classDateStr = parsedDate.toISOString().slice(0,10);
        } else {
          return res.status(400).json({
            success: false,
            error: 'Invalid classDate format for one-time class.'
          });
        }
      }
      classData.classDate = classDateStr;
      classData.startTime = hhmm;



      // Combine date and time into a single Date object (ISO string)
      // Accepts classDate as 'YYYY-MM-DD' and startTime as 'HH:mm' or 'HH:mm:ss'
      let fullDateTime;
      if (/^\d{2}:\d{2}$/.test(startTime)) {
        fullDateTime = new Date(`${classDate}T${startTime}:00`);
      } else {
        fullDateTime = new Date(`${classDate}T${startTime}`);
      }
      if (isNaN(fullDateTime.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date or time format for one-time class.'
        });
      }
      // Save classDate as a Date object, but keep startTime as HH:MM string
      classData.classDate = fullDateTime;
      classData.startTime = hhmm; // keep expected string format

      // Check tutor availability for one-time class
      const effectiveDuration = customDuration || duration || 35;
      const isAvailable = await Class.checkTutorAvailability(
        tutor, 
        classData.classDate, 
        startTime, 
        fullDateTime,
        hhmm,
                effectiveDuration
      );

      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          error: 'Tutor is not available at the specified time'
        });
      }
    }
    
    else if (scheduleType === 'weekly-recurring') {
      if (!startDate || !endDate || !recurringDays || recurringDays.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Start date, end date, and recurring days are required for recurring classes'
        });
      }
      
      classData.startDate = new Date(startDate);
      classData.endDate = new Date(endDate);
      classData.recurringDays = recurringDays;

      // Validate date range
      if (classData.startDate >= classData.endDate) {
        return res.status(400).json({
          success: false,
          error: 'End date must be after start date'
        });
      }
    }

  // Auto-generate meeting information
  await Class.generateMeetingInfo(classData);

  // Create the class
  const newClass = new Class(classData);
  await newClass.save();

  console.log('\n🎓 Class created successfully:', { id: newClass.id, title: newClass.title });

  // Generate IMMEDIATE billing for current month when class is scheduled
  // Skip billing for demo classes
  if (students.length > 0 && paymentStatus !== 'democlass') {
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
  } else if (students.length > 0 && paymentStatus === 'democlass') {
    console.log('\n⏭️ [DEMO CLASS] Skipping billing generation for demo class');
  }

    // Generate sessions for recurring classes
    if (scheduleType === 'weekly-recurring') {
      const sessions = [];
      const currentDate = new Date(classData.startDate);
      const effectiveDuration = customDuration || duration || 35;
      const availabilityWarnings = [];

      while (currentDate <= classData.endDate) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        if (recurringDays.includes(dayName)) {
          // Check tutor availability for this session
          const isAvailable = await Class.checkTutorAvailability(
            tutor, 
            new Date(currentDate), 
            startTime, 
            effectiveDuration
          );

          // Create session regardless of availability (for billing purposes)
          // But track availability for warnings
          const session = {
            sessionDate: new Date(currentDate),
            status: 'scheduled'
          };

          if (!isAvailable) {
            availabilityWarnings.push({
              date: new Date(currentDate).toDateString(),
              time: startTime,
              message: 'Tutor has a scheduling conflict'
            });
            // Still create the session but mark it as having a conflict
            session.conflict = true;
          }

          sessions.push(session);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      newClass.sessions = sessions;
      await newClass.save();
      
      // Create billing transactions for each session in recurring classes
      if (students.length > 0 && sessions.length > 0) {
        try {
          console.log('Creating billing transactions for recurring class sessions');
          
          // Create transactions for each session
          for (const session of sessions) {
            await ClassBillingTransaction.createForRecurringClassSession(
              newClass, 
              session.sessionDate, 
              paymentStatus, 
              req.user.id
            );
          }
          
          console.log(`Created billing transactions for ${sessions.length} sessions`);
          
          // Log availability warnings
          if (availabilityWarnings.length > 0) {
            console.warn('⚠️ Availability conflicts detected:');
            availabilityWarnings.forEach(warning => {
              console.warn(`  - ${warning.date} at ${warning.time}: ${warning.message}`);
            });
          }
        } catch (billingError) {
          console.error('Error creating recurring billing transactions:', billingError);
          console.warn('Class created but some billing transactions failed to create');
        }
      }
    }

    else if (scheduleType === 'one-time') {
  // ✅ Add a single session for one-time class
  newClass.sessions = [
    {
      sessionDate: new Date(classData.classDate),
      status: 'scheduled'
    }
  ];
  await newClass.save();
}

    // Populate the response
    const populatedClass = await Class.findByPk(newClass.id);

    console.log('Class created successfully:', populatedClass.title);

    res.status(201).json({
      success: true,
      data: populatedClass
    });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update a class
router.put('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const classId = req.params.id;
    
    // Validate the class ID
    if (!classId || classId === 'undefined' || !mongoose.Types.ObjectId.isValid(classId)) {
      console.log('Invalid class ID:', classId);
      return res.status(400).json({
        success: false,
        error: 'Invalid class ID provided'
      });
    }
    
    const updateData = { ...req.body };

    console.log('=== UPDATE CLASS REQUEST ===');
    console.log('Class ID:', classId);
    console.log('Update data:', updateData);

    // Validate ObjectId fields and remove undefined/invalid ones
    const objectIdFields = ['tutor', 'center', 'createdBy'];
    objectIdFields.forEach(field => {
      if (updateData[field] === 'undefined' || updateData[field] === undefined || updateData[field] === '' || updateData[field] === null) {
        console.log(`Removing invalid ${field}:`, updateData[field]);
        delete updateData[field];
      }
    });

    // Handle students array
    if (updateData.students) {
      if (Array.isArray(updateData.students)) {
        // Remove undefined, null, empty string values from students array
        updateData.students = updateData.students.filter(studentId => 
          studentId && studentId !== 'undefined' && studentId !== null && studentId !== ''
        );
        
        // If all students were invalid, set to empty array
        if (updateData.students.length === 0) {
          updateData.students = [];
        }
      } else if (updateData.students === 'undefined' || updateData.students === undefined || updateData.students === '' || updateData.students === null) {
        updateData.students = [];
      }
    }

    console.log('Cleaned update data:', updateData);

    const existingClass = await Class.findById(classId);
    if (!existingClass) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can modify this class (same center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter && existingClass.center.toString() !== adminCenter.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    // Validate students if provided
    if (updateData.students && updateData.students.length > 0) {
      const studentUsers = await User.find({
        _id: { $in: updateData.students },
        role: 'student',
        isActive: true
      });

      if (studentUsers.length !== updateData.students.length) {
        return res.status(400).json({
          success: false,
          error: 'Some students are invalid or inactive'
        });
      }

      // Check capacity
      const maxCapacity = updateData.maxCapacity || existingClass.maxCapacity;
      if (updateData.students.length > maxCapacity) {
        return res.status(400).json({
          success: false,
          error: `Number of students (${updateData.students.length}) exceeds class capacity (${maxCapacity})`
        });
      }
    }

    // Handle billing transaction updates
    const originalStudents = existingClass.students.map(s => s.toString());
    const newStudents = updateData.students ? updateData.students.map(s => s.toString()) : originalStudents;
    const originalPaymentStatus = existingClass.paymentStatus;
    const newPaymentStatus = updateData.paymentStatus || originalPaymentStatus;
    const originalAmount = existingClass.amount;
    const newAmount = updateData.amount !== undefined ? updateData.amount : originalAmount;
    const originalCurrency = existingClass.currency;
    const newCurrency = updateData.currency || originalCurrency;

    // Validate amount if provided
    if (updateData.amount !== undefined && (updateData.amount < 0)) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a non-negative number'
      });
    }

    // Validate currency if provided
    const validCurrencies = ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD'];
    if (updateData.currency && !validCurrencies.includes(updateData.currency)) {
      return res.status(400).json({
        success: false,
        error: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`
      });
    }

    // Update the class
    await Class.update(updateData, { where: { id: classId } });
    const updatedClass = await Class.findByPk(classId);

    // Handle billing transaction updates after class update
    try {
      // If payment status changed, update existing transactions (but not paid ones)
      if (newPaymentStatus !== originalPaymentStatus) {
        console.log('Payment status changed from', originalPaymentStatus, 'to', newPaymentStatus);
        await ClassBillingTransaction.updateForClassChange(classId, newPaymentStatus, req.user.id);
      }

      // If amount or currency changed, update existing unpaid transactions
      if (newAmount !== originalAmount || newCurrency !== originalCurrency) {
        console.log('Amount/currency changed - updating transactions');
        const updateFields = {};
        if (newAmount !== originalAmount) {
          updateFields.amount = newPaymentStatus === 'democlass' ? 0 : newAmount;
        }
        if (newCurrency !== originalCurrency) {
          updateFields.currency = newCurrency;
        }
        
        await ClassBillingTransaction.updateMany(
          { 
            classId,
            status: { $in: ['unpaid', 'democlass'] } // Don't update paid transactions
          },
          { 
            ...updateFields,
            updatedBy: req.user.id,
            updatedAt: new Date()
          }
        );
        console.log('Updated billing transactions with new amount/currency');
      }

      // Handle student list changes
      const addedStudents = newStudents.filter(s => !originalStudents.includes(s));
      const removedStudents = originalStudents.filter(s => !newStudents.includes(s));

      // Create billing transactions for new students
      if (addedStudents.length > 0) {
        console.log('Adding billing transactions for new students:', addedStudents.length);
        
        try {
          if (existingClass.scheduleType === 'one-time') {
            // For one-time classes, create transactions for each new student
            for (const studentId of addedStudents) {
              // Create a temporary class object with just this student
              const tempClassForStudent = {
                ...updatedClass.toObject(),
                students: [{ _id: studentId }] // Just this student
              };
              
              // Populate the student data
              const studentDoc = await User.findOne({
                where: { id: studentId },
                attributes: ['first_name', 'last_name', 'studentProfile', 'assignments']
              });
              if (studentDoc) {
                tempClassForStudent.students = [studentDoc];
                
                const transactions = await ClassBillingTransaction.createForClass({
                  classId: updatedClass._id,
                  createdBy: req.user.id,
                  ...tempClassForStudent
                }, newPaymentStatus);
                
                console.log(`✅ Created ${transactions.length} billing transaction(s) for student ${studentId}`);
              }
            }
          } else if (existingClass.scheduleType === 'weekly-recurring') {
            // For recurring classes, create transactions for each session
            if (updatedClass.sessions && updatedClass.sessions.length > 0) {
              for (const studentId of addedStudents) {
                for (const session of updatedClass.sessions) {
                  try {
                    await ClassBillingTransaction.createForRecurringClassSession(
                      updatedClass, 
                      session.sessionDate, 
                      newPaymentStatus, 
                      req.user.id
                    );
                  } catch (sessionError) {
                    console.error(`Error creating session transaction:`, sessionError.message);
                  }
                }
              }
              console.log(`✅ Created billing transactions for ${addedStudents.length} students across ${updatedClass.sessions.length} sessions`);
            } else {
              console.warn('No sessions found for recurring class, skipping billing transaction creation');
            }
          }
        } catch (billingError) {
          console.error('Error creating transactions for new students:', billingError.message);
        }
      }

      // Mark transactions as canceled for removed students
      if (removedStudents.length > 0) {
        console.log('Canceling billing transactions for removed students:', removedStudents.length);
        await ClassBillingTransaction.updateMany(
          { 
            classId,
            studentId: { $in: removedStudents },
            status: { $in: ['unpaid', 'democlass'] } // Don't cancel paid transactions
          },
          { 
            status: 'canceled',
            notes: 'Student removed from class',
            updatedBy: req.user.id,
            updatedAt: new Date()
          }
        );
      }

      console.log('Billing transactions updated successfully');
    } catch (billingError) {
      console.error('Error updating billing transactions:', billingError);
      console.warn('Class updated but billing transactions may be inconsistent');
    }

    res.json({
      success: true,
      data: updatedClass
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a class
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const classId = req.params.id;
    
    console.log('🗑️ DELETE route called with ID:', classId);
    console.log('🗑️ ID type:', typeof classId);

    // Validate the ID parameter
    if (!classId || classId === 'undefined' || classId === 'null') {
      console.error('❌ Invalid class ID provided:', classId);
      return res.status(400).json({
        success: false,
        error: 'Invalid class ID provided'
      });
    }

    // Check if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      console.error('❌ Invalid ObjectId format:', classId);
      return res.status(400).json({
        success: false,
        error: 'Invalid class ID format'
      });
    }

  const existingClass = await Class.findByPk(classId);
    if (!existingClass) {
      console.error('❌ Class not found for ID:', classId);
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can delete this class (same center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter && existingClass.center.toString() !== adminCenter.toString()) {
        console.error('❌ Access denied for class deletion:', classId);
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

  await Class.destroy({ where: { id: classId } });
    console.log('✅ Class deleted successfully:', classId);

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('💥 Delete class error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available tutors for a specific subject and time slot
router.get('/available-tutors/:subject', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { subject } = req.params;
    const { date, startTime, duration = 35, customDuration } = req.query;

    if (!date || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Date and start time are required'
      });
    }

    const effectiveDuration = customDuration ? parseInt(customDuration) : parseInt(duration);
    const classDate = new Date(date);

    // Find tutors who teach the subject
    const tutors = await User.find({
      role: 'tutor',
      isActive: true,
      'tutorProfile.subjects': subject,
      ...(req.user.role === 'admin' && req.user.centerId ? { centerId: req.user.centerId } : {})
    }).select('firstName lastName email tutorProfile');

    // Check availability for each tutor
    const availableTutors = [];
    
    for (const tutor of tutors) {
      const isAvailable = await Class.checkTutorAvailability(
        tutor._id,
        classDate,
        startTime,
        effectiveDuration
      );

      if (isAvailable) {
        availableTutors.push(tutor);
      }
    }

    res.json({
      success: true,
      data: availableTutors
    });
  } catch (error) {
    console.error('Get available tutors error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update class status
router.patch('/:id/status', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { status } = req.body;
    const classId = req.params.id;

    if (!['scheduled', 'in-progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const existingClass = await Class.findById(classId);
    if (!existingClass) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can modify this class (same center)
    if (req.user.role === 'admin' && req.user.centerId && 
        existingClass.center.toString() !== req.user.centerId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      { status },
      { new: true }
    ).populate('tutor', 'firstName lastName email tutorProfile')
     .populate('students', 'firstName lastName email');

    res.json({
      success: true,
      data: updatedClass
    });
  } catch (error) {
    console.error('Update class status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get dashboard statistics
router.get('/stats/dashboard', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const filter = {};
    
    // Add center filter for admin
    if (req.user.role === 'admin' && req.user.centerId) {
      filter.center = req.user.centerId;
    }

    const [
      totalClasses,
      scheduledClasses,
      inProgressClasses,
      completedClasses,
      cancelledClasses
    ] = await Promise.all([
      Class.countDocuments(filter),
      Class.countDocuments({ ...filter, status: 'scheduled' }),
      Class.countDocuments({ ...filter, status: 'in-progress' }),
      Class.countDocuments({ ...filter, status: 'completed' }),
      Class.countDocuments({ ...filter, status: 'cancelled' })
    ]);

    res.json({
      success: true,
      data: {
        totalClasses,
        scheduledClasses,
        inProgressClasses,
        completedClasses,
        cancelledClasses
      }
    });
  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get student's classes
router.get('/student/:studentId', auth(['student', 'admin', 'superadmin', 'parent']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, upcoming } = req.query;

    console.log('=== STUDENT CLASSES DEBUG ===');
    console.log('Request user:', req.user);
    console.log('Student ID from params:', studentId);
    console.log('User ID from token:', req.user.id);
    console.log('User role:', req.user.role);

    // Authorization check - students can only see their own classes, parents their children's, admins all
    if (req.user.role === 'student' && req.user.id.toString() !== studentId.toString()) {
      console.log('❌ Access denied - user ID mismatch');
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }


    // Build Sequelize filter
    const where = { };
    if (status && status !== 'all') {
      where.status = status;
    }
    if (upcoming === 'true') {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where[Op.or] = [
        { scheduleType: 'one-time', classDate: { [Op.gte]: today } },
        { scheduleType: 'weekly-recurring', endDate: { [Op.gte]: now } }
      ];
    }
    // Filter by studentId in students array (Postgres: use Op.contains or Op.overlap for array fields)
    where.students = { [Op.contains]: [studentId] };

    const classes = await Class.findAll({
      where,
      order: [['createdAt', 'DESC']]
      // Add include for associations if needed
    });

    // If you need meeting/join info, use helper functions here
    // Example: const joinStatus = canJoinHelper(classItem);
    // For now, just return the raw class data
    res.json({
      success: true,
      data: classes
    });
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tutor's classes
router.get('/tutor/:tutorId', auth(['tutor', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { status, upcoming } = req.query;

    // Authorization check - tutors can only see their own classes, admins all
    if (req.user.role === 'tutor' && req.user.id !== tutorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Build filter
    const filter = { tutor: tutorId };
    
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (upcoming === 'true') {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0); 
      filter.$or = [
        { scheduleType: 'one-time', classDate: { $gte: today } },
        { scheduleType: 'weekly-recurring', endDate: { $gte: now } }
      ];
    }

    const classes = await Class.findAll({
      where: filter,
      order: [['createdAt', 'DESC']]
    });

    // Add meeting info for each class (now embedded in Class model)
    const classesWithSessions = classes.map((classItem) => {
      return {
        ...classItem.toObject(),
        canJoinMeeting: classItem.canJoinMeeting(),
        meetingLink: classItem.meetingLink,
        meetingId: classItem.meetingId,
        nextSession: classItem.getNextSession()
      };
    });

    res.json({
      success: true,
      data: classesWithSessions
    });
  } catch (error) {
    console.error('Get tutor classes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get classes for parent's children
router.get('/parent/:parentId/sessions', auth(['parent', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { parentId } = req.params;
    const { status, upcoming } = req.query;

    console.log('=== PARENT SESSIONS DEBUG ===');
    console.log('Request user:', req.user);
    console.log('Parent ID from params:', parentId);
    console.log('User ID from token:', req.user.id);
    console.log('User role:', req.user.role);

    // Authorization check - parents can only see their own children's classes
    if (req.user.role === 'parent' && req.user.id.toString() !== parentId.toString()) {
      console.log('❌ Access denied - parent ID mismatch');
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get parent user to find their children
    const parent = await User.findOne({
      where: { id: parentId },
      attributes: ['id', 'assignments', 'first_name', 'last_name']
    });
    
    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    let children = [];
    if (parent && parent.assignments && Array.isArray(parent.assignments.children)) {
      children = parent.assignments.children;
    }
    if (!children.length) {
      return res.json({
        success: true,
        data: [],
        message: 'No children assigned to this parent'
      });
    }

    const childrenIds = children.map(child => child.id || child._id);
    console.log('📚 Children IDs:', childrenIds);

    // Build filter for children's classes
    const filter = { students: { [Op.contains]: childrenIds } };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (upcoming === 'true') {
      const now = new Date();
      filter[Op.or] = [
        { scheduleType: 'one-time', classDate: { [Op.gte]: now } },
        { scheduleType: 'weekly-recurring', endDate: { [Op.gte]: now } }
      ];
    }

    const classes = await Class.findAll({
      where: filter,
      order: [['createdAt', 'DESC']]
    });

    // Add meeting session info and child info for each class
    const classesWithSessions = classes.map((classItem) => {
      // Find which children are in this class
      const childrenInClass = (classItem.students || []).filter(student => 
        childrenIds.some(childId => childId.toString() === (student.id || student._id).toString())
      );
      return {
        ...classItem.toJSON(),
        canJoinMeeting: false, // Parents cannot join meetings
        meetingLink: null, // Don't show meeting links to parents
        childrenInClass: childrenInClass,
        nextSession: classItem.getNextSession ? classItem.getNextSession() : null
      };
    });

    res.json({
      success: true,
      data: classesWithSessions,
      totalChildren: children.length,
      childrenNames: children.map(child => `${child.first_name || child.firstName} ${child.last_name || child.lastName}`)
    });
  } catch (error) {
    console.error('Get parent sessions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Join a class meeting
router.post('/:id/join', auth(['student', 'tutor']), async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get the class
    const classItem = await Class.findById(classId);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if user is enrolled in this class
    const isEnrolled = classItem.students.includes(userId) || classItem.tutor.toString() === userId;
    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        error: 'You are not enrolled in this class'
      });
    }

    // Check if class can be joined
    const joinStatus = classItem.canJoin();
    if (!joinStatus.canJoin) {
      return res.status(400).json({
        success: false,
        error: joinStatus.reason
      });
    }

    // Generate meeting info if not exists
    if (!classItem.meetingId) {
      classItem.generateMeeting();
      await classItem.save();
    }

    // Create or update session history
    const SessionHistory = require('../models/SessionHistory');
    let sessionHistory = await SessionHistory.findOne({
      classId: classId,
      sessionDate: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      }
    });

    if (!sessionHistory) {
      // Create new session history for today
      const sessionDate = joinStatus.nextSessionTime || new Date();
      sessionHistory = await classItem.createSessionHistory(sessionDate);
    }

    // Add participant to session history
    await sessionHistory.addParticipant(userId, userRole);

    console.log(`✅ ${userRole} ${userId} joined class ${classItem.title}`);

    res.json({
      success: true,
      message: 'Successfully joined the meeting',
      data: {
        meetingId: classItem.meetingId,
        meetingLink: classItem.meetingLink,
        meetingPlatform: classItem.meetingPlatform,
        sessionId: sessionHistory._id
      }
    });

  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Leave a class meeting
router.post('/:id/leave', auth(['student', 'tutor']), async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.id;

    // Find today's session history
    const SessionHistory = require('../models/SessionHistory');
    const sessionHistory = await SessionHistory.findOne({
      classId: classId,
      sessionDate: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      }
    });

    if (!sessionHistory) {
      return res.status(404).json({
        success: false,
        error: 'No active session found'
      });
    }

    // Remove participant from session
    await sessionHistory.removeParticipant(userId);

    console.log(`📤 User ${userId} left class ${classId}`);

    res.json({
      success: true,
      message: 'Successfully left the meeting',
      data: {
        sessionId: sessionHistory._id,
        sessionCompleted: sessionHistory.status === 'completed'
      }
    });

  } catch (error) {
    console.error('Leave class error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get class session status
router.get('/:id/session-status', auth(['student', 'tutor', 'admin']), async (req, res) => {
  try {
    const classId = req.params.id;

  const classItem = await Class.findByPk(classId);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    const joinStatus = classItem.canJoin();
    const upcomingCount = classItem.getUpcomingSessionCount();

    // Get today's session if exists
    const SessionHistory = require('../models/SessionHistory');
    const todaySession = await SessionHistory.findOne({
      classId: classId,
      sessionDate: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(23, 59, 59, 999)
      }
    }).populate('participants.userId', 'firstName lastName username');

    res.json({
      success: true,
      data: {
        classId: classId,
        meetingId: classItem.meetingId,
        meetingLink: classItem.meetingLink,
        canJoin: joinStatus.canJoin,
        joinReason: joinStatus.reason,
        nextSessionTime: joinStatus.nextSessionTime,
        upcomingSessionCount: upcomingCount,
        currentSession: todaySession ? {
          sessionId: todaySession._id,
          status: todaySession.status,
          actualStartTime: todaySession.actualStartTime,
          actualEndTime: todaySession.actualEndTime,
          participantCount: todaySession.participants.length,
          participants: todaySession.participants
        } : null
      }
    });

  } catch (error) {
    console.error('Get session status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get class session history
router.get('/:id/history', auth(['student', 'tutor', 'admin', 'parent']), async (req, res) => {
  try {
    const classId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    const SessionHistory = require('../models/SessionHistory');
    
    const sessions = await SessionHistory.find({ classId })
      .populate('participants.userId', 'firstName lastName username')
      .sort({ sessionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SessionHistory.countDocuments({ classId });

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
