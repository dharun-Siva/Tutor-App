const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const SessionHistory = require('../models/SessionHistory');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET /api/sessions/parent
// @desc    Get all sessions for a parent's children ONLY
// @access  Private (Parent)
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    console.log('📋 Parent sessions endpoint called by user:', req.user.id);
    const parentId = req.user.id;

    // Step 1: Find the parent and get their assigned children
    const parent = await User.findById(parentId).select('assignments.children firstName lastName email').lean();
    
    if (!parent) {
      console.log('❌ Parent not found with ID:', parentId);
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Step 2: Get the children IDs that belong to this parent
    const childrenIds = parent.assignments?.children || [];
    console.log('👨‍👩‍👧‍👦 Parent', parent.firstName, 'has', childrenIds.length, 'assigned children');

    if (childrenIds.length === 0) {
      console.log('📝 No children assigned to this parent');
      return res.json({
        success: true,
        data: {
          allSessions: [],
          todaySessions: [],
          upcomingSessions: [],
          totalSessions: 0,
          children: [],
          message: 'No children assigned to this parent'
        }
      });
    }

    // Step 3: Get details of the children for display
    const children = await User.find({
      _id: { $in: childrenIds },
      role: 'student'
    }).select('_id firstName lastName email').lean();

    console.log('👦 Found', children.length, 'valid children:', children.map(c => c.firstName + ' ' + c.lastName));

    // Step 4: Find classes where the children are enrolled
    const classes = await Class.find({
      students: { $in: childrenIds },
      status: { $in: ['active', 'scheduled'] }
    })
      .populate('tutor', 'firstName lastName email')
      .populate('students', 'firstName lastName email')
      .lean();

    console.log('📚 Found', classes.length, 'classes for parent\'s children');

    // Debug: Check sessions array for each class
    classes.forEach(cls => {
      console.log(`  Class "${cls.title}": sessions array exists = ${!!cls.sessions}, length = ${cls.sessions ? cls.sessions.length : 0}`);
      if (cls.sessions && cls.sessions.length > 0) {
        console.log(`    First session: ${cls.sessions[0].sessionDate}, status: ${cls.sessions[0].status}`);
      }
    });

    // Step 5: Get all session history for these classes
    const classIds = classes.map(c => c._id);
    const sessionHistory = await SessionHistory.find({
      classId: { $in: classIds }
    })
      .populate('classId', 'title subject tutor')
      .sort({ sessionDate: -1 })
      .lean();

    console.log('📅 Found', sessionHistory.length, 'completed sessions from SessionHistory');

    // Step 6: Generate upcoming sessions from class schedules
    const upcomingSessions = [];
    const now = new Date();

    console.log('🔮 Generating upcoming sessions from', classes.length, 'classes at time:', now);

    classes.forEach(cls => {
      console.log(`\nProcessing class: "${cls.title}" (${cls.scheduleType})`);
      
      // Filter students to only include parent's children
      const childrenInClass = cls.students.filter(s => 
        childrenIds.some(childId => childId.toString() === s._id.toString())
      );

      console.log(`  Children in class: ${childrenInClass.length}`);

      if (childrenInClass.length === 0) {
        console.log('  ❌ No parent children in this class, skipping');
        return;
      }

      if (cls.scheduleType === 'one-time' && cls.classDate > now) {
        upcomingSessions.push({
          _id: `${cls._id}_one_time`,
          classId: cls._id,
          className: cls.title,
          subject: cls.subject,
          sessionDate: cls.classDate,
          scheduledStartTime: cls.classDate,
          startTime: cls.startTime,
          duration: cls.duration,
          status: 'scheduled',
          tutor: cls.tutor,
          students: childrenInClass,
          meetingId: cls.meetingId,
          meetingLink: cls.meetingLink,
          canJoin: cls.canJoin ? cls.canJoin().canJoin : false
        });
      } else if (cls.scheduleType === 'weekly-recurring' && cls.sessions) {
        console.log(`  📅 Processing weekly-recurring class with ${cls.sessions.length} sessions`);
        
        let addedCount = 0;
        cls.sessions.forEach((session, index) => {
          const sessionDate = new Date(session.sessionDate);
          const isFuture = sessionDate > now;
          const isScheduled = session.status === 'scheduled';
          
          if (index < 3) { // Log first 3 for debugging
            console.log(`    Session ${index + 1}: ${sessionDate.toISOString()} - Status: ${session.status} - Future: ${isFuture} - Will add: ${isFuture && isScheduled}`);
          }
          
          if (isFuture && isScheduled) {
            upcomingSessions.push({
              _id: `${cls._id}_session_${index}`,
              classId: cls._id,
              className: cls.title,
              subject: cls.subject,
              sessionDate: session.sessionDate,
              scheduledStartTime: session.sessionDate,
              startTime: cls.startTime,
              duration: cls.duration,
              status: session.status,
              tutor: cls.tutor,
              students: childrenInClass,
              meetingId: cls.meetingId,
              meetingLink: cls.meetingLink,
              canJoin: cls.canJoin ? cls.canJoin().canJoin : false
            });
            addedCount++;
          }
        });
        
        console.log(`  ✅ Added ${addedCount} sessions from this class`);
      } else {
        console.log(`  ❌ No session generation logic matched:`);
        console.log(`     Schedule type: ${cls.scheduleType}`);
        console.log(`     Has sessions array: ${!!cls.sessions}`);
        console.log(`     Sessions count: ${cls.sessions ? cls.sessions.length : 0}`);
      }
    });

    console.log('🔮 Generated', upcomingSessions.length, 'upcoming sessions from class schedules');

    // Step 7: Combine historical sessions with class info
    const completedSessions = sessionHistory.map(session => ({
      _id: session._id,
      classId: session.classId._id,
      className: session.classId.title,
      subject: session.classId.subject,
      sessionDate: session.sessionDate,
      scheduledStartTime: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      status: session.status,
      notes: session.notes,
      review: session.review,
      participants: session.participants.filter(p => 
        childrenIds.some(childId => childId.toString() === p.userId.toString())
      ),
      tutor: session.classId.tutor,
      // Map participants back to student format for compatibility
      students: session.participants
        .filter(p => childrenIds.some(childId => childId.toString() === p.userId.toString()))
        .map(p => {
          const child = children.find(c => c._id.toString() === p.userId.toString());
          return child || { _id: p.userId, firstName: 'Unknown', lastName: 'Student' };
        })
    }));

    // Step 8: Categorize sessions by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter today's sessions from upcoming
    const todaySessions = upcomingSessions.filter(session => {
      if (!session.scheduledStartTime) return false;
      const sessionDate = new Date(session.scheduledStartTime);
      return sessionDate >= today && sessionDate < tomorrow;
    });

    // Filter out today's sessions from upcoming
    const futureSessions = upcomingSessions.filter(session => {
      if (!session.scheduledStartTime) return false;
      const sessionDate = new Date(session.scheduledStartTime);
      return sessionDate >= tomorrow;
    });

    // All sessions = completed + upcoming
    const allSessions = [...completedSessions, ...upcomingSessions].sort((a, b) => 
      new Date(b.scheduledStartTime || b.sessionDate) - new Date(a.scheduledStartTime || a.sessionDate)
    );

    console.log('📊 Session breakdown:');
    console.log('   - Total sessions:', allSessions.length);
    console.log('   - Completed sessions:', completedSessions.length);
    console.log('   - Today\'s sessions:', todaySessions.length);
    console.log('   - Future sessions:', futureSessions.length);

    // Step 9: Return sessions filtered for this parent's children only
    res.json({
      success: true,
      data: {
        allSessions: allSessions,
        todaySessions: todaySessions,
        upcomingSessions: futureSessions,
        completedSessions: completedSessions,
        totalSessions: allSessions.length,
        children: children,
        classes: classes.map(cls => ({
          ...cls,
          students: cls.students.filter(s => 
            childrenIds.some(childId => childId.toString() === s._id.toString())
          )
        })),
        parentInfo: {
          name: parent.firstName + ' ' + parent.lastName,
          childrenCount: children.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching parent sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching sessions',
      error: error.message
    });
  }
});

module.exports = router;