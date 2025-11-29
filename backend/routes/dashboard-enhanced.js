const User = require('../models/User.postgres'); // Use Sequelize User model for Postgres
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pgClient } = require('../db');

// Enhanced Tutor Dashboard with Session Management
router.get('/tutor', auth(['tutor']), async (req, res) => {
  try {
    console.log('🔧 [ENHANCED-DASHBOARD] Starting dashboard data fetch');
    
    // Extract tutor info from request
    const tutorId = req.user.id;
    console.log('🔧 [ENHANCED-DASHBOARD] Auth user:', {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    });

    // 1. Verify tutor exists and get basic info
    const tutorQuery = 'SELECT id, email, first_name, last_name, role FROM "users" WHERE id = $1';
    const tutorResult = await pgClient.query(tutorQuery, [tutorId]);
    
    if (!tutorResult.rows[0]) {
      console.log('🔧 [ENHANCED-DASHBOARD] Tutor not found:', tutorId);
      return res.status(404).json({
        error: 'Tutor not found',
        message: 'Could not find tutor information'
      });
    }

    const tutor = tutorResult.rows[0];
    console.log('🔧 [ENHANCED-DASHBOARD] Found tutor:', tutor);

    // 2. Get tutor's classes with student information
    const classesQuery = `
      SELECT c.id, c.title, c.description, c."meetingLink", c."startTime", c."scheduleType", c."recurringDays",
             c.duration, c."customDuration", c.amount, c.currency, c."classDate", c.students, c."paymentStatus",
             c.status, c."endDate", c."meetingId",
             json_agg(json_build_object(
               'id', s.id,
               'name', concat(s.first_name, ' ', s.last_name),
               'email', s.email
             )) as student_list
      FROM "Classes" c
      LEFT JOIN "users" s ON s.id = ANY(c.students)
      WHERE c."tutorId" = $1
      GROUP BY c.id, c.title, c.description, c."meetingLink", c."startTime", c."scheduleType", c."recurringDays",
               c.duration, c."customDuration", c.amount, c.currency, c."classDate", c.students, c."paymentStatus",
               c.status, c."endDate", c."meetingId"
      LIMIT 10`;

    console.log('🔧 [ENHANCED-DASHBOARD] Executing classes query for tutor:', tutorId);
    const classesResult = await pgClient.query(classesQuery, [tutorId]);
    console.log('🔧 [ENHANCED-DASHBOARD] Classes found:', classesResult.rows.length);

    // 2.5. Calculate teaching hours from session participants this month
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    const teachingHoursQuery = `
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN sp.ended_at IS NOT NULL AND sp.joined_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (sp.ended_at - sp.joined_at)) / 3600
            ELSE 0
          END
        ), 0) as total_hours
      FROM sessionparticipants sp
      WHERE sp.participant_id = $1 
        AND sp.participant_type = 'tutor'
        AND sp.joined_at >= $2 
        AND sp.joined_at <= $3`;

    console.log('🔧 [ENHANCED-DASHBOARD] Calculating teaching hours for period:', { startOfMonth, endOfMonth });
    console.log('🔧 [ENHANCED-DASHBOARD] Teaching hours query params:', { tutorId, startOfMonth, endOfMonth });
    
    // Debug: First check if any session participants exist for this tutor
    const debugQuery = `SELECT COUNT(*) as total, 
                               COUNT(CASE WHEN ended_at IS NOT NULL THEN 1 END) as with_end_time,
                               COUNT(CASE WHEN participant_type = 'tutor' THEN 1 END) as tutor_sessions
                        FROM sessionparticipants 
                        WHERE participant_id = $1`;
    const debugResult = await pgClient.query(debugQuery, [tutorId]);
    console.log('🔧 [ENHANCED-DASHBOARD] Debug session data:', debugResult.rows[0]);
    
    const teachingHoursResult = await pgClient.query(teachingHoursQuery, [tutorId, startOfMonth, endOfMonth]);
    const totalTeachingHours = parseFloat(teachingHoursResult.rows[0]?.total_hours || 0);
    
    console.log('🔧 [ENHANCED-DASHBOARD] Teaching hours query result:', teachingHoursResult.rows[0]);
    console.log('🔧 [ENHANCED-DASHBOARD] Teaching hours calculated (raw):', totalTeachingHours);

    // 3. Prepare response data
    const dashboardData = {
      tutor: {
        id: tutor.id,
        name: `${tutor.first_name} ${tutor.last_name}`,
        email: tutor.email,
        role: tutor.role
      },
      classes: classesResult.rows.map(c => ({
        id: c.id,
        title: c.title || '',
        description: c.description || '',
        students: c.student_list.filter(s => s && s.id) || [],
        studentCount: c.student_list ? c.student_list.length : 0,
        startTime: c.startTime || '10:15',
        duration: c.duration || 30,
        customDuration: c.customDuration || null,
        scheduleType: c.scheduleType || 'one-time',
        meetingLink: c.meetingLink || '',
        meetingId: c.meetingId || null,
        amount: c.amount || 0,
        currency: c.currency || 'USD',
        classDate: c.classDate || null,
        endDate: c.endDate || null,
        paymentStatus: c.paymentStatus || 'unpaid',
        status: c.status || 'scheduled',
        recurringDays: Array.isArray(c.recurringDays) ? c.recurringDays : (typeof c.recurringDays === 'string' ? JSON.parse(c.recurringDays || '[]') : []),
      })),
      stats: {
        totalClasses: classesResult.rows.length,
        totalStudents: classesResult.rows.reduce((sum, c) => 
          sum + (c.student_list ? c.student_list.length : 0), 0),
        totalTeachingHours: totalTeachingHours
      }
    };

    // 4. Send response
    console.log('🔧 [ENHANCED-DASHBOARD] Sending dashboard data:', dashboardData);
    return res.json({
      success: true,
      message: 'Dashboard data loaded successfully',
      data: dashboardData
    });

    console.log('🔧 [ENHANCED-DASHBOARD] Found classes:', classes.length);
    
    const formattedClasses = classes.map(c => ({
      id: c.id,
      title: c.title || '',
      name: c.name || '',
      subject: c.subject || '',
      description: c.description || '',
      students: Array.isArray(c.students) ? c.students.filter(s => s && s.id) : [],
      studentCount: parseInt(c.student_count) || 0,
      startTime: c.starttime || null,
      endTime: c.endtime || null,
      status: c.status || 'active'
    }));

    console.log('🔧 [ENHANCED-DASHBOARD] Classes detailed data:', formattedClasses);

    if (!classes.length) {
      console.log('🔧 [ENHANCED-DASHBOARD] No classes found for tutor, returning empty data');
      return res.json({
        message: 'Tutor Dashboard',
        user: req.user,
        data: {
          classes: [],
          students: [],
          totalStudents: 0,
          classCount: 0,
          upcomingSessions: [],
          recentSessions: [],
          schedule: [],
          sessionStats: {
            totalSessions: 0,
            completedSessions: 0,
            upcomingSessions: 0,
            totalTeachingHours: 0
          },
          notifications: [],
          quickActions: [
            { id: 'create-session', title: 'Schedule New Session', icon: 'calendar-plus' },
            { id: 'view-materials', title: 'Upload Materials', icon: 'upload' },
            { id: 'student-progress', title: 'Track Progress', icon: 'chart-line' }
          ]
        },
        permissions: ['view_assigned_classes', 'manage_class_content', 'view_students', 'create_sessions']
      });
    }

    // Get students in tutor's classes
    const classIds = classes.map(cls => cls._id);
    console.log('🔧 [ENHANCED-DASHBOARD] Tutor class IDs:', classIds);
    
    // Get all students from the classes (they're already populated in the classes)
    const allStudents = classes.reduce((students, cls) => {
      if (cls.students) {
        cls.students.forEach(student => {
          if (!students.find(s => s._id.toString() === student._id.toString())) {
            students.push(student);
          }
        });
      }
      return students;
    }, []);
    
    console.log('🔧 [ENHANCED-DASHBOARD] Found students:', allStudents.length);
    console.log('🔧 [ENHANCED-DASHBOARD] Students data:', allStudents.map(s => ({
      name: s.fullName || `${s.firstName} ${s.lastName}`,
      email: s.email,
      grade: s.studentProfile?.grade
    })));

    // Get recent and upcoming sessions
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingSessions = await MeetingSession.find({
      classId: { $in: classIds },
      scheduledStartTime: { $gte: now, $lte: oneWeekFromNow },
      status: { $in: ['scheduled', 'waiting'] }
    })
    .populate('classId', 'name subject')
    .sort({ scheduledStartTime: 1 })
    .limit(10);

    const recentSessions = await MeetingSession.find({
      classId: { $in: classIds },
      scheduledStartTime: { $gte: oneWeekAgo, $lt: now }
    })
    .populate('classId', 'name subject')
    .sort({ scheduledStartTime: -1 })
    .limit(10);

    // Calculate session statistics
    const allSessions = await MeetingSession.find({
      classId: { $in: classIds }
    });

    const sessionStats = {
      totalSessions: allSessions.length,
      completedSessions: allSessions.filter(s => s.status === 'completed').length,
      upcomingSessions: upcomingSessions.length,
      totalTeachingHours: allSessions
        .filter(s => s.status === 'completed')
        .reduce((total, session) => total + (session.totalActualDuration || 0), 0) / 60
    };

    // Generate notifications for tutor
    const notifications = [];
    
    // Upcoming sessions within next 2 hours
    const soonSessions = upcomingSessions.filter(session => {
      const timeDiff = session.scheduledStartTime.getTime() - now.getTime();
      return timeDiff <= 2 * 60 * 60 * 1000; // 2 hours
    });

    soonSessions.forEach(session => {
      const minutesUntil = Math.ceil((session.scheduledStartTime.getTime() - now.getTime()) / (1000 * 60));
      notifications.push({
        id: `session-${session._id}`,
        type: 'session-reminder',
        title: 'Upcoming Session',
        message: `${session.classId.name} starts in ${minutesUntil} minutes`,
        priority: minutesUntil <= 30 ? 'high' : 'medium',
        timestamp: now,
        action: {
          label: 'Join Session',
          url: `/sessions/${session._id}/join`
        }
      });
    });

    // Pending session reviews
    const pendingReviews = await MeetingSession.find({
      classId: { $in: classIds },
      status: 'completed',
      'sessionRating.tutorRating': { $exists: false }
    }).limit(5);

    if (pendingReviews.length > 0) {
      notifications.push({
        id: 'pending-reviews',
        type: 'action-required',
        title: 'Session Reviews Pending',
        message: `${pendingReviews.length} completed sessions need your review`,
        priority: 'medium',
        timestamp: now,
        action: {
          label: 'Review Sessions',
          url: '/tutor/sessions/reviews'
        }
      });
    }

    // Enhanced tutor data
    const tutorData = {
      classes: classes.map(cls => ({
        ...cls.toObject(),
        studentCount: cls.students?.length || 0,
        nextSession: upcomingSessions.find(s => s.classId._id.toString() === cls._id.toString()),
        lastSession: recentSessions.find(s => s.classId._id.toString() === cls._id.toString())
      })),
      students: allStudents.map(student => {
        // Find which classes this student belongs to
        const studentClasses = classes.filter(cls => 
          cls.students.some(s => s._id.toString() === student._id.toString())
        );
        
        return {
          ...student.toObject(),
          grade: student.studentProfile?.grade || 'N/A',
          commonClasses: studentClasses,
          classDetails: studentClasses.map(cls => {
            const nextSession = upcomingSessions.find(s => s.classId._id.toString() === cls._id.toString());
            
            // Format recurring schedule
            let recurringSchedule = 'Not scheduled';
            if (cls.scheduleType === 'weekly-recurring' && cls.recurringDays && cls.recurringDays.length > 0) {
              const dayNames = {
                'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed', 
                'thursday': 'Thu', 'friday': 'Fri', 'saturday': 'Sat', 'sunday': 'Sun'
              };
              const days = cls.recurringDays.map(day => dayNames[day] || day).join(', ');
              const startTime = cls.startTime || 'TBD';
              const duration = cls.duration || cls.customDuration || 60;
              
              // Calculate end time
              let endTime = 'TBD';
              if (cls.startTime) {
                const [hours, minutes] = cls.startTime.split(':').map(Number);
                const startMinutes = hours * 60 + minutes;
                const endMinutes = startMinutes + duration;
                const endHours = Math.floor(endMinutes / 60);
                const endMins = endMinutes % 60;
                endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
              }
              
              recurringSchedule = `${days} ${startTime}-${endTime}`;
            } else if (cls.startTime) {
              const duration = cls.duration || cls.customDuration || 60;
              const [hours, minutes] = cls.startTime.split(':').map(Number);
              const startMinutes = hours * 60 + minutes;
              const endMinutes = startMinutes + duration;
              const endHours = Math.floor(endMinutes / 60);
              const endMins = endMinutes % 60;
              const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
              recurringSchedule = `${cls.startTime}-${endTime}`;
            }
            
            console.log('🔧 [ENHANCED-DASHBOARD] Processing class:', {
              className: cls.title || cls.name,
              subject: cls.subject,
              scheduleType: cls.scheduleType,
              recurringDays: cls.recurringDays,
              startTime: cls.startTime,
              recurringSchedule
            });
            
            return {
              classId: cls._id,
              className: cls.title || cls.name || 'Unnamed Class', // Use title field
              subject: cls.subject,
              recurringSchedule,
              nextSession: nextSession ? {
                date: nextSession.scheduledStartTime,
                formattedDate: nextSession.scheduledStartTime.toLocaleDateString(),
                formattedTime: nextSession.scheduledStartTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              } : null
            };
          })
        };
      }),
      totalStudents: allStudents.length,
      classCount: classes.length,
      upcomingSessions: upcomingSessions.map(session => ({
        ...session.toObject(),
        timeUntilStart: session.scheduledStartTime.getTime() - now.getTime(),
        canJoin: session.scheduledStartTime.getTime() - now.getTime() <= 15 * 60 * 1000, // Can join 15 min before
        className: session.classId.name,
        subject: session.classId.subject
      })),
      recentSessions: recentSessions.map(session => ({
        ...session.toObject(),
        className: session.classId.name,
        subject: session.classId.subject,
        wasSuccessful: session.status === 'completed'
      })),
      sessionStats,
      schedule: user.assignments.classes.map(cls => ({
        classId: cls._id,
        className: cls.name,
        subject: cls.subject,
        schedule: cls.schedule,
        description: cls.description,
        nextSession: upcomingSessions.find(s => s.classId._id.toString() === cls._id.toString()),
        studentCount: cls.students?.length || 0
      })),
      notifications,
      quickActions: [
        {
          id: 'create-session',
          title: 'Schedule New Session',
          icon: 'calendar-plus',
          description: 'Create a new meeting session for your classes',
          url: '/tutor/sessions/create'
        },
        {
          id: 'view-materials',
          title: 'Manage Materials',
          icon: 'upload',
          description: 'Upload and organize teaching materials',
          url: '/tutor/materials'
        },
        {
          id: 'student-progress',
          title: 'Student Progress',
          icon: 'chart-line',
          description: 'Track and analyze student performance',
          url: '/tutor/progress'
        },
        {
          id: 'communication',
          title: 'Messages',
          icon: 'comments',
          description: 'Communicate with students and parents',
          url: '/tutor/messages'
        }
      ],
      // Tutor profile information
      profile: {
        subjects: user.tutorProfile?.subjects || [],
        specializations: user.tutorProfile?.specializations || [],
        experience: user.tutorProfile?.experience || 0,
        hourlyRate: user.tutorProfile?.hourlyRate || 0,
        bio: user.tutorProfile?.bio || '',
        rating: user.tutorProfile?.rating || 0,
        totalSessionsCompleted: sessionStats.completedSessions,
        totalHoursTaught: sessionStats.totalTeachingHours
      }
    };

    console.log('🔧 [ENHANCED-DASHBOARD] Final student data being sent:', tutorData.students.map(s => ({
      name: s.fullName || `${s.firstName} ${s.lastName}`,
      grade: s.grade,
      classDetailsCount: s.classDetails?.length || 0,
      classDetails: s.classDetails
    })));

    res.json({
      message: 'Tutor Dashboard',
      user: req.user,
      data: tutorData,
      permissions: ['view_assigned_classes', 'manage_class_content', 'view_students', 'create_sessions', 'manage_sessions'],
      meta: {
        lastUpdated: now,
        dashboardVersion: '2.0',
        features: ['session_management', 'real_time_notifications', 'student_progress_tracking']
      }
    });

  } catch (error) {
    console.error('Enhanced tutor dashboard error:', error);
    res.status(500).json({ 
      error: 'Failed to load dashboard data',
      message: error.message,
      code: 'DASHBOARD_LOAD_ERROR'
    });
  }
});

