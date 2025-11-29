const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Class = require('../models/Class');
const Center = require('../models/Center');
const SessionHistory = require('../models/SessionHistory');
const SessionParticipant = require('../models/SessionParticipant');
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Subtopic = require('../models/Subtopic');

// Dashboard route for Admin
router.get('/admin', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    console.log('Admin dashboard accessed by user:', req.user.username);
    
    // Build user query with center filtering for admin users
    const userQuery = { isActive: true };
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter) {
        userQuery.center = adminCenter;
      } else {
        console.log('Admin has no center assigned, returning empty dashboard');
        return res.json({
          success: true,
          data: {
            totalTutors: 0,
            totalStudents: 0,
            totalParents: 0,
            totalClasses: 0,
            totalSessions: 0,
            activeTutors: 0,
            activeStudents: 0,
            activeClasses: 0,
            todaySessions: 0,
            tutors: [],
            students: [],
            parents: [],
            classes: []
          }
        });
      }
    }
    
    // Get all users by role with center filtering
    const allUsers = await User.find(userQuery);
    const tutors = allUsers.filter(u => u.role === 'tutor');
    const students = allUsers.filter(u => u.role === 'student');
    const parents = allUsers.filter(u => u.role === 'parent');
    const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin');
    
    console.log('Users found - Tutors:', tutors.length, 'Students:', students.length, 'Parents:', parents.length);
    
    // Build class query with center filtering for admin users
    const classQuery = {};
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      // Find tutors from this center to filter classes
      const centerTutorIds = tutors.map(t => t._id);
      if (centerTutorIds.length > 0) {
        classQuery.tutor = { $in: centerTutorIds };
      } else {
        // No tutors in center, no classes
        classQuery._id = null; // This will return no results
      }
    }
    
    // Get all classes with center filtering
    const allClasses = await Class.find(classQuery)
      .populate('tutor', 'username fullName')
      .populate('students', 'username fullName');
    
    console.log('Classes found:', allClasses.length);
    
    // Get active classes
    const activeClasses = allClasses.filter(c => c.status === 'active' || c.status === 'scheduled');
    
    // Build session query with center filtering for admin users
    const sessionQuery = {};
    if (req.user.role === 'admin') {
      const classIds = allClasses.map(c => c._id);
      if (classIds.length > 0) {
        sessionQuery.classId = { $in: classIds };
      } else {
        // No classes in center, no sessions
        sessionQuery._id = null; // This will return no results
      }
    }
    
    // Get all sessions from SessionHistory with center filtering
    const allSessions = await SessionHistory.find(sessionQuery)
      .populate('classId', 'title subject');
    
    // Calculate today's sessions
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todaySessions = allSessions.filter(s => {
      const sessionDate = new Date(s.sessionDate);
      return sessionDate >= startOfDay && sessionDate < endOfDay;
    });
    
    // Calculate statistics
    const totalTutorClasses = tutors.reduce((sum, tutor) => sum + (tutor.assignments?.classes?.length || 0), 0);
    const totalStudentEnrollments = students.reduce((sum, student) => sum + (student.assignments?.classes?.length || 0), 0);
    
    const centerStats = {
      tutors: tutors.map(t => ({
        id: t._id,
        username: t.username,
        fullName: t.fullName || `${t.firstName} ${t.lastName}`,
        email: t.email,
        classCount: t.assignments?.classes?.length || 0,
        isActive: t.isActive
      })),
      students: students.map(s => ({
        id: s._id,
        username: s.username,
        fullName: s.fullName || `${s.firstName} ${s.lastName}`,
        email: s.email,
        classCount: s.assignments?.classes?.length || 0,
        isActive: s.isActive
      })),
      parents: parents.map(p => ({
        id: p._id,
        username: p.username,
        fullName: p.fullName || `${p.firstName} ${p.lastName}`,
        email: p.email,
        isActive: p.isActive
      })),
      classes: allClasses.map(c => ({
        id: c._id,
        title: c.title,
        subject: c.subject,
        status: c.status,
        tutorName: c.tutor?.fullName || c.tutor?.username || 'Unassigned',
        studentCount: c.students?.length || 0,
        maxCapacity: c.maxCapacity,
        startTime: c.startTime,
        duration: c.duration
      }))
    };

    const dashboardData = {
      // Main statistics (what the frontend expects)
      totalTutors: tutors.length,
      totalStudents: students.length,
      totalParents: parents.length,
      totalClasses: allClasses.length,
      totalSessions: allSessions.length,
      
      // Active counts
      activeTutors: tutors.filter(t => (t.assignments?.classes?.length || 0) > 0).length,
      activeStudents: students.filter(s => (s.assignments?.classes?.length || 0) > 0).length,
      activeClasses: activeClasses.length,
      todaySessions: todaySessions.length,
      
      // Detailed stats
      ...centerStats
    };

    console.log('Admin dashboard data prepared successfully');
    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load admin dashboard',
      details: error.message
    });
  }
});

