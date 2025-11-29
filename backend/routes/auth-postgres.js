const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/sequelize/user'); // Now uses explicit tableName: 'Users'
const generateObjectId = User.generateObjectId || require('../models/sequelize/user').generateObjectId;

const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_this_in_production';

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: Math.ceil(15 * 60 / 60)
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  try {
    console.log('🔍 Login attempt received:', { identifier: req.body.identifier });
    const { identifier, password } = req.body;

    // Validate input
    if (!identifier || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        error: 'Email/username and password are required' 
      });
    }

    // Find user by email or username (normal columns)
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ]
      }
    });

    if (!user || !['superadmin', 'admin', 'tutor', 'student', 'parent'].includes(user.role)) {
      console.log('❌ User not found or invalid role:', identifier);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ User found with role:', user.role);

    // Verify password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', identifier);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Debug: Print user.center_id before signing JWT
    console.log('LOGIN DEBUG: user.center_id =', user.center_id, '| type:', typeof user.center_id);
    // Generate tokens
    // Include center_id in JWT for admin/superadmin/student/parent/tutor
    const jwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    if ((user.role === 'admin' || user.role === 'superadmin' || user.role === 'student' || user.role === 'parent' || user.role === 'tutor') && user.center_id) {
      jwtPayload.center_id = String(user.center_id);
    }
    const token = jwt.sign(
      jwtPayload,
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Prepare role-specific data
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
  center_id: user.center_id ? String(user.center_id) : null
    };

    // Add role-specific permissions
    switch (user.role) {
      case 'superadmin':
        userData.permissions = ['all'];
        userData.isSuperAdmin = true;
        break;
      case 'admin':
        userData.permissions = ['manage_users', 'manage_classes', 'manage_tutors'];
        userData.isAdmin = true;
        break;
      case 'tutor':
        userData.permissions = ['manage_classes', 'manage_homework'];
        userData.isTutor = true;
        break;
      case 'student':
        userData.permissions = ['view_classes', 'submit_homework'];
        userData.isStudent = true;
        break;
      case 'parent':
        userData.permissions = ['view_child_progress', 'view_classes'];
        userData.isParent = true;
        break;
    }

    // Send response
    res.json({
      message: 'Login successful',
      user: userData,
      token,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Get user
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const newToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token: newToken
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current authenticated user
router.get('/me', require('../middleware/auth-postgres')(), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// Public endpoint to get available tutors for registration
router.get('/tutors', async (req, res) => {
  try {
    console.log('📚 Fetching tutors for registration...');
    
    const tutors = await User.findAll({
      where: { 
        role: 'tutor',
        is_active: true 
      },
      attributes: [
        'id',
        'username', 
        'first_name', 
        'last_name', 
        'email',
        'tutor_profile'
      ],
      order: [['first_name', 'ASC']]
    });

    console.log(`✅ Found ${tutors.length} active tutors`);
    
    res.json({
      success: true,
      tutors: tutors
    });

  } catch (error) {
    console.error('❌ Error fetching tutors:', error);
    res.status(500).json({
      error: 'Failed to fetch tutors',
      details: error.message
    });
  }
});

// Public endpoint: get classes for a tutor on a specific date (used by registration UI)
router.get('/tutors/:id/classes', async (req, res) => {
  try {
    const tutorId = req.params.id;
    const { date } = req.query; // expected YYYY-MM-DD
    const Class = require('../models/sequelize/Class');
    const { Op } = require('sequelize');

    if (!tutorId || !date) {
      return res.status(400).json({ success: false, error: 'Tutor id and date are required' });
    }

    // Build date range for the day
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');

    const classes = await Class.findAll({
      where: {
        tutorId: tutorId,
        scheduleType: 'one-time',
        classDate: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });

    const formatted = (classes || []).map(c => {
      const plain = c.toJSON ? c.toJSON() : c;
      return {
        id: plain.id || plain._id,
        startTime: plain.startTime || plain.start_time || plain.time || plain.start,
        duration: plain.duration || plain.customDuration || 60,
        classDate: plain.classDate ? (new Date(plain.classDate)).toISOString().slice(0,10) : date,
        scheduleType: plain.scheduleType || 'one-time',
        tutor: { _id: tutorId }
      };
    });

    return res.json({ success: true, data: { classes: formatted } });
  } catch (error) {
    console.error('Error fetching tutor classes (public):', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch tutor classes' });
  }
});

// Registration endpoint for parent with student and class scheduling
router.post('/register', async (req, res) => {
  const transaction = await User.sequelize.transaction();
  
  try {
  console.log('🔍 Registration attempt received:', req.body);
  // Allow caller to pass center id as a query parameter on the registration POST
  // e.g. POST /api/auth/register?center=68fb0e937d4b7bf52fe5ddcd
  const centerId = req.query && req.query.center ? String(req.query.center) : null;
    const { 
      firstName, lastName, email, password, phoneNumber, role,
      // legacy single-item fields
      student: singleStudent, classScheduling: singleClassScheduling,
      // new multi-item fields from frontend
      students: studentsArray, classSchedules: classSchedulesArray
    } = req.body;

    // Normalize incoming payloads: frontend sends `students` (array) and `classSchedules` (array).
    // Map them to the existing single-item variables expected by the code below so the
    // parent-registration flow continues to work with both shapes.
    const student = singleStudent || (Array.isArray(studentsArray) && studentsArray.length > 0 ? studentsArray[0] : undefined);
    const classScheduling = singleClassScheduling || (Array.isArray(classSchedulesArray) && classSchedulesArray.length > 0 ? classSchedulesArray[0] : undefined);

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ 
        error: 'First name, last name, email, password, and role are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 12);

    let parentUser, studentUser;

    if (role === 'parent' && student) {
      // Step 1: Create parent record
      console.log('📝 Creating parent record...');
      // Generate username from email (before @ symbol) + random suffix if needed
      const baseUsername = email.split('@')[0].toLowerCase();
      const parentUsername = `parent_${baseUsername}`;
      
      parentUser = await User.create({
        id: generateObjectId(),
  
        firstName: firstName,
        lastName: lastName,
        email: email.toLowerCase(),
        username: parentUsername,
        password: hashedPassword,
        phone_number: phoneNumber,
        role: 'parent',
        center_id: centerId,
        assignments: { center: centerId, classes: [], children: [] },
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });

      console.log('✅ Parent created with ID:', parentUser.id);

      // Step 2: Create student records with parent reference (handle multiple students)
      console.log('📝 Creating student record(s)...');
      const now = new Date().toISOString();

      // Determine students to create: prefer explicit students array from frontend, else single `student` object
      const studentsToCreate = Array.isArray(studentsArray) && studentsArray.length > 0 ? studentsArray : (student ? [student] : []);
      const createdStudents = []; // will hold created student user records

      // Helper to build student profile (use the student object passed in)
      const makeStudentProfile = (s) => ({
        goals: '',
        grade: s.grade,
        notes: '',
        school: s.school,
        parentContact: {
          name: `${firstName} ${lastName}`,
          email: email,
          phone: phoneNumber || ''
        },
        status: 'inactive',
        address: {
          city: '',
          state: '',
          street: '',
          country: '',
          zipCode: ''
        },
        currency: 'USD',
        subjects: s.subjects || [],
        documents: [],
        education: [],
        hourlyRate: 85,
        availability: {
          friday: { available: false, timeSlots: [], timeSlotsZones: [] },
          monday: { available: false, timeSlots: [], timeSlotsZones: [] },
          sunday: { available: false, timeSlots: [], timeSlotsZones: [] },
          tuesday: { available: false, timeSlots: [], timeSlotsZones: [] },
          saturday: { available: false, timeSlots: [], timeSlotsZones: [] },
          thursday: { available: false, timeSlots: [], timeSlotsZones: [] },
          wednesday: { available: false, timeSlots: [], timeSlotsZones: [] }
        },
        learningStyle: s.learningStyle || '',
        enrollmentDate: now,
        preferredSubjects: s.subjects || [],
        strugglingSubjects: [],
        verificationStatus: '',
        dateOfBirth: s.dateOfBirth,
        medicalInfo: {
          allergies: '',
          conditions: '',
          medications: '',
          doctorContact: '',
          emergencyInfo: ''
        },
        parent_id: parentUser.id // Store parent ID in student profile
      });

      // Helper to generate a unique placeholder email for students who don't provide one
      const genPlaceholderEmail = (s) => {
        const namePart = ((s && ((s.firstName || '') + (s.lastName || ''))) || 'student').toLowerCase().replace(/[^a-z0-9]/g, '');
        const rand = Math.random().toString(36).slice(2, 8);
        return `${namePart || 'student'}_${Date.now().toString(36)}_${rand}@no-email.local`;
      };

      // eslint-disable-next-line no-await-in-loop
      for (const s of studentsToCreate) {
        const studentProfileObj = makeStudentProfile(s);

        // Ensure student has a username (generate if missing)
        const sanitize = (ss) => String(ss || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/^_+|_+$/g, '');
        let studentBaseLocal = '';
        if (s.email && s.email.includes('@')) studentBaseLocal = sanitize(s.email.split('@')[0]);
        if (!studentBaseLocal) studentBaseLocal = sanitize(`${s.firstName || 'student'}${s.firstName && s.lastName ? '_' : ''}${s.lastName || ''}`) || `student${Date.now().toString().slice(-6)}`;
        let studentUsernameLocal = s.username ? sanitize(s.username) : studentBaseLocal;
        let sfxLocal = 0;
        // eslint-disable-next-line no-await-in-loop
        while (!studentUsernameLocal || await User.findOne({ where: { username: studentUsernameLocal } })) {
          sfxLocal += 1;
          studentUsernameLocal = `${studentBaseLocal}_${sfxLocal}`;
        }

        const created = await User.create({
          id: generateObjectId(),
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email ? String(s.email).toLowerCase() : genPlaceholderEmail(s),
          username: studentUsernameLocal,
          phoneNumber: s.phoneNumber || null,
          password: hashedPassword,
          role: 'student',
          center_id: centerId,
          assignments: { center: centerId, classes: [], children: [] },
          student_profile: studentProfileObj,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }, { transaction });

        console.log('✅ Student created with ID:', created.id);
        createdStudents.push(created);
      }

      // Step 3: Update parent record with student references in assignments
      console.log('📝 Updating parent with student references...');
      const currentAssignments = parentUser.assignments || {};
      const childIds = createdStudents.map(su => su.id);
      const updatedAssignments = {
        ...currentAssignments,
        children: currentAssignments.children ? [...currentAssignments.children, ...childIds] : [...childIds]
      };

      await parentUser.update({
        assignments: updatedAssignments,
        updated_at: new Date()
      }, { transaction });

      console.log('✅ Parent updated with student IDs in assignments:', childIds);

      // Step 4: Create classes if scheduling info provided (support multiple classSchedules)
      const scheduledClasses = [];
      const Class = require('../models/sequelize/Class');
      if (Array.isArray(classSchedulesArray) && classSchedulesArray.length > 0) {
        for (const cs of classSchedulesArray) {
          try {
            console.log('📝 Creating scheduled class for payload:', cs);
            const studentIdx = typeof cs.studentIndex === 'number' ? cs.studentIndex : 0;
            const targetStudent = createdStudents[studentIdx] || createdStudents[0];
            const classDateTime = new Date(`${cs.date}T${cs.time}:00`);
            const title = `${cs.subject} - ${cs.studentName || ''}`.trim();
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substr(2, 6);
            const meetingId = `class-${timestamp}-${random}`;
            
            // Get tutor's timezone for proper class scheduling context
            let scheduledTimeZone = 'UTC';
            if (cs.tutorId) {
              const tutor = await User.findByPk(cs.tutorId);
              if (tutor && tutor.tutor_profile && tutor.tutor_profile.timeZone) {
                scheduledTimeZone = tutor.tutor_profile.timeZone;
              }
            }

            const classData = {
              title,
              description: `Private ${cs.subject} session for ${cs.studentName}`,
              subject: cs.subject,
              tutorId: cs.tutorId,
              students: [targetStudent.id],
              maxCapacity: 1,
              startTime: cs.time,
              scheduledTimeZone: scheduledTimeZone,
              duration: parseInt(cs.duration) || 60,
              scheduleType: 'one-time',
              classDate: classDateTime,
              status: 'scheduled',
              paymentStatus: 'democlass',
              amount: 0,
              currency: 'USD',
              meetingId,
              meetingLink: `/meeting/${meetingId}`,
              meetingPlatform: 'agora',
              joinWindowMinutes: 15,
              createdBy: parentUser.id,
              centerId: centerId
            };
            console.log('📅 Creating class with data:', classData);
            const createdClass = await Class.create(classData, { transaction });
            console.log('✅ Class scheduled successfully:', createdClass.id);
            scheduledClasses.push(createdClass);
          } catch (err) {
            console.error('❌ Failed to schedule class for payload', cs, err);
            // Continue with other schedules; collect skipped schedules if desired
          }
        }
      } else if (classScheduling) {
        // Backwards compatibility: single classScheduling
        try {
          console.log('📝 Creating scheduled class...');
          const classDateTime = new Date(`${classScheduling.date}T${classScheduling.time}:00`);
          const title = `${classScheduling.subject} - ${classScheduling.studentName}`;
          const timestamp = Date.now().toString(36);
          const random = Math.random().toString(36).substr(2, 6);
          const meetingId = `class-${timestamp}-${random}`;
          
          // Get tutor's timezone for proper class scheduling context
          let scheduledTimeZone = 'UTC';
          if (classScheduling.tutorId) {
            const tutor = await User.findByPk(classScheduling.tutorId);
            if (tutor && tutor.tutor_profile && tutor.tutor_profile.timeZone) {
              scheduledTimeZone = tutor.tutor_profile.timeZone;
            }
          }
          
          const classData = {
            title,
            description: `Private ${classScheduling.subject} session for ${classScheduling.studentName}`,
            subject: classScheduling.subject,
            tutorId: classScheduling.tutorId,
            students: [createdStudents[0].id],
            maxCapacity: 1,
            startTime: classScheduling.time,
            scheduledTimeZone: scheduledTimeZone,
            duration: parseInt(classScheduling.duration) || 60,
            scheduleType: 'one-time',
            classDate: classDateTime,
            status: 'scheduled',
            paymentStatus: 'unpaid',
            amount: 0,
            currency: 'USD',
            meetingId,
            meetingLink: `/meeting/${meetingId}`,
            meetingPlatform: 'agora',
            joinWindowMinutes: 15,
              createdBy: parentUser.id,
              centerId: centerId
          };
          console.log('📅 Creating class with data:', classData);
          const createdClass = await Class.create(classData, { transaction });
          console.log('✅ Class scheduled successfully:', createdClass.id);
          scheduledClasses.push(createdClass);
        } catch (err) {
          console.error('❌ Failed to schedule class (single):', err);
        }
      }

      await transaction.commit();

      console.log('🎉 Parent registration completed successfully');

      // Prepare safe response payloads from createdStudents / scheduledClasses
      const respStudent = (typeof createdStudents !== 'undefined' && createdStudents.length > 0) ? createdStudents[0] : null;
      const respClass = (typeof scheduledClasses !== 'undefined' && scheduledClasses.length > 0) ? scheduledClasses[0] : null;

      return res.status(201).json({
        success: true,
        message: 'Registration successful! Parent and student accounts created.',
        parent: {
          id: parentUser.id,
          email: parentUser.email,
          role: parentUser.role
        },
        student: respStudent ? {
          id: respStudent.id,
          name: `${respStudent.first_name} ${respStudent.last_name}`,
          role: respStudent.role
        } : null,
        class: respClass ? {
          id: respClass.id,
          title: respClass.title,
          subject: respClass.subject,
          date: respClass.classDate,
          time: respClass.startTime,
          duration: respClass.duration,
          meetingId: respClass.meetingId,
          meetingLink: respClass.meetingLink,
          status: respClass.status
        } : null
      });

    } else {
      // Handle non-parent registration (student, tutor)
      console.log('📝 Creating single user record...');

      // Ensure we generate a username (DB requires non-null username)
      const sanitize = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/^_+|_+$/g, '');
      let baseUsername = '';
      if (email && email.includes('@')) baseUsername = sanitize(email.split('@')[0]);
      if (!baseUsername) baseUsername = sanitize(`${firstName || 'user'}${firstName && lastName ? '_' : ''}${lastName || ''}`) || `user${Date.now().toString().slice(-6)}`;

      let usernameCandidate = baseUsername;
      let suffix = 0;
      // Ensure uniqueness
      // eslint-disable-next-line no-await-in-loop
      while (await User.findOne({ where: { username: usernameCandidate } })) {
        suffix += 1;
        usernameCandidate = `${baseUsername}_${suffix}`;
      }

      const newUser = await User.create({
        id: generateObjectId(),
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        username: usernameCandidate,
        password: hashedPassword,
        phone_number: phoneNumber,
        role: role,
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });

      await transaction.commit();

      console.log('✅ User registration completed:', newUser.role);

      return res.status(201).json({
        success: true,
        message: 'Registration successful!',
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role
        }
      });
    }

  } catch (error) {
    // Safe rollback: only attempt rollback if transaction not already finished.
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      } else {
        console.warn('Transaction already finished with state:', transaction && transaction.finished);
      }
    } catch (rbErr) {
      console.error('Rollback failed or transaction already finished:', rbErr);
    }

    console.error('❌ Registration error:', error);

    return res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
});

module.exports = router;