// Get tutor's upcoming sessions
router.get('/tutor/sessions/upcoming', auth(['tutor']), async (req, res) => {
  try {
  const user = await User.findOne({ where: { id: req.user.id } });
  const classIds = user && user.assignments && Array.isArray(user.assignments.classes) ? user.assignments.classes : [];
    
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const sessions = await MeetingSession.find({
      classId: { $in: classIds },
      scheduledStartTime: { $gte: new Date() },
      status: { $in: ['scheduled', 'waiting'] }
    })
    .populate('classId', 'name subject description')
    .sort({ scheduledStartTime: 1 })
    .limit(limit)
    .skip(offset);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        limit,
        offset,
        total: sessions.length
      }
    });

  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch upcoming sessions' 
    });
  }
});

// Get tutor's session history
router.get('/tutor/sessions/history', auth(['tutor']), async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const classIds = user.assignments.classes;
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    
    const filter = {
      classId: { $in: classIds },
      scheduledStartTime: { $lt: new Date() }
    };
    
    if (status && status !== 'all') {
      filter.status = status;
    }

    const sessions = await MeetingSession.find(filter)
      .populate('classId', 'name subject description')
      .sort({ scheduledStartTime: -1 })
      .limit(limit)
      .skip(offset);

    const total = await MeetingSession.countDocuments(filter);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + sessions.length < total
      }
    });

  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch session history' 
    });
  }
});