// Dashboard route for SuperAdmin (similar to admin but with global view)
router.get('/superadmin', auth(['superadmin']), async (req, res) => {
  try {
    console.log('SuperAdmin dashboard accessed by user:', req.user.username);
    // Find all subjects and filter out any with invalid gradeIds
    const subjectsRaw = await Subject.find({});
    const validSubjects = [];
    const invalidSubjects = [];
    subjectsRaw.forEach(subject => {
      if (!subject.gradeId) {
        invalidSubjects.push({ subjectId: subject._id, gradeId: 'null/undefined' });
      } else if (!mongoose.Types.ObjectId.isValid(subject.gradeId)) {
        invalidSubjects.push({ subjectId: subject._id, gradeId: subject.gradeId });
      } else {
        validSubjects.push(subject);
      }
    });
    if (invalidSubjects.length > 0) {
      console.log('SuperAdmin dashboard - Invalid gradeIds found:', invalidSubjects);
    }
    console.log('SuperAdmin dashboard - Valid subjects after filtering:', validSubjects.length);

    // Support returning all subjects for select lists
    if (req.query.all === 'true') {
      const subjectsAll = await Subject.find({ _id: { $in: validSubjects.map(s => s._id) } }).populate('gradeId');
      return res.json({ success: true, subjects: subjectsAll, total: subjectsAll.length });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortField = req.query.sortField || 'subjectName';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [subjects, total] = await Promise.all([
      Subject.find({ _id: { $in: validSubjects.map(s => s._id) } }).populate('gradeId').sort({ [sortField]: sortDirection }).skip(skip).limit(limit),
      Subject.countDocuments({ _id: { $in: validSubjects.map(s => s._id) } })
    ]);

    // Get all admins (role: admin or superadmin)
    const allAdmins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
    // Get all tutors
    const tutors = await User.find({ role: 'tutor' });
    // Get all students
    const students = await User.find({ role: 'student' });
    // Get all parents
    const parents = await User.find({ role: 'parent' });

    // Get all classes across all centers
    const allClasses = await Class.find({})
      .populate('tutor', 'username fullName')
      .populate('students', 'username fullName');

    // Get all centers with populated admin data
    const allCenters = await Center.find({}).populate({
      path: 'admin',
      select: '_id isActive role username'
    });

    // Debug center and admin information
    console.log('All centers with admin details:', allCenters.map(center => ({
      name: center.name,
      status: center.status,
      adminId: center.admin ? center.admin._id : null,
      adminIsActive: center.admin ? center.admin.isActive : false
    })));

    // A center is considered active only if:
    // 1. It has an assigned admin AND
    // 2. Its status is 'active'
    const activeCenters = allCenters.filter(center => 
      center.admin && // has assigned admin
      center.status === 'active' // is marked as active
    );

    // Get all sessions from SessionHistory
    const allSessions = await SessionHistory.find({})
      .populate('classId', 'title subject');

    // Calculate today's sessions
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todaySessions = allSessions.filter(s => {
      const sessionDate = new Date(s.sessionDate);
      return sessionDate >= startOfDay && sessionDate < endOfDay;
    });

    // Get all active admins who are assigned to centers
    const activeAssignedAdmins = allAdmins.filter(admin => {
      // Check if admin is assigned to any active center
      const isAssignedToActiveCenter = allCenters.some(center => 
        center.admin && 
        center.admin._id.toString() === admin._id.toString() &&
        center.status === 'active'
      );
      return admin.isActive && isAssignedToActiveCenter;
    });

    // Debug admin counts
    console.log('Admin counts:', {
      total: allAdmins.length,
      active: allAdmins.filter(a => a.isActive).length,
      assigned: allAdmins.filter(a => 
        allCenters.some(c => c.admin && c.admin._id.toString() === a._id.toString())
      ).length,
      activeAndAssigned: activeAssignedAdmins.length
    });

    const dashboardData = {
      totalTutors: tutors.length,
      totalStudents: students.length,
      totalParents: parents.length,
      totalAdmins: allAdmins.length,
      totalCenters: allCenters.length,
      activeCenters: activeCenters.length,
      totalClasses: allClasses.length,
      totalSessions: allSessions.length,
      todaySessions: todaySessions.length,

      // Additional super admin specific data
      activeTutors: tutors.filter(t => t.isActive).length,
      activeStudents: students.filter(s => s.isActive).length,
      activeParents: parents.filter(p => p.isActive).length,
      activeAdmins: activeAssignedAdmins.length, // Only admins that are both active AND assigned
      activeClasses: allClasses.filter(c => c.status === 'active').length
    };

    // Only send one response per request
    return res.json({
      success: true,
      subjects,
      total,
      page,
      limit,
      data: dashboardData
    });

  } catch (error) {
    console.error('SuperAdmin dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load superadmin dashboard',
      details: error.message
    });
  }
});

// Dashboard route for Parent
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    console.log('Parent dashboard accessed by user:', req.user.username);
    
    const parentId = req.user.id;
    
    // Get parent's children (students)
    const children = await User.find({
      role: 'student',
      parentId: parentId,
      isActive: true
    });

    console.log(`Found ${children.length} children for parent ${req.user.username}`);

    // Get all classes for the children with pagination
    const childIds = children.map(child => child._id);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const sortField = req.query.sortField || 'title';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;

    const [classes, totalClasses] = await Promise.all([
      Class.find({
        students: { $in: childIds },
        status: { $in: ['active', 'scheduled'] }
      })
        .populate('tutor', 'firstName lastName email tutorProfile')
        .populate('students', 'firstName lastName email')
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit),
      Class.countDocuments({
        students: { $in: childIds },
        status: { $in: ['active', 'scheduled'] }
      })
    ]);

    // Get recent sessions for the children
    const recentSessions = await SessionHistory.find({
      classId: { $in: classes.map(c => c._id) },
      'participants.userId': { $in: childIds }
    })
      .populate('classId', 'title subject')
      .sort({ sessionDate: -1 })
      .limit(10);

    // Get upcoming sessions (from class schedules)
    const upcomingSessions = [];
    const now = new Date();
    classes.forEach(cls => {
      if (cls.scheduleType === 'one-time' && cls.classDate > now) {
        upcomingSessions.push({
          classId: cls._id,
          title: cls.title,
          subject: cls.subject,
          sessionDate: cls.classDate,
          startTime: cls.startTime,
          duration: cls.duration,
          tutor: cls.tutor,
          meetingLink: cls.meetingLink
        });
      } else if (cls.scheduleType === 'weekly-recurring' && cls.sessions) {
        cls.sessions.forEach(session => {
          if (session.sessionDate > now && session.status === 'scheduled') {
            upcomingSessions.push({
              classId: cls._id,
              title: cls.title,
              subject: cls.subject,
              sessionDate: session.sessionDate,
              startTime: cls.startTime,
              duration: cls.duration,
              tutor: cls.tutor,
              meetingLink: cls.meetingLink
            });
          }
        });
      }
    });

    // Sort upcoming sessions by date
    upcomingSessions.sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));

    const dashboardData = {
      children: children.map(child => ({
        id: child._id,
        firstName: child.firstName,
        lastName: child.lastName,
        email: child.email,
        classCount: classes.filter(c => c.students.some(s => s._id.toString() === child._id.toString())).length
      })),
      totalClasses,
      upcomingSessions: upcomingSessions.slice(0, 5), // Limit to 5 upcoming
      recentSessions: recentSessions.slice(0, 5), // Limit to 5 recent
      classes: classes.map(cls => ({
        id: cls._id,
        title: cls.title,
        subject: cls.subject,
        tutor: {
          name: `${cls.tutor.firstName} ${cls.tutor.lastName}`,
          email: cls.tutor.email
        },
        scheduleType: cls.scheduleType,
        startTime: cls.startTime,
        duration: cls.duration,
        students: cls.students.filter(s => childIds.includes(s._id))
      })),
      page,
      limit,
      sortField,
      sortDirection
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Parent dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load parent dashboard',
      details: error.message
    });
  }
});

