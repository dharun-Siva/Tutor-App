const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config/database/config');
const auth = require('../middleware/auth-postgres');
const Class = require('../models/sequelize/Class');
const User = require('../models/sequelize/user');

// GET /api/classes/my-classes - Get classes for logged-in tutor
router.get('/my-classes', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    console.log('🔍 [MY-CLASSES] Finding classes for tutor:', tutorId);

      const query = `
        WITH class_students AS (
          SELECT 
            c.id as class_id,
            unnest(c.students) as student_id
          FROM "Classes" c
          WHERE c."tutorId" = :tutorId
        )
        SELECT 
          c.id,
          c.title,
          c.subject,
          c.status,
          c."classDate",
          c."scheduleType",
          c."startTime",
          c.duration,
          c."customDuration",
          c."recurringDays",
          c."endDate",
          c."meetingLink",
          c."meetingId",
          array_length(c.students, 1) as total_students,
          COALESCE(
            json_agg(
              json_build_object(
                'id', u.id,
                'firstName', u.first_name,
                'lastName', u.last_name,
                'fullName', TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))
              ) ORDER BY u.first_name, u.last_name
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'::json
          ) as student_details
        FROM "Classes" c
        LEFT JOIN class_students cs ON c.id = cs.class_id
        LEFT JOIN "users" u ON cs.student_id = u.id AND u.role = 'student'
        WHERE c."tutorId" = :tutorId
        GROUP BY c.id, c.title, c.subject, c.status, c."classDate", c."scheduleType", c."startTime", c.duration, c."customDuration", c."recurringDays", c."endDate", c."meetingLink", c."meetingId", c.students
        ORDER BY c.title ASC`;    const classes = await sequelize.query(query, {
      replacements: { tutorId },
      type: sequelize.QueryTypes.SELECT
    });

    console.log('📚 Raw classes data:', classes);

    console.log('📚 Raw query result:', JSON.stringify(classes, null, 2));

    const processedClasses = classes.map(cls => {
      const studentDetails = Array.isArray(cls.student_details) ? cls.student_details : [];
      const validStudents = studentDetails.filter(s => s && s.id);
      
      return {
        id: cls.id,
        title: cls.title,
        description: cls.subject,
        status: cls.status,
        classDate: cls.classDate,
        scheduleType: cls.scheduleType,
        startTime: cls.startTime,
        duration: cls.duration,
        customDuration: cls.customDuration,
        recurringDays: cls.recurringDays,
        endDate: cls.endDate,
        meetingLink: cls.meetingLink,
        meetingId: cls.meetingId,
        studentCount: validStudents.length,
        students: validStudents.map(student => ({
          id: student.id,
          firstName: student.firstName || '',
          lastName: student.lastName || '',
          fullName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown'
        }))
      };
    });

    // Log the processed data for debugging
    processedClasses.forEach(cls => {
      console.log(`📚 Class "${cls.title}":`);
      console.log(`   Status: ${cls.status}`);
      console.log(`   Student count: ${cls.studentCount}`);
      console.log(`   Students:`, cls.students);
    });

    res.json({
      success: true,
      data: processedClasses
    });

  } catch (error) {
    console.error('❌ Error fetching tutor classes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch classes'
    });
  }
});