// Create a new session
router.post('/tutor/sessions', auth(['tutor']), async (req, res) => {
  try {
    const {
      classId,
      sessionDate,
      startTime,
      duration,
      notes,
      meetingPlatform
    } = req.body;

    // Validate that the tutor owns this class
    const user = await User.findByPk(req.user.id);
    if (!user.assignments.classes.includes(classId)) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to create sessions for this class'
      });
    }

    // Get class details
    const classInfo = await Class.findById(classId);
    if (!classInfo) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Create session
    const scheduledStartTime = new Date(`${sessionDate}T${startTime}`);
    const scheduledEndTime = new Date(scheduledStartTime.getTime() + duration * 60000);

    const session = new MeetingSession({
      classId,
      sessionDate: scheduledStartTime,
      scheduledStartTime,
      scheduledEndTime,
      totalScheduledDuration: duration,
      meetingLink: `https://meet.example.com/${Date.now()}`, // Generate actual meeting link
      meetingId: `session_${Date.now()}`,
      tutorRate: user.tutorProfile?.hourlyRate || 50,
      studentRate: 25, // Could be configured per class
      notes: notes || '',
      platformType: meetingPlatform || 'zoom'
    });

    await session.save();

    // Create participant records
    const students = await User.find({
      role: 'student',
      'assignments.classes': classId
    });

    const participantPromises = students.map(student => {
      return new SessionParticipant({
        sessionId: session._id,
        userId: student._id,
        userRole: 'student',
        joinedAt: null,
        leftAt: null,
        status: 'invited'
      }).save();
    });

    // Add tutor as participant
    participantPromises.push(
      new SessionParticipant({
        sessionId: session._id,
        userId: req.user.id,
        userRole: 'tutor',
        joinedAt: null,
        leftAt: null,
        status: 'scheduled'
      }).save()
    );

    await Promise.all(participantPromises);

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      message: error.message
    });
  }
});