// Dashboard route for Tutor
router.get('/tutor', auth(['tutor']), async (req, res) => {
  try {
    console.log('Tutor dashboard accessed by user:', req.user.username);
    
    const tutorId = req.user.id;
    
    // Get tutor's classes
    const classes = await Class.find({
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    })
      .populate('students', 'firstName lastName email')
      .populate('tutor', 'firstName lastName email');

    // Get upcoming sessions
    const upcomingSessions = await SessionHistory.find({
      classId: { $in: classes.map(c => c._id) },
      sessionDate: { $gte: new Date() },
      status: 'scheduled'
    })
      .populate('classId', 'title subject')
      .sort({ sessionDate: 1 })
      .limit(10);

    // Get recent sessions
    const recentSessions = await SessionHistory.find({
      classId: { $in: classes.map(c => c._id) },
      sessionDate: { $lt: new Date() }
    })
      .populate('classId', 'title subject')
      .sort({ sessionDate: -1 })
      .limit(10);

    // Get sessions that need review
    const pendingReviews = await SessionHistory.find({
      classId: { $in: classes.map(c => c._id) },
      status: 'completed',
      'review.completed': { $ne: true }
    })
      .populate('classId', 'title subject')
      .sort({ sessionDate: -1 });

    // Calculate today's sessions
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todaySessions = upcomingSessions.filter(s => {
      const sessionDate = new Date(s.sessionDate);
      return sessionDate >= startOfDay && sessionDate < endOfDay;
    });

    const dashboardData = {
      totalClasses: classes.length,
      totalStudents: [...new Set(classes.flatMap(c => c.students.map(s => s._id.toString())))].length,
      upcomingSessions: upcomingSessions.length,
      recentSessions: recentSessions.length,
      pendingReviews: pendingReviews.length,
      todaySessions: todaySessions.length,
      
      classes: classes.map(cls => {
        const joinStatus = cls.canJoin();
        return {
          id: cls._id,
          title: cls.title,
          subject: cls.subject,
          studentCount: cls.students.length,
          scheduleType: cls.scheduleType,
          startTime: cls.startTime,
          duration: cls.duration,
          recurringDays: cls.recurringDays, // ← Added missing field
          nextSession: cls.getNextSessionTime(),
          canJoin: joinStatus.canJoin,
          joinReason: joinStatus.reason,
          meetingLink: cls.meetingLink,
          meetingId: cls.meetingId,
          status: cls.status
        };
      }),
      
      upcomingSessionsList: upcomingSessions.slice(0, 5),
      recentSessionsList: recentSessions.slice(0, 5),
      pendingReviewsList: pendingReviews.slice(0, 5),
      todaySessionsList: todaySessions
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Tutor dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load tutor dashboard',
      details: error.message
    });
  }
});

// Simple flat tutor dashboard route (similar to student style)
router.get('/tutor/dashboard', auth(['tutor']), async (req, res) => {
  try {
    console.log('Tutor flat dashboard accessed by user:', req.user.username);
    
    const tutorId = req.user.id;
    
    // Get tutor's classes with full details
    const classes = await Class.find({
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    })
      .populate('students', 'firstName lastName email')
      .populate('tutor', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Calculate today's sessions
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Find today's classes/sessions
    const todayClasses = [];
    classes.forEach(cls => {
      const joinStatus = cls.canJoin();
      
      if (cls.scheduleType === 'one-time' && 
          cls.classDate >= startOfDay && cls.classDate < endOfDay) {
        todayClasses.push({
          id: cls._id,
          title: cls.title,
          subject: cls.subject,
          sessionTime: cls.classDate,
          startTime: cls.startTime,
          duration: cls.duration,
          students: cls.students,
          canJoin: joinStatus.canJoin,
          joinReason: joinStatus.reason,
          meetingLink: cls.meetingLink,
          meetingId: cls.meetingId,
          type: 'one-time'
        });
      } else if (cls.scheduleType === 'weekly-recurring' && 
                 cls.recurringDays && cls.recurringDays.includes(dayName)) {
        const todaySession = cls.sessions?.find(s => {
          const sessionDate = new Date(s.sessionDate);
          return sessionDate >= startOfDay && sessionDate < endOfDay;
        });
        
        if (todaySession) {
          todayClasses.push({
            id: cls._id,
            title: cls.title,
            subject: cls.subject,
            sessionTime: todaySession.sessionDate,
            startTime: cls.startTime,
            duration: cls.duration,
            students: cls.students,
            canJoin: joinStatus.canJoin,
            joinReason: joinStatus.reason,
            meetingLink: cls.meetingLink,
            meetingId: cls.meetingId,
            type: 'recurring',
            sessionStatus: todaySession.status
          });
        }
      }
    });

    const tutorData = {
      profile: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        role: req.user.role
      },
      totalClasses: classes.length,
      totalStudents: [...new Set(classes.flatMap(c => c.students.map(s => s._id.toString())))].length,
      todaySessions: todayClasses.length,
      
      // Today's classes with meeting info
      todayClasses: todayClasses,
      
      // All classes with meeting info
      classes: classes.map(cls => {
        const joinStatus = cls.canJoin();
        return {
          id: cls._id,
          title: cls.title,
          subject: cls.subject,
          students: cls.students.map(s => ({
            id: s._id,
            name: `${s.firstName} ${s.lastName}`,
            email: s.email
          })),
          scheduleType: cls.scheduleType,
          startTime: cls.startTime,
          duration: cls.duration,
          classDate: cls.classDate,
          recurringDays: cls.recurringDays,
          status: cls.status,
          canJoin: joinStatus.canJoin,
          joinReason: joinStatus.reason,
          meetingLink: cls.meetingLink,
          meetingId: cls.meetingId,
          nextSession: cls.getNextSessionTime()
        };
      })
    };

    res.json({
      success: true,
      data: tutorData,
      message: 'Tutor Dashboard',
      permissions: ['view_classes', 'join_meetings', 'manage_sessions', 'view_students']
    });

  } catch (error) {
    console.error('Tutor flat dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load tutor dashboard',
      details: error.message
    });
  }
});