// GET /api/classes/enrolled-students - Get flattened list of students per class for logged-in tutor
router.get('/enrolled-students', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { page = 1, limit = 0, search } = req.query; // limit=0 means no pagination

    // Build base query: unnest students array and join with users table
    let query = `
      WITH class_students AS (
        SELECT
          c.id as class_id,
          c.title as class_name,
          unnest(c.students) as student_id
        FROM "Classes" c
        WHERE c."tutorId" = $1
      )
      SELECT
        cs.class_id,
        cs.class_name,
        u.id as student_id,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as student_name,
        u.email as student_email,
        (u.student_profile->>'parentId') as parent_id,
        TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) as parent_name,
        COALESCE(u.student_profile->>'enrollmentDate', to_char(u.created_at, 'YYYY-MM-DD')) as join_date
      FROM class_students cs
      JOIN "users" u ON cs.student_id = u.id
      LEFT JOIN "users" p ON (u.student_profile->>'parentId') = p.id
      WHERE u.role = 'student'
    `;

    const params = [tutorId];

    if (search) {
      query += ` AND (LOWER(u.first_name) LIKE $${params.length + 1} OR LOWER(u.last_name) LIKE $${params.length + 1} OR LOWER(u.email) LIKE $${params.length + 1})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    query += ` ORDER BY cs.class_name ASC, student_name ASC`;

    // Add pagination if limit provided (>0)
    if (parseInt(limit) > 0) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), offset);
    }

    const { pool } = require('../db');
    const result = await pool.query(query, params);

    res.json({
      success: true,
      students: result.rows
    });

  } catch (error) {
    console.error('Error fetching enrolled students for tutor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/classes - List classes with filtering, searching, pagination
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

    // Center filter (admin can only see classes from their center)
    if (req.user.role === 'admin') {
      // Use center_id from User model (matches DB column)
      const adminCenter = req.user.center_id || req.user.center || req.user.assignments?.center_id;
      if (adminCenter) {
        where.centerId = adminCenter;
      } else {
        return res.json({
          success: true,
          data: {
            classes: [],
            pagination: {
              current: parseInt(page),
              pages: 1,
              total: 0
            }
          }
        });
      }
    }

    if (status && status !== 'all') {
      where.status = status;
    }
    if (subject && subject !== 'all') {
      console.log('🔍 Subject filter applied:', subject);
      
      // Subject could be either an ID or a name, so we need to find the ID
      const Subject = require('../models/sequelize/Subject');
      
      // First, try to find by subject name
      const subjectRecord = await Subject.findOne({
        where: { subjectName: subject },
        attributes: ['id']
      });
      
      if (subjectRecord) {
        console.log('✅ Found subject by name:', subject, '-> ID:', subjectRecord.id);
        // Match either by ID or by direct name (in case some classes store name directly)
        where[Op.or] = [
          { subject: subjectRecord.id },
          { subject: subject }
        ];
      } else {
        // If not found by name, assume it's an ID, but also match by name
        console.log('⚠️ Subject not found by name, treating as ID:', subject);
        where[Op.or] = [
          { subject: subject },
          { subject: { [Op.iLike]: subject } }
        ];
      }
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
    // Date filtering
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter[Op.gte] = new Date(dateFrom);
      if (dateTo) dateFilter[Op.lte] = new Date(dateTo);
      // Apply to classDate or startDate depending on scheduleType
      where[Op.or] = [
        { scheduleType: 'one-time', classDate: dateFilter },
        { scheduleType: 'weekly-recurring', startDate: dateFilter }
      ];
    }
    // Search functionality
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Query classes
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // First, get ALL classes to see what subjects exist
    const allClassesForDebug = await Class.findAll({
      where: { centerId: req.user.center_id || req.user.center || req.user.assignments?.center_id },
      attributes: ['id', 'subject']
    });
    console.log('📚 ALL CLASSES in center - count:', allClassesForDebug.length);
    console.log('📚 ALL CLASSES subjects:', allClassesForDebug.map(c => ({ id: c.id, subject: c.subject, type: typeof c.subject })));
    
    const { count, rows } = await Class.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    console.log('📚 Query results - Total classes matching filter:', count, 'Rows returned:', rows.length);
    if (rows.length > 0) {
      console.log('📚 First filtered class subject value:', rows[0].subject, 'Type:', typeof rows[0].subject);
    }

    // Fetch tutor details for each class
    const tutorIds = rows.map(cls => cls.tutorId).filter(Boolean);
    const tutors = await User.findAll({
      where: { id: tutorIds },
      attributes: ['id', 'username', 'firstName', 'lastName', 'email']
    });
    const tutorMap = Object.fromEntries(tutors.map(t => [t.id, t]));

    // Fetch subject names for each class
    const subjectIds = rows.map(cls => cls.subject).filter(Boolean);
    const Subject = require('../models/sequelize/Subject');
    
    // Check if subjects are stored as IDs or names
    // Fetch all subjects and build both ID->name and name->name maps
    const subjects = await Subject.findAll({
      attributes: ['id', 'subjectName']
    });
    const subjectMapById = Object.fromEntries(subjects.map(s => [s.id, s.subjectName]));
    const subjectMapByName = Object.fromEntries(subjects.map(s => [s.subjectName?.toLowerCase(), s.subjectName]));
    
    console.log('🎓 Subject mapping - By ID:', Object.keys(subjectMapById).length, 'By Name:', Object.keys(subjectMapByName).length);

    // Fetch student details for each class
    const allStudentIds = [];
    rows.forEach(cls => {
      console.log(`📚 Class ${cls.title} students:`, cls.students, typeof cls.students, Array.isArray(cls.students));
      if (Array.isArray(cls.students)) {
        allStudentIds.push(...cls.students);
      }
    });
    console.log('📚 All student IDs to fetch:', allStudentIds);
    const uniqueStudentIds = [...new Set(allStudentIds)].filter(Boolean);
    console.log('📚 Unique student IDs:', uniqueStudentIds);
    const students = await User.findAll({
      where: { id: uniqueStudentIds },
      attributes: ['id', 'first_name', 'last_name', 'email', 'username']
    });
    console.log('📚 Fetched students:', students.map(s => ({ id: s.id, name: s.first_name + ' ' + s.last_name })));
    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

    // Attach tutor, subject name, and student details to each class
    const classesWithDetails = rows.map(cls => {
      const classObj = cls.toJSON();
      classObj.tutor = tutorMap[classObj.tutorId] || null;
      
      // Try to map subject - first by ID, then by name
      classObj.subjectName = subjectMapById[classObj.subject] || 
                             subjectMapByName[classObj.subject?.toLowerCase()] ||
                             classObj.subject;
      
      // Map student IDs to student details
      if (Array.isArray(classObj.students)) {
        classObj.studentDetails = classObj.students
          .map(studentId => {
            console.log(`  Looking up student ${studentId}:`, studentMap[studentId] ? '✅ Found' : '❌ Not found');
            return studentMap[studentId];
          })
          .filter(Boolean)
          .map(student => ({
            id: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            email: student.email,
            username: student.username
          }));
        console.log(`📋 Class ${classObj.title} - studentDetails:`, classObj.studentDetails);
      } else {
        classObj.studentDetails = [];
      }
      
      return classObj;
    });

    res.json({
      success: true,
      data: {
        classes: classesWithDetails,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(count / limit),
          total: count
        }
      }
    });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/classes/:id - Update a class
router.put('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const classId = req.params.id;
    const updateData = { ...req.body };

    console.log('🔄 UPDATE CLASS REQUEST');
    console.log('Class ID:', classId);
    console.log('Update data:', updateData);

    // Find the existing class
    const existingClass = await Class.findByPk(classId);
    if (!existingClass) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can modify this class (same center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id || req.user.center || req.user.assignments?.center_id;
      if (adminCenter && existingClass.centerId !== adminCenter) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - Not your center'
        });
      }
    }

    // Validate students array if provided
    if (updateData.students && Array.isArray(updateData.students)) {
      // Clean up students array
      updateData.students = updateData.students
        .filter(s => s && s !== 'undefined' && s !== null && s !== '')
        .map(s => String(s));

      // Validate students exist
      if (updateData.students.length > 0) {
        const validStudents = await User.findAll({
          where: { 
            id: updateData.students,
            role: 'student'
          },
          attributes: ['id']
        });

        if (validStudents.length !== updateData.students.length) {
          return res.status(400).json({
            success: false,
            error: 'Some students are invalid or not found'
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
    }

    // Validate tutor if provided
    if (updateData.tutorId) {
      const tutor = await User.findByPk(updateData.tutorId);
      if (!tutor || tutor.role !== 'tutor') {
        return res.status(400).json({
          success: false,
          error: 'Invalid tutor'
        });
      }
    }

    // Update the class
    await Class.update(updateData, { where: { id: classId } });
    const updatedClass = await Class.findByPk(classId);

    // Fetch tutor and subject details for response
    let tutor = null;
    if (updatedClass.tutorId) {
      const tutorData = await User.findByPk(updatedClass.tutorId, {
        attributes: ['id', 'username', 'first_name', 'last_name', 'email']
      });
      if (tutorData) {
        tutor = {
          id: tutorData.id,
          firstName: tutorData.first_name,
          lastName: tutorData.last_name,
          email: tutorData.email
        };
      }
    }

    let subjectName = updatedClass.subject;
    if (updatedClass.subject) {
      const Subject = require('../models/sequelize/Subject');
      
      // Try to fetch subject by ID first
      let subject = await Subject.findByPk(updatedClass.subject, {
        attributes: ['subjectName']
      });
      
      // If not found by ID, try to find by name
      if (!subject) {
        subject = await Subject.findOne({
          where: { subjectName: updatedClass.subject },
          attributes: ['subjectName']
        });
      }
      
      if (subject) {
        subjectName = subject.subjectName;
      }
    }

    // Fetch student details
    let studentDetails = [];
    if (Array.isArray(updatedClass.students) && updatedClass.students.length > 0) {
      const students = await User.findAll({
        where: { id: updatedClass.students },
        attributes: ['id', 'first_name', 'last_name', 'email']
      });
      studentDetails = students.map(s => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        email: s.email
      }));
    }

    const responseClass = updatedClass.toJSON();
    responseClass.tutor = tutor;
    responseClass.subjectName = subjectName;
    responseClass.studentDetails = studentDetails;

    res.json({
      success: true,
      data: responseClass
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/classes/:id - Delete a class
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const classId = req.params.id;

    console.log('🗑️ DELETE CLASS REQUEST');
    console.log('Class ID:', classId);

    // Find the existing class
    const existingClass = await Class.findByPk(classId);
    if (!existingClass) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can delete this class (same center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id || req.user.center || req.user.assignments?.center_id;
      if (adminCenter && existingClass.centerId !== adminCenter) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - Not your center'
        });
      }
    }

    // Delete the class
    await Class.destroy({
      where: { id: classId }
    });

    console.log('✅ Class deleted successfully:', classId);

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/classes/student-classes - Get classes for logged-in student
router.get('/student-classes', auth(['student']), async (req, res) => {
  try {
    const studentId = req.user.id;
    console.log('🎓 [STUDENT-CLASSES] Finding classes for student:', studentId);

    const query = `
      SELECT 
        c.id,
        c.title,
        c.subject,
        c.description,
        c."startTime",
        c."scheduledTimeZone",
        c.duration,
        c."classDate",
        c.status,
        c."paymentStatus",
        c."meetingId",
        c."meetingLink",
        c."meetingPlatform",
        c."joinWindowMinutes",
        t.first_name as tutor_first_name,
        t.last_name as tutor_last_name,
        t.email as tutor_email,
        t.tutor_profile->>'timeZone' as tutor_timezone,
        s.student_profile->>'timeZone' as student_timezone
      FROM "Classes" c
      JOIN "users" t ON c."tutorId" = t.id
      JOIN "users" s ON s.id = :studentId
      WHERE :studentId = ANY(c.students)
        AND c.status = 'scheduled'
      ORDER BY c."classDate" ASC, c."startTime" ASC`;

    const classes = await sequelize.query(query, {
      replacements: { studentId },
      type: sequelize.QueryTypes.SELECT
    });

    console.log('📚 Student classes found:', classes.length);

    // Format the response with timezone conversion
    const convertUTCToTimeZone = (time, timeZone) => {
      if (!time || !timeZone) return time;
      try {
        const [hours, minutes] = time.split(':').map(Number);
        const utcDate = new Date(Date.UTC(2000, 0, 1, hours, minutes));
        const formatter = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone
        });
        return formatter.format(utcDate);
      } catch (e) {
        console.error('Timezone conversion error:', e);
        return time;
      }
    };

    const convertTimeZoneToUTC = (time, timeZone) => {
      if (!time || !timeZone) return time;
      try {
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return time;

        const referenceDate = new Date(2000, 0, 1, hours, minutes, 0, 0);
        const formatter = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone
        });
        
        const parts = formatter.formatToParts(referenceDate);
        const partMap = {};
        parts.forEach(p => {
          partMap[p.type] = p.value;
        });
        
        const tzHours = parseInt(partMap.hour, 10);
        const tzMinutes = parseInt(partMap.minute, 10);
        const offsetMinutes = (hours * 60 + minutes) - (tzHours * 60 + tzMinutes);
        
        let utcHours = hours - Math.floor(offsetMinutes / 60);
        let utcMinutes = minutes - (offsetMinutes % 60);
        
        if (utcMinutes < 0) {
          utcHours--;
          utcMinutes += 60;
        }
        if (utcMinutes >= 60) {
          utcHours++;
          utcMinutes -= 60;
        }
        
        utcHours = ((utcHours % 24) + 24) % 24;
        return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
      } catch (e) {
        console.error('UTC conversion error:', e);
        return time;
      }
    };

    const formattedClasses = classes.map(cls => {
      const scheduledTimeZone = cls.scheduledTimeZone || 'UTC';
      const studentTimeZone = cls.student_timezone || 'UTC';
      
      // Convert from scheduled timezone to UTC, then to student's timezone
      let displayTime = cls.startTime;
      if (scheduledTimeZone !== 'UTC') {
        // First convert from scheduled timezone to UTC
        const utcTime = convertTimeZoneToUTC(cls.startTime, scheduledTimeZone);
        // Then convert from UTC to student's timezone
        displayTime = convertUTCToTimeZone(utcTime, studentTimeZone);
      } else if (studentTimeZone !== 'UTC') {
        // If already in UTC, just convert to student's timezone
        displayTime = convertUTCToTimeZone(cls.startTime, studentTimeZone);
      }
      
      return {
        id: cls.id,
        _id: cls.id,
        title: cls.title,
        subject: cls.subject,
        description: cls.description,
        startTime: displayTime,
        startTimeOriginal: cls.startTime,
        scheduledTimeZone: scheduledTimeZone,
        studentTimeZone: studentTimeZone,
        duration: cls.duration,
        classDate: cls.classDate,
        status: cls.status,
        paymentStatus: cls.paymentStatus,
        meetingId: cls.meetingId,
        meetingLink: cls.meetingLink,
        meetingPlatform: cls.meetingPlatform,
        joinWindowMinutes: cls.joinWindowMinutes,
        tutor: {
          name: `${cls.tutor_first_name} ${cls.tutor_last_name}`,
          firstName: cls.tutor_first_name,
          lastName: cls.tutor_last_name,
          email: cls.tutor_email,
          timeZone: cls.tutor_timezone || 'UTC'
        }
      };
    });

    res.json({
      success: true,
      data: formattedClasses
    });

  } catch (error) {
    console.error('❌ Error fetching student classes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/classes - Create a new class (for registration scheduling)
router.post('/', async (req, res) => {
  try {
    const {
      tutorId,
      studentId,
      parentId,
      subject,
      date,
      time,
      duration = 60,
      studentName
    } = req.body;

    console.log('📝 Creating class from registration:', {
      tutorId, studentId, parentId, subject, date, time, duration
    });

    // Convert date and time to proper format
    const classDateTime = new Date(`${date}T${time}:00`);
    
    // Create class title from student name and subject
    const title = `${subject} - ${studentName}`;
    
    // Generate meeting info
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    const meetingId = `class-${timestamp}-${random}`;
    
    const classData = {
      title,
      description: `Private ${subject} session for ${studentName}`,
      subject,
      tutorId,
      students: [studentId], // Array of student IDs
      maxCapacity: 1, // Private session
      startTime: time,
      duration: parseInt(duration),
      scheduleType: 'one-time',
      classDate: classDateTime,
      status: 'scheduled',
      paymentStatus: 'unpaid',
      amount: 0, // Will be set based on tutor's rate
      currency: 'USD',
      meetingId,
      meetingLink: `/meeting/${meetingId}`,
      meetingPlatform: 'agora',
      joinWindowMinutes: 15
    };

    console.log('📅 Class data to create:', classData);

    const newClass = await Class.create(classData);

    console.log('✅ Class created successfully:', newClass.id);

    res.status(201).json({
      success: true,
      message: 'Class scheduled successfully',
      class: {
        id: newClass.id,
        title: newClass.title,
        subject: newClass.subject,
        date: newClass.classDate,
        time: newClass.startTime,
        duration: newClass.duration,
        meetingId: newClass.meetingId,
        meetingLink: newClass.meetingLink
      }
    });

  } catch (error) {
    console.error('❌ Error creating class:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PATCH /api/classes/:id/status - Update class status
router.patch('/:id/status', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { status } = req.body;
    const classId = req.params.id;

    console.log('📝 UPDATE CLASS STATUS REQUEST:');
    console.log('  Class ID:', classId);
    console.log('  New Status:', status);

    // Only allow admin to manually set status to 'cancelled'
    // 'completed' status is set automatically by cron job when end date passes
    if (!['completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Only "completed" (auto-set) or "cancelled" (manual) are allowed.',
        validStatuses: ['completed', 'cancelled']
      });
    }

    // Find the class
    const classItem = await Class.findByPk(classId);
    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if admin can modify this class (same center)
    if (req.user.role === 'admin' && req.user.center_id && 
        String(classItem.centerId) !== String(req.user.center_id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update the status
    await classItem.update({ status });
    
    console.log('✅ Class status updated:');
    console.log('  Old Status:', classItem.dataValues.status);
    console.log('  New Status:', status);

    res.json({
      success: true,
      message: 'Class status updated successfully',
      data: classItem
    });
  } catch (error) {
    console.error('❌ Update class status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