// Update session (for rescheduling, adding notes, etc.)
router.patch('/tutor/sessions/:sessionId', auth(['tutor']), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    // Verify session belongs to this tutor
    const session = await MeetingSession.findById(sessionId)
      .populate('classId', 'tutor');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.classId.tutor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this session'
      });
    }

    // Prevent updates to completed sessions
    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify completed sessions'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['notes', 'homework', 'scheduledStartTime', 'scheduledEndTime', 'totalScheduledDuration'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    const updatedSession = await MeetingSession.findByIdAndUpdate(
      sessionId,
      updateData,
      { new: true, runValidators: true }
    ).populate('classId', 'name subject');

    res.json({
      success: true,
      message: 'Session updated successfully',
      data: updatedSession
    });

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
      message: error.message
    });
  }
});

// Add session rating/review
router.post('/tutor/sessions/:sessionId/review', auth(['tutor']), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, notes, studentProgress, homework } = req.body;

    const session = await MeetingSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Can only review completed sessions'
      });
    }

    // Update session with tutor review
    session.sessionRating.tutorRating = rating;
    session.notes = notes || session.notes;
    session.homework = homework || session.homework;
    
    await session.save();

    res.json({
      success: true,
      message: 'Session review added successfully',
      data: session
    });

  } catch (error) {
    console.error('Add session review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add session review'
    });
  }
});