// Student dashboard route  
router.get('/student', auth(['student']), async (req, res) => {
  try {
    console.log('Student dashboard accessed by user:', req.user.username);
    
    const studentId = req.user.id;
    
    // Get student's classes
    const classes = await Class.find({
      students: studentId,
      status: { $in: ['active', 'scheduled'] }
    })
      .populate('tutor', 'firstName lastName email')
      .populate('students', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Calculate today's sessions
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Find today's classes/sessions
    const todayClasses = [];
    classes.forEach(cls => {
      const joinStatus = cls.canJoin();
      
      if (cls.scheduleType === 'one-time' && 
          cls.classDate >= startOfDay && cls.classDate < endOfDay) {
        todayClasses.push({
          id: cls._id,
          title: cls.title,
          subject: cls.subject,
          sessionTime: cls.classDate,
          startTime: cls.startTime,
          duration: cls.duration,
          tutor: cls.tutor,
          canJoin: joinStatus.canJoin,
          joinReason: joinStatus.reason,
          meetingLink: cls.meetingLink,
          meetingId: cls.meetingId,
          type: 'one-time'
        });
      } else if (cls.scheduleType === 'weekly-recurring' && 
                 cls.recurringDays && cls.recurringDays.includes(dayName)) {
        const todaySession = cls.sessions?.find(s => {
          const sessionDate = new Date(s.sessionDate);
          return sessionDate >= startOfDay && sessionDate < endOfDay;
        });
        
        if (todaySession) {
          todayClasses.push({
            id: cls._id,
            title: cls.title,
            subject: cls.subject,
            sessionTime: todaySession.sessionDate,
            startTime: cls.startTime,
            duration: cls.duration,
            tutor: cls.tutor,
            canJoin: joinStatus.canJoin,
            joinReason: joinStatus.reason,
            meetingLink: cls.meetingLink,
            meetingId: cls.meetingId,
            type: 'recurring',
            sessionStatus: todaySession.status
          });
        }
      }
    });

    const studentData = {
      profile: {
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        role: req.user.role,
        enrollmentDate: req.user.createdAt
      },
      totalClasses: classes.length,
      todaySessions: todayClasses.length,
      
      // Today's classes with meeting info
      todayClasses: todayClasses,
      
      // All enrolled classes with meeting info
      classes: classes.map(cls => {
        const joinStatus = cls.canJoin();
        return {
          id: cls._id,
          title: cls.title,
          subject: cls.subject,
          tutor: {
            id: cls.tutor._id,
            name: `${cls.tutor.firstName} ${cls.tutor.lastName}`,
            email: cls.tutor.email
          },
          scheduleType: cls.scheduleType,
          startTime: cls.startTime,
          duration: cls.duration,
          classDate: cls.classDate,
          recurringDays: cls.recurringDays,
          status: cls.status,
          canJoin: joinStatus.canJoin,
          joinReason: joinStatus.reason,
          meetingLink: cls.meetingLink,
          meetingId: cls.meetingId,
          nextSession: cls.getNextSessionTime()
        };
      })
    };

    res.json({
      success: true,
      data: studentData,
      message: 'Student Dashboard',
      permissions: ['view_classes', 'join_meetings', 'view_assignments']
    });

  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load student dashboard',
      details: error.message
    });
  }
});

// Get today's sessions for tutor
router.get('/tutor/today', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    // Calculate today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get tutor's classes
    const classes = await Class.find({
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    });

    // Get today's sessions from SessionHistory
    const todaySessions = await SessionHistory.find({
      classId: { $in: classes.map(c => c._id) },
      sessionDate: { $gte: startOfDay, $lt: endOfDay }
    })
      .populate('classId', 'title subject students')
      .sort({ sessionDate: 1 });

    // Also check for classes that should have sessions today
    const todayClasses = [];
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    classes.forEach(cls => {
      if (cls.scheduleType === 'one-time' && 
          cls.classDate >= startOfDay && cls.classDate < endOfDay) {
        todayClasses.push({
          class: cls,
          sessionTime: cls.classDate,
          meetingSession: null,
          canJoin: cls.canJoin().canJoin,
          meetingLink: cls.meetingLink,
          meetingId: cls.meetingId
        });
      } else if (cls.scheduleType === 'weekly-recurring' && 
                 cls.recurringDays && cls.recurringDays.includes(dayName)) {
        const todaySession = cls.sessions?.find(s => {
          const sessionDate = new Date(s.sessionDate);
          return sessionDate >= startOfDay && sessionDate < endOfDay;
        });
        
        if (todaySession) {
          todayClasses.push({
            class: cls,
            sessionTime: todaySession.sessionDate,
            meetingSession: todaySession,
            canJoin: cls.canJoin().canJoin,
            meetingLink: cls.meetingLink,
            meetingId: cls.meetingId
          });
        }
      }
    });

    res.json({
      success: true,
      data: {
        sessions: todaySessions,
        classes: todayClasses,
        count: todaySessions.length + todayClasses.length
      }
    });

  } catch (error) {
    console.error('Tutor today sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load today\'s sessions',
      details: error.message
    });
  }
});

// Get upcoming sessions for tutor
router.get('/tutor/sessions/upcoming', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    // Get tutor's classes
    const classes = await Class.find({
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    });

    const sessions = await SessionHistory.find({
      classId: { $in: classes.map(c => c._id) },
      sessionDate: { $gte: new Date() },
      status: 'scheduled'
    })
      .populate('classId', 'title subject')
      .sort({ sessionDate: 1 });

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Tutor upcoming sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load upcoming sessions',
      details: error.message
    });
  }
});

// Get session history for tutor
router.get('/tutor/sessions/history', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    // Get tutor's classes
    const classes = await Class.find({
      tutor: tutorId
    });

    // Build filter
    let filter = {
      classId: { $in: classes.map(c => c._id) },
      sessionDate: { $lt: new Date() }
    };

    if (status !== 'all') {
      filter.status = status;
    }

    const sessions = await SessionHistory.find(filter)
      .populate('classId', 'title subject')
      .sort({ sessionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SessionHistory.countDocuments(filter);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Tutor session history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load session history',
      details: error.message
    });
  }
});

// Create a session (when tutor starts a class)
router.post('/tutor/sessions', auth(['tutor']), async (req, res) => {
  try {
    const { classId, notes } = req.body;
    const tutorId = req.user.id;

    // Validate class belongs to tutor
    const cls = await Class.findOne({
      _id: classId,
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    });

    if (!cls) {
      return res.status(404).json({
        success: false,
        error: 'Class not found or not accessible'
      });
    }

    // Create new session history entry
    const session = new SessionHistory({
      classId: classId,
      sessionDate: new Date(),
      status: 'in-progress',
      startTime: new Date(),
      participants: [],
      notes: notes || '',
      createdBy: tutorId
    });

    await session.save();

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      details: error.message
    });
  }
});

// Update session (end session, add review, etc.)
router.post('/tutor/sessions/:sessionId/review', auth(['tutor']), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes, attendanceData, sessionRating, nextTopics } = req.body;
    const tutorId = req.user.id;

    // Find the session and verify it belongs to tutor
    const session = await SessionHistory.findById(sessionId)
      .populate('classId', 'tutor');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.classId.tutor.toString() !== tutorId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to review this session'
      });
    }

    // Update session with review data
    const updatedSession = await SessionHistory.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          status: 'completed',
          endTime: new Date(),
          notes: notes || session.notes,
          'review.completed': true,
          'review.rating': sessionRating,
          'review.notes': notes,
          'review.nextTopics': nextTopics,
          'review.attendanceData': attendanceData
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      data: updatedSession
    });

  } catch (error) {
    console.error('Session review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session review',
      details: error.message
    });
  }
});

// Get tutor's classes with session info
router.get('/tutor/classes', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    // Get tutor's classes
    const classes = await Class.find({
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    })
      .populate('students', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // For each class, get next and last session info
    const classesWithSessions = await Promise.all(classes.map(async (cls) => {
      // Get next session
      const nextSession = await SessionHistory.findOne({
        classId: cls._id,
        sessionDate: { $gte: new Date() },
        status: 'scheduled'
      }).sort({ sessionDate: 1 });

      // Get last session
      const lastSession = await SessionHistory.findOne({
        classId: cls._id,
        sessionDate: { $lt: new Date() }
      }).sort({ sessionDate: -1 });

      return {
        ...cls.toObject(),
        nextSession: nextSession ? {
          id: nextSession._id,
          date: nextSession.sessionDate,
          status: nextSession.status
        } : null,
        lastSession: lastSession ? {
          id: lastSession._id,
          date: lastSession.sessionDate,
          status: lastSession.status,
          rating: lastSession.review?.rating
        } : null,
        meetingSession: nextSession ? {
          id: nextSession._id,
          scheduledStartTime: nextSession.sessionDate,
          status: nextSession.status,
          meetingId: cls.meetingId,
          meetingLink: cls.meetingLink
        } : null
      };
    }));

    res.json({
      success: true,
      data: classesWithSessions
    });

  } catch (error) {
    console.error('Tutor classes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load tutor classes',
      details: error.message
    });
  }
});

// Get tutor's students
router.get('/tutor/students', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    
    // Get tutor's classes to find students
    const classes = await Class.find({
      tutor: tutorId,
      status: { $in: ['active', 'scheduled'] }
    })
      .populate('students', 'firstName lastName email')
      .populate('tutor', 'firstName lastName email');

    // Extract unique students
    const studentMap = new Map();
    classes.forEach(cls => {
      cls.students.forEach(student => {
        if (!studentMap.has(student._id.toString())) {
          studentMap.set(student._id.toString(), {
            ...student.toObject(),
            classes: []
          });
        }
        studentMap.get(student._id.toString()).classes.push({
          id: cls._id,
          title: cls.title,
          subject: cls.subject
        });
      });
    });

    const students = Array.from(studentMap.values());

    res.json({
      success: true,
      data: students
    });

  } catch (error) {
    console.error('Tutor students error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load tutor students',
      details: error.message
    });
  }
});

// ===== SUBJECT MANAGEMENT ROUTES =====

// Helper function to get admin's center ID
const getAdminCenterId = async (userId) => {
  const user = await User.findById(userId).populate('assignments.center');
  if (!user) {
    throw new Error('User not found');
  }
  if (!user.assignments) {
    throw new Error('User assignments not found');
  }
  if (!user.assignments.center) {
    throw new Error('Admin center assignment not found');
  }
  
  // Check if center is populated (object) or just an ObjectId
  const centerId = user.assignments.center._id || user.assignments.center;
  
  // Validate that we have a valid ObjectId
  if (!centerId || typeof centerId === 'string' && centerId.length !== 24) {
    throw new Error(`Invalid center ID: ${centerId}`);
  }
  
  return centerId;
};

// ===== GRADE ROUTES =====

// GET /api/dashboard/admin/grades - Get all grades for admin's center
// GET /api/dashboard/admin/grades - Get all grades for admin's center
router.get('/admin/grades', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    console.log('GET /admin/grades - User ID:', req.user.id);
    const centerId = await getAdminCenterId(req.user.id);
    console.log('GET /admin/grades - Center ID:', centerId);

    // Support returning all grades (for select lists) when all=true
    if (req.query.all === 'true') {
      const allGrades = await Grade.find({ centerId }).sort({ gradeName: 1 });
      return res.json({ success: true, grades: allGrades, total: allGrades.length });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortField = req.query.sortField || 'gradeName';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [grades, total] = await Promise.all([
      Grade.find({ centerId }).sort({ [sortField]: sortDirection }).skip(skip).limit(limit),
      Grade.countDocuments({ centerId })
    ]);

    console.log('GET /admin/grades - Returning page', page, 'limit', limit, 'total', total);

    res.json({
      success: true,
      grades,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching grades'
    });
  }
});

// POST /api/dashboard/admin/grades - Create a new grade
router.post('/admin/grades', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { gradeCode, gradeName } = req.body;

    // Validation
    if (!gradeCode || !gradeName) {
      return res.status(400).json({
        success: false,
        message: 'Grade code and grade name are required'
      });
    }

    // Check for duplicate grade code in the same center
    const existingGrade = await Grade.findOne({ 
      gradeCode: gradeCode.toLowerCase(), 
      centerId 
    });
    
    if (existingGrade) {
      return res.status(400).json({
        success: false,
        message: 'Grade code already exists'
      });
    }

    const grade = new Grade({
      gradeCode,
      gradeName,
      centerId
    });

    await grade.save();

    res.status(201).json({
      success: true,
      message: 'Grade created successfully',
      grade
    });
  } catch (error) {
    console.error('Error creating grade:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating grade'
    });
  }
});