// Enhanced Parent Dashboard
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    const parentId = req.user.id;
    const parent = await User.findByPk(parentId, {
      attributes: ['id', 'first_name', 'last_name', 'email', 'student_profile'],
      raw: true
    });

    console.log('🔧 [PARENT-DASHBOARD] Parent found:', !!parent);
    console.log('🔧 [PARENT-DASHBOARD] Parent ID:', parentId);
    console.log('🔧 [PARENT-DASHBOARD] Parent email:', parent?.email);
    console.log('🔧 [PARENT-DASHBOARD] Parent assignments:', parent?.assignments);

    // Find children from student_profile.parent_id
    const students = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'first_name', 'last_name', 'email', 'student_profile'],
      raw: true
    });

    const childrenIds = [];
    for (const student of students) {
      let studentProfile = student.student_profile;
      let parentIdInProfile = null;
      
      // Handle both JSON string and object formats
      if (typeof studentProfile === 'string') {
        try {
          const parsed = JSON.parse(studentProfile);
          parentIdInProfile = parsed.parent_id || parsed.parentId;
        } catch (e) {
          parentIdInProfile = null;
        }
      } else if (typeof studentProfile === 'object' && studentProfile) {
        parentIdInProfile = studentProfile.parent_id || studentProfile.parentId;
      }
      
      if (parentIdInProfile && parentIdInProfile.toString() === parentId.toString()) {
        childrenIds.push(student.id);
      }
    }

    console.log('🔧 [PARENT-DASHBOARD] Children IDs found:', childrenIds);

    let children = [];
    if (childrenIds.length > 0) {
      children = await User.findAll({
        where: { 
          id: childrenIds,
          role: 'student'
        },
        attributes: ['id', 'first_name', 'last_name', 'email', 'student_profile'],
        raw: true
      });
    }

    console.log('🔧 [PARENT-DASHBOARD] Found children:', children.length);
    console.log('🔧 [PARENT-DASHBOARD] Children details:', children.map(c => ({
      name: `${c.first_name} ${c.last_name}`,
      email: c.email,
      id: c.id
    })));

    if (!children.length) {
      return res.json({
        message: 'Parent Dashboard',
        user: req.user,
        data: {
          children: [],
          totalChildren: 0,
          activeSessions: 0,
          averageProgress: 0,
          achievements: 0,
          recentActivities: [],
          notifications: [],
          upcomingSessions: []
        }
      });
    }

    // Return dashboard data with expected structure
    res.json({
      message: 'Parent Dashboard',
      user: req.user,
      data: {
        children: children.map((c, index) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          firstName: c.first_name,
          lastName: c.last_name,
          email: c.email,
          avatar: (c.first_name?.[0] || '') + (c.last_name?.[0] || ''),
          grade: 'Grade ' + (index + 1),
          subjects: [],
          progress: {
            overall: 75
          },
          achievements: [],
          upcomingSession: null
        })),
        totalChildren: children.length,
        activeSessions: 0,
        averageProgress: 75,
        achievements: 0,
        recentActivities: [],
        notifications: [],
        upcomingSessions: []
      }
    });
  } catch (error) {
    console.error('Parent dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load parent dashboard data',
      message: error.message,
      code: 'PARENT_DASHBOARD_LOAD_ERROR'
    });
  }
});

module.exports = router;