// PUT /api/dashboard/admin/grades/:id - Update a grade
router.put('/admin/grades/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { gradeCode, gradeName } = req.body;
    const gradeId = req.params.id;

    // Validate that gradeId is not undefined or null
    if (!gradeId || gradeId === 'undefined' || gradeId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID'
      });
    }

    // Validate that gradeId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID format'
      });
    }

    // Validation
    if (!gradeCode || !gradeName) {
      return res.status(400).json({
        success: false,
        message: 'Grade code and grade name are required'
      });
    }

    // Check if grade exists and belongs to admin's center
    const grade = await Grade.findOne({ _id: gradeId, centerId });
    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    // Check for duplicate grade code in the same center (excluding current grade)
    const existingGrade = await Grade.findOne({ 
      gradeCode: gradeCode.toLowerCase(), 
      centerId,
      _id: { $ne: gradeId }
    });
    
    if (existingGrade) {
      return res.status(400).json({
        success: false,
        message: 'Grade code already exists'
      });
    }

    grade.gradeCode = gradeCode;
    grade.gradeName = gradeName;
    await grade.save();

    res.json({
      success: true,
      message: 'Grade updated successfully',
      grade
    });
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating grade'
    });
  }
});

// DELETE /api/dashboard/admin/grades/:id - Delete a grade
router.delete('/admin/grades/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const gradeId = req.params.id;

    // Validate that gradeId is not undefined or null
    if (!gradeId || gradeId === 'undefined' || gradeId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID'
      });
    }

    // Validate that gradeId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID format'
      });
    }

    // Check if grade exists and belongs to admin's center
    const grade = await Grade.findOne({ _id: gradeId, centerId });
    if (!grade) {
      return res.status(404).json({
        success: false,
        message: 'Grade not found'
      });
    }

    // Check if grade has associated subjects
    const subjectCount = await Subject.countDocuments({ gradeId });
    if (subjectCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete grade. It has associated subjects.'
      });
    }

    await Grade.findByIdAndDelete(gradeId);

    res.json({
      success: true,
      message: 'Grade deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting grade:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting grade'
    });
  }
});

// ===== SUBJECT ROUTES =====

// GET /api/dashboard/admin/subjects - Get all subjects for admin's center
router.get('/admin/subjects', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    console.log('GET /admin/subjects - User ID:', req.user.id);
    const centerId = await getAdminCenterId(req.user.id);
    console.log('GET /admin/subjects - Center ID:', centerId);
    
    // Find subjects and filter out any with invalid gradeIds
    const subjectsRaw = await Subject.find({ centerId });
    console.log('GET /admin/subjects - Found subjects:', subjectsRaw.length);
    
    // Check each gradeId for validity
    const validSubjects = [];
    const invalidSubjects = [];
    
    subjectsRaw.forEach(subject => {
      if (!subject.gradeId) {
        invalidSubjects.push({ subjectId: subject._id, gradeId: 'null/undefined' });
      } else if (!mongoose.Types.ObjectId.isValid(subject.gradeId)) {
        invalidSubjects.push({ subjectId: subject._id, gradeId: subject.gradeId });
      } else {
        validSubjects.push(subject);
      }
    });
    
    if (invalidSubjects.length > 0) {
      console.log('GET /admin/subjects - Invalid gradeIds found:', invalidSubjects);
    }
    
    console.log('GET /admin/subjects - Valid subjects after filtering:', validSubjects.length);
    
    // Only populate subjects with valid gradeIds
    if (validSubjects.length === 0) {
      return res.json({
        success: true,
        subjects: []
      });
    }
    
    const subjects = await Subject.find({ 
      centerId,
      _id: { $in: validSubjects.map(s => s._id) }
    })
      .populate('gradeId', 'gradeName')
      .sort({ subjectName: 1 });
    
    res.json({
      success: true,
      subjects
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching subjects'
    });
  }
});

// POST /api/dashboard/admin/subjects - Create a new subject
router.post('/admin/subjects', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { subjectCode, subjectName, gradeId } = req.body;

    console.log('POST /admin/subjects - Request data:', { subjectCode, subjectName, gradeId });

    // Validation
    if (!subjectCode || !subjectName || !gradeId) {
      return res.status(400).json({
        success: false,
        message: 'Subject code, subject name, and grade are required'
      });
    }

    // Validate that gradeId is provided and not a string 'undefined'
    if (!gradeId || gradeId === 'undefined' || gradeId === 'null') {
      console.log('POST /admin/subjects - Missing or invalid gradeId:', gradeId);
      return res.status(400).json({
        success: false,
        message: 'Grade ID is required'
      });
    }

    // Validate that gradeId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      console.log('POST /admin/subjects - Invalid gradeId:', gradeId);
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID format'
      });
    }

    // Verify grade exists and belongs to admin's center
    const grade = await Grade.findOne({ _id: gradeId, centerId });
    if (!grade) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade selected'
      });
    }

    // Check for duplicate subject code within the same grade and center
    const existingSubject = await Subject.findOne({ 
      subjectCode: subjectCode.toLowerCase(), 
      gradeId,
      centerId 
    });
    
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists for this grade'
      });
    }

    const subject = new Subject({
      subjectCode,
      subjectName,
      gradeId,
      centerId
    });

    await subject.save();
    await subject.populate('gradeId', 'gradeName');

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      subject
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating subject'
    });
  }
});

// PUT /api/dashboard/admin/subjects/:id - Update a subject
router.put('/admin/subjects/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { subjectCode, subjectName, gradeId } = req.body;
    const subjectId = req.params.id;

    // Validate that subjectId is not undefined or null
    if (!subjectId || subjectId === 'undefined' || subjectId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID'
      });
    }

    // Validate that subjectId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    // Validation
    if (!subjectCode || !subjectName || !gradeId || gradeId === 'undefined' || gradeId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Subject code, subject name, and grade are required'
      });
    }

    // Validate that gradeId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(gradeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade ID format'
      });
    }

    // Check if subject exists and belongs to admin's center
    const subject = await Subject.findOne({ _id: subjectId, centerId });
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Verify grade exists and belongs to admin's center
    const grade = await Grade.findOne({ _id: gradeId, centerId });
    if (!grade) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade selected'
      });
    }

    // Check for duplicate subject code within the same grade and center (excluding current subject)
    const existingSubject = await Subject.findOne({ 
      subjectCode: subjectCode.toLowerCase(), 
      gradeId,
      centerId,
      _id: { $ne: subjectId }
    });
    
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists for this grade'
      });
    }

    subject.subjectCode = subjectCode;
    subject.subjectName = subjectName;
    subject.gradeId = gradeId;
    await subject.save();
    await subject.populate('gradeId', 'gradeName');

    res.json({
      success: true,
      message: 'Subject updated successfully',
      subject
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating subject'
    });
  }
});

// DELETE /api/dashboard/admin/subjects/:id - Delete a subject
router.delete('/admin/subjects/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const subjectId = req.params.id;

    // Validate that subjectId is not undefined or null
    if (!subjectId || subjectId === 'undefined' || subjectId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID'
      });
    }

    // Validate that subjectId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    // Check if subject exists and belongs to admin's center
    const subject = await Subject.findOne({ _id: subjectId, centerId });
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Check if subject has associated topics
    const topicCount = await Topic.countDocuments({ subjectId });
    if (topicCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete subject. It has associated topics.'
      });
    }

    await Subject.findByIdAndDelete(subjectId);

    res.json({
      success: true,
      message: 'Subject deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting subject'
    });
  }
});

// ===== TOPIC ROUTES =====

// GET /api/dashboard/admin/topics - Get all topics for admin's center
router.get('/admin/topics', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    // Find topics and filter out any with invalid subjectIds
    const topicsRaw = await Topic.find({ centerId });
    console.log('GET /admin/topics - Found topics:', topicsRaw.length);
    // Filter topics with valid subjectIds
    const validTopics = topicsRaw.filter(topic => {
      return topic.subjectId && mongoose.Types.ObjectId.isValid(topic.subjectId);
    });
    console.log('GET /admin/topics - Valid topics after filtering:', validTopics.length);
    if (validTopics.length === 0) {
      return res.json({
        success: true,
        topics: [],
        total: 0
      });
    }
    // Support returning all topics for select lists
    if (req.query.all === 'true') {
      const topicsAll = await Topic.find({ centerId, _id: { $in: validTopics.map(t => t._id) } })
        .populate({
          path: 'subjectId',
          select: 'subjectName gradeId',
          populate: { path: 'gradeId', select: 'gradeName' }
        })
        .sort({ topicName: 1 });
      return res.json({ success: true, topics: topicsAll, total: topicsAll.length });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortField = req.query.sortField || 'topicName';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;
    const [topics, total] = await Promise.all([
      Topic.find({ centerId, _id: { $in: validTopics.map(t => t._id) } })
        .populate({
          path: 'subjectId',
          select: 'subjectName gradeId',
          populate: { path: 'gradeId', select: 'gradeName' }
        })
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit),
      Topic.countDocuments({ centerId, _id: { $in: validTopics.map(t => t._id) } })
    ]);
    res.json({
      success: true,
      topics,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching topics'
    });
  }
});

// POST /api/dashboard/admin/topics - Create a new topic
router.post('/admin/topics', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { topicName, subjectId } = req.body;

    // Validation
    if (!topicName || !subjectId || subjectId === 'undefined' || subjectId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Topic name and subject are required'
      });
    }

    // Validate that subjectId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    // Verify subject exists and belongs to admin's center
    const subject = await Subject.findOne({ _id: subjectId, centerId });
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject selected'
      });
    }

    // Check for duplicate topic name within the same subject and center
    const existingTopic = await Topic.findOne({ 
      topicName: topicName.toLowerCase(), 
      subjectId,
      centerId 
    });
    
    if (existingTopic) {
      return res.status(400).json({
        success: false,
        message: 'Topic name already exists for this subject'
      });
    }

    const topic = new Topic({
      topicName,
      subjectId,
      centerId
    });

    await topic.save();
    await topic.populate({
      path: 'subjectId',
      select: 'subjectName gradeId',
      populate: {
        path: 'gradeId',
        select: 'gradeName'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      topic
    });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating topic'
    });
  }
});

// PUT /api/dashboard/admin/topics/:id - Update a topic
router.put('/admin/topics/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { topicName, subjectId } = req.body;
    const topicId = req.params.id;

    // Validation
    if (!topicName || !subjectId || subjectId === 'undefined' || subjectId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Topic name and subject are required'
      });
    }

    // Validate that subjectId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject ID format'
      });
    }

    // Check if topic exists and belongs to admin's center
    const topic = await Topic.findOne({ _id: topicId, centerId });
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Verify subject exists and belongs to admin's center
    const subject = await Subject.findOne({ _id: subjectId, centerId });
    if (!subject) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subject selected'
      });
    }

    // Check for duplicate topic name within the same subject and center (excluding current topic)
    const existingTopic = await Topic.findOne({ 
      topicName: topicName.toLowerCase(), 
      subjectId,
      centerId,
      _id: { $ne: topicId }
    });
    
    if (existingTopic) {
      return res.status(400).json({
        success: false,
        message: 'Topic name already exists for this subject'
      });
    }

    topic.topicName = topicName;
    topic.subjectId = subjectId;
    await topic.save();
    await topic.populate({
      path: 'subjectId',
      select: 'subjectName gradeId',
      populate: {
        path: 'gradeId',
        select: 'gradeName'
      }
    });

    res.json({
      success: true,
      message: 'Topic updated successfully',
      topic
    });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating topic'
    });
  }
});

// DELETE /api/dashboard/admin/topics/:id - Delete a topic
router.delete('/admin/topics/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const topicId = req.params.id;

    // Check if topic exists and belongs to admin's center
    const topic = await Topic.findOne({ _id: topicId, centerId });
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Check if topic has associated subtopics
    const subtopicCount = await Subtopic.countDocuments({ topicId });
    if (subtopicCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete topic. It has associated sub-topics.'
      });
    }

    await Topic.findByIdAndDelete(topicId);

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting topic'
    });
  }
});

// ===== SUBTOPIC ROUTES =====

// GET /api/dashboard/admin/subtopics - Get all subtopics for admin's center
router.get('/admin/subtopics', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    
    // Find subtopics and filter out any with invalid topicIds
    const subtopicsRaw = await Subtopic.find({ centerId });
    console.log('GET /admin/subtopics - Found subtopics:', subtopicsRaw.length);
    
    // Filter subtopics with valid topicIds
    const validSubtopics = subtopicsRaw.filter(subtopic => {
      return subtopic.topicId && mongoose.Types.ObjectId.isValid(subtopic.topicId);
    });
    
    console.log('GET /admin/subtopics - Valid subtopics after filtering:', validSubtopics.length);
    
    if (validSubtopics.length === 0) {
      return res.json({
        success: true,
        subtopics: [],
        total: 0
      });
    }
    // Support returning all subtopics for select lists
    if (req.query.all === 'true') {
      const subtopicsAll = await Subtopic.find({ centerId, _id: { $in: validSubtopics.map(st => st._id) } })
        .populate({
          path: 'topicId',
          select: 'topicName subjectId',
          populate: {
            path: 'subjectId',
            select: 'subjectName gradeId',
            populate: { path: 'gradeId', select: 'gradeName' }
          }
        }
        )
        .sort({ subtopicName: 1 });
      return res.json({ success: true, subtopics: subtopicsAll, total: subtopicsAll.length });
    }
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortField = req.query.sortField || 'subtopicName';
    const sortDirection = req.query.sortDirection === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;
    const subtopicsQuery = `
      SELECT 
        st.id as "_id",
        st.subtopic_name as "subtopicName",
        t.id as "topicId",
        t.topic_name as "topicName",
        s.id as "subjectId",
        s."subjectName" as "subjectName",
        g.id as "gradeId",
        g.grade_name as "gradeName",
        st.created_at as "createdAt",
        st.updated_at as "updatedAt"
      FROM subtopics st
      JOIN topics t ON st.topic_id = t.id
      JOIN subjects s ON t.subject_id = s.id
      JOIN grades g ON s."gradeId" = g.id
      WHERE st.center_id = :centerId
      ORDER BY st.${sortField} ${sortDirection === 'desc' ? 'DESC' : 'ASC'}
      OFFSET :skip LIMIT :limit
    `;
    
    const [subtopics, totalResult] = await Promise.all([
      sequelize.query(subtopicsQuery, {
        replacements: { 
          centerId,
          skip,
          limit
        },
        type: sequelize.QueryTypes.SELECT
      }),
      Subtopic.countDocuments({ centerId, _id: { $in: validSubtopics.map(st => st._id) } })
    ]);
    res.json({
      success: true,
      subtopics,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching subtopics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching subtopics'
    });
  }
});

// POST /api/dashboard/admin/subtopics - Create a new subtopic
router.post('/admin/subtopics', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { subtopicName, topicId } = req.body;

    // Validation
    if (!subtopicName || !topicId || topicId === 'undefined' || topicId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Subtopic name and topic are required'
      });
    }

    // Validate that topicId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid topic ID format'
      });
    }

    // Verify topic exists and belongs to admin's center
    const topic = await Topic.findOne({ _id: topicId, centerId });
    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid topic selected'
      });
    }

    // Check for duplicate subtopic name within the same topic and center
    const existingSubtopic = await Subtopic.findOne({ 
      subtopicName: subtopicName.toLowerCase(), 
      topicId,
      centerId 
    });
    
    if (existingSubtopic) {
      return res.status(400).json({
        success: false,
        message: 'Subtopic name already exists for this topic'
      });
    }

    const subtopic = new Subtopic({
      subtopicName,
      topicId,
      centerId
    });

    await subtopic.save();
    await subtopic.populate({
      path: 'topicId',
      select: 'topicName subjectId',
      populate: {
        path: 'subjectId',
        select: 'subjectName gradeId',
        populate: {
          path: 'gradeId',
          select: 'gradeName'
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Subtopic created successfully',
      subtopic
    });
  } catch (error) {
    console.error('Error creating subtopic:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating subtopic'
    });
  }
});

// PUT /api/dashboard/admin/subtopics/:id - Update a subtopic
router.put('/admin/subtopics/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const { subtopicName, topicId } = req.body;
    const subtopicId = req.params.id;

    // Validation
    if (!subtopicName || !topicId || topicId === 'undefined' || topicId === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Subtopic name and topic are required'
      });
    }

    // Validate that topicId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid topic ID format'
      });
    }

    // Check if subtopic exists and belongs to admin's center
    const subtopic = await Subtopic.findOne({ _id: subtopicId, centerId });
    if (!subtopic) {
      return res.status(404).json({
        success: false,
        message: 'Subtopic not found'
      });
    }

    // Verify topic exists and belongs to admin's center
    const topic = await Topic.findOne({ _id: topicId, centerId });
    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid topic selected'
      });
    }

    // Check for duplicate subtopic name within the same topic and center (excluding current subtopic)
    const existingSubtopic = await Subtopic.findOne({ 
      subtopicName: subtopicName.toLowerCase(), 
      topicId,
      centerId,
      _id: { $ne: subtopicId }
    });
    
    if (existingSubtopic) {
      return res.status(400).json({
        success: false,
        message: 'Subtopic name already exists for this topic'
      });
    }

    subtopic.subtopicName = subtopicName;
    subtopic.topicId = topicId;
    await subtopic.save();
    await subtopic.populate({
      path: 'topicId',
      select: 'topicName subjectId',
      populate: {
        path: 'subjectId',
        select: 'subjectName gradeId',
        populate: {
          path: 'gradeId',
          select: 'gradeName'
        }
      }
    });

    res.json({
      success: true,
      message: 'Subtopic updated successfully',
      subtopic
    });
  } catch (error) {
    console.error('Error updating subtopic:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating subtopic'
    });
  }
});

// DELETE /api/dashboard/admin/subtopics/:id - Delete a subtopic
router.delete('/admin/subtopics/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const centerId = await getAdminCenterId(req.user.id);
    const subtopicId = req.params.id;

    // Check if subtopic exists and belongs to admin's center
    const subtopic = await Subtopic.findOne({ _id: subtopicId, centerId });
    if (!subtopic) {
      return res.status(404).json({
        success: false,
        message: 'Subtopic not found'
      });
    }

    await Subtopic.findByIdAndDelete(subtopicId);

    res.json({
      success: true,
      message: 'Subtopic deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subtopic:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting subtopic'
    });
  }
});


module.exports = router;