const express = require('express');
const router = express.Router();
const MeetingSession = require('../models/MeetingSession');
const SessionParticipant = require('../models/SessionParticipant');
const BillingTransaction = require('../models/BillingTransaction');
const Class = require('../models/Class');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Configuration for billing
const BILLING_CONFIG = {
  minimumBillableMinutes: 15,
  gracePeriodMinutes: 5,
  overtimeThresholdMinutes: 65,
  earlyJoinGracePeriod: 5,
  earlyLeaveGracePeriod: 5,
  noShowThresholdMinutes: 10,
  defaultTaxRate: 0, // 0% tax by default
  platformFeeRate: 0.05 // 5% platform fee
};

// @route   POST /api/sessions
// @desc    Create a new meeting session for a scheduled class
// @access  Private (Admin/Tutor)
router.post('/', auth, async (req, res) => {
  try {
    const { classId, meetingPlatform = 'agora' } = req.body;

    // 🔒 Restrict creation to tutors and admins
    if (!['tutor', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only tutors or admins can create meeting sessions' });
    }

    // ✅ Verify class exists
    const classData = await Class.findById(classId)
      .populate('tutor', 'name email tutorProfile.hourlyRate')
      .populate('students', 'name email parentId');

    if (!classData) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // 🚫 Check if session already exists
    const existingSession = await MeetingSession.findOne({ classId });
    if (existingSession) {
      return res.status(409).json({ 
        message: 'Meeting session already exists for this class',
        sessionId: existingSession._id
      });
    }

    // 🧠 Create session
    const meetingSession = new MeetingSession({
      classId,
      tutorId: classData.tutor._id,
      studentId: classData.students.length > 0 ? classData.students[0]._id : null,
      sessionDate: new Date(),
      scheduledStartTime: new Date(),
      scheduledEndTime: new Date(Date.now() + (classData.duration || 45) * 60 * 1000),
      totalScheduledDuration: classData.duration || 45,
      tutorRate: classData.tutor.tutorProfile?.hourlyRate || 25.0,
      studentRate: classData.tutor.tutorProfile?.hourlyRate || 25.0,
      platformType: meetingPlatform,
      status: 'scheduled',
      createdBy: req.user.id
    });

    // 🔗 Generate meeting link
    await meetingSession.generateMeetingLink();
    await meetingSession.save();

        // 👥 Create participants using the SessionParticipant schema's snake_case fields
        // The schema requires participant_id, meeting_class_id and center.
        const classCenter = classData.center || null;

        const participants = [];

        // Tutor participant
        participants.push({
          participant_id: classData.tutor._id,
          meeting_class_id: classData._id,
          participant_type: 'tutor',
          center: classCenter,
          joinedAt: null
        });

        // Student participants
        classData.students.forEach(student => {
          participants.push({
            participant_id: student._id,
            meeting_class_id: classData._id,
            participant_type: 'student',
            center: classCenter,
            joinedAt: null
          });
        });

        // Insert using schema-compliant fields
        await SessionParticipant.insertMany(participants);

    // 📦 Return populated session
    const populatedSession = await MeetingSession.findById(meetingSession._id)
      .populate('tutorId', 'name email')
      .populate('studentId', 'name email')
      .populate('classId', 'subject title');

    res.status(201).json({
      message: 'Meeting session created successfully',
      session: populatedSession,
      meetingLink: meetingSession.meetingLink
    });

  } catch (error) {
    console.error('Error creating meeting session:', error);
    res.status(500).json({ message: 'Server error creating meeting session' });
  }
});


// @route   POST /api/sessions/:sessionId/join
// @desc    Record participant joining the session
// @access  Private
router.post('/:sessionId/join', auth, async (req, res) => {
  try {
    const session = await MeetingSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Meeting session not found' });
    }

    // Check if user can join (canParticipantJoin is async now)
    console.log(`join route: user ${req.user.id} role=${req.user.role} attempting to join session ${session._id}`);
    const canJoin = await session.canParticipantJoin(req.user.id);
    console.log(`join route: canParticipantJoin returned ${canJoin} for user ${req.user.id} on session ${session._id}`);
    if (!canJoin) {
      console.warn(`join route: DENY user ${req.user.id} for session ${session._id}`);
      return res.status(403).json({ message: 'Not authorized to join this session' });
    }

    // Find participant record: try multiple naming variants to be tolerant of historic records
    let participant = await SessionParticipant.findOne({
      $or: [
        { sessionId: session._id, participantId: req.user.id },
        { meeting_class_id: session.classId || session._id, participant_id: req.user.id },
        { userId: req.user.id, sessionId: session._id },
        { participant_id: req.user.id, meeting_class_id: session.classId || session._id }
      ]
    });

    // If still not found, create a participant record proactively so join can proceed
    if (!participant) {
      console.log(`join route: No SessionParticipant found for user ${req.user.id} in session ${session._id}, creating one`);

      const participantType = req.user.role === 'tutor' ? 'tutor' : 'student';

      // Determine center from Class record (required by schema)
      let classCenterId = null;
      try {
        const cls = await Class.findById(session.classId).select('center').lean();
        classCenterId = cls?.center || null;
      } catch (err) {
        console.warn('join route: unable to resolve class center for participant creation', err.message || err);
      }

      // Create using snake_case fields required by the schema
      participant = new SessionParticipant({
        participant_id: req.user.id,
        meeting_class_id: session.classId || session._id,
        participant_type: participantType,
        center: classCenterId,
        joinedAt: new Date()
      });

      // keep connection event history consistent if available
      if (typeof participant.addConnectionEvent === 'function') {
        participant.addConnectionEvent('joined');
      }

      await participant.save();
      console.log(`join route: Created SessionParticipant ${participant._id} for user ${req.user.id}`);
    } else {
      // Record join time for an existing participant
      participant.joinedAt = new Date();
      if (typeof participant.addConnectionEvent === 'function') {
        participant.addConnectionEvent('joined');
      }
      await participant.save();
    }

    // Update session status if first participant
    if (session.status === 'scheduled') {
      session.actualStartTime = new Date();
      session.status = 'in-progress';
      await session.save();
    }

    res.json({
      message: 'Successfully joined session',
      joinedAt: participant.joinedAt,
      meetingLink: session.meetingLink
    });

  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ message: 'Server error joining session' });
  }
});

// @route   POST /api/sessions/:sessionId/leave
// @desc    Record participant leaving the session
// @access  Private
router.post('/:sessionId/leave', auth, async (req, res) => {
  try {
    const session = await MeetingSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Meeting session not found' });
    }

    // Find participant record (try multiple field name variants)
    let participant = await SessionParticipant.findOne({
      $or: [
        { sessionId: session._id, participantId: req.user.id },
        { meeting_class_id: session.classId || session._id, participant_id: req.user.id },
        { userId: req.user.id, sessionId: session._id },
        { participant_id: req.user.id, meeting_class_id: session.classId || session._id }
      ]
    });

    if (!participant) {
      return res.status(404).json({ message: 'Participant record not found' });
    }

    // Record leave time
    participant.endedAt = participant.endedAt || new Date();
    if (typeof participant.addConnectionEvent === 'function') {
      participant.addConnectionEvent('left');
    }

    // Calculate participation duration using existing schema method (if present)
    if (typeof participant.calculateDuration === 'function') {
      participant.calculateDuration();
    } else if (participant.joinedAt && participant.endedAt) {
      const durationMs = participant.endedAt - participant.joinedAt;
      participant.duration = Math.max(1, Math.floor(durationMs / 60000));
    }

    // Attempt to call optional helper methods if they exist
    if (typeof participant.determineAttendanceStatus === 'function') {
      participant.determineAttendanceStatus(session, BILLING_CONFIG);
    }
    if (typeof participant.calculateBilling === 'function') {
      participant.calculateBilling(BILLING_CONFIG);
    }

    await participant.save();

    // Check if all participants have left
    const activeParticipants = await SessionParticipant.find({
      sessionId: session._id,
      leftAt: null
    });

    if (activeParticipants.length === 0 && session.status === 'in-progress') {
      session.actualEndTime = new Date();
      session.status = 'completed';
      session.calculateDuration();
      await session.save();
    }

    res.json({
      message: 'Successfully left session',
      leftAt: participant.leftAt,
      participationDuration: participant.participationDuration,
      attendanceStatus: participant.attendanceStatus
    });

  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ message: 'Server error leaving session' });
  }
});

// @route   POST /api/sessions/:sessionId/complete
// @desc    Mark session as completed and generate billing
// @access  Private (Admin/Tutor)
router.post('/:sessionId/complete', auth, async (req, res) => {
  try {
    const { tutorRating, studentRating, sessionNotes } = req.body;

    const session = await MeetingSession.findById(req.params.sessionId)
      .populate('tutorId', 'name email')
      .populate('studentId', 'name email parentId');

    if (!session) {
      return res.status(404).json({ message: 'Meeting session not found' });
    }

    if (session.status === 'completed') {
      return res.status(409).json({ message: 'Session already completed' });
    }

    // Update session
    session.actualEndTime = new Date();
    session.status = 'completed';
    session.tutorRating = tutorRating;
    session.studentRating = studentRating;
    session.sessionNotes = sessionNotes;
    session.calculateDuration();
    await session.save();

    // Get all participants
    const participants = await SessionParticipant.find({ sessionId: session._id })
      .populate('participantId', 'name email');

    // Process billing for each participant
    const billingTransactions = [];
    
    for (const participant of participants) {
      // If participant hasn't left yet, record it now
      if (!participant.leftAt && participant.joinedAt) {
        participant.leftAt = new Date();
        participant.calculateParticipationDuration();
      }
      
      participant.determineAttendanceStatus(session, BILLING_CONFIG);
      participant.calculateBilling(BILLING_CONFIG);
      await participant.save();

      // Create billing transaction for tutor charges
      if (participant.participantType === 'tutor' && participant.totalAmount > 0) {
        const parentId = session.studentId.parentId;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // 30 days to pay

        const billingTransaction = new BillingTransaction({
          sessionId: session._id,
          participantId: participant._id,
          transactionType: 'charge',
          amount: participant.totalAmount,
          billingPeriod: {
            startDate: session.scheduledStartTime,
            endDate: session.scheduledEndTime
          },
          hourlyRate: participant.rateAtTimeOfSession,
          billableMinutes: participant.billableMinutes,
          actualMinutes: participant.participationDuration,
          billedTo: {
            parentId: parentId,
            studentId: session.studentId._id,
            billingEmail: session.studentId.email,
            billingName: session.studentId.name
          },
          dueDate: dueDate,
          taxRate: BILLING_CONFIG.defaultTaxRate,
          platformFee: participant.totalAmount * BILLING_CONFIG.platformFeeRate,
          description: `Tutoring session: ${session.classId.subject} (Grade ${session.classId.grade})`,
          createdBy: req.user.id
        });

        billingTransaction.calculateTotalAmount();
        await billingTransaction.save();
        billingTransactions.push(billingTransaction);
      }
    }

    res.json({
      message: 'Session completed successfully',
      session,
      participants,
      billingTransactions,
      totalBillingAmount: billingTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
    });

  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ message: 'Server error completing session' });
  }
});

// @route   GET /api/sessions
// @desc    Get sessions with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      status, 
      startDate, 
      endDate, 
      tutorId, 
      studentId,
      classId,
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query.scheduledStartTime = {};
      if (startDate) query.scheduledStartTime.$gte = new Date(startDate);
      if (endDate) query.scheduledStartTime.$lte = new Date(endDate);
    }

    // Optional: filter by classId when provided (used by frontend to fetch session for a class)
    if (classId) {
      query.classId = classId;
    }

    // For non-admin users, we'll need to filter by class association
    // since sessions don't have direct tutor/student references
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      // This would require a more complex query to find sessions
      // where the user is either the tutor or student in the associated class
      // For now, let's allow all users to see all sessions (can be restricted later)
    }

    const sessions = await MeetingSession.find(query)
      .sort({ scheduledStartTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MeetingSession.countDocuments(query);

    res.json({
      sessions,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalSessions: total
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ message: 'Server error fetching sessions' });
  }
});

// @route   GET /api/sessions/test-no-auth
// @desc    Test endpoint without authentication
// @access  Public
router.get('/test-no-auth', async (req, res) => {
  console.log('🧪 NO AUTH: Test endpoint called');
  
  try {
    res.json({
      success: true,
      message: 'Test endpoint working without auth',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🧪 NO AUTH ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/sessions/parent-simple
// @desc    Simple working version for parent sessions
// @access  Private (Parent)
router.get('/parent-simple', auth(['parent']), async (req, res) => {
  console.log('🚀 SIMPLE: Parent endpoint called for user:', req.user.id);
  
  try {
    // Just return basic info first
    res.json({
      success: true,
      message: 'Simple endpoint working',
      data: {
        parentId: req.user.id,
        parentName: req.user.firstName + ' ' + req.user.lastName,
        timestamp: new Date().toISOString(),
        allSessions: [],
        todaySessions: [],
        upcomingSessions: [],
        totalSessions: 0
      }
    });
  } catch (error) {
    console.error('🚀 SIMPLE ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/sessions/parent
// @desc    Get all sessions for a parent's children
// @access  Private (Parent)
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    console.log('📋 Parent sessions endpoint called by user:', req.user.id);
    const parentId = req.user.id;

    // Step 1: Find the parent user
    const parent = await User.findById(parentId).select('assignments.children firstName lastName email').lean();
    console.log('👤 Parent found:', parent);

    if (!parent) {
      console.log('❌ Parent not found with ID:', parentId);
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Step 2: Get children IDs from parent's assignments
    const childrenIds = parent.assignments?.children || [];
    console.log('👨‍👩‍👧‍👦 Children IDs from parent assignments:', childrenIds);

    if (childrenIds.length === 0) {
      console.log('❌ No children assigned to parent:', parentId);
      return res.json({
        success: true,
        data: {
          allSessions: [],
          todaySessions: [],
          upcomingSessions: [],
          totalSessions: 0
        },
        message: 'No children assigned to this parent'
      });
    }

    // Step 3: Get children details
    const children = await User.find({
      _id: { $in: childrenIds },
      role: 'student'
    }).select('_id firstName lastName email').lean();

    console.log('👨‍👩‍👧‍👦 Children found:', children.length, children.map(c => ({ id: c._id, name: c.firstName + ' ' + c.lastName })));

    // Step 4: Find all sessions for these children
    const sessions = await MeetingSession.find({
      studentId: { $in: childrenIds }
    })
    .populate('classId', 'subject startTime endTime')
    .populate('tutorId', 'firstName lastName email')
    .populate('studentId', 'firstName lastName email')
    .sort({ scheduledStartTime: -1 })
    .lean();

    console.log('📊 Sessions found:', sessions.length);
    console.log('� Sample session data:', sessions.slice(0, 1));

    // Step 4: Filter sessions by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySessions = sessions.filter(session => {
      if (!session.scheduledStartTime) return false;
      const sessionDate = new Date(session.scheduledStartTime);
      return sessionDate >= today && sessionDate < tomorrow;
    });

    const upcomingSessions = sessions.filter(session => {
      if (!session.scheduledStartTime) return false;
      const sessionDate = new Date(session.scheduledStartTime);
      return sessionDate >= tomorrow;
    });

    console.log('📈 Today sessions:', todaySessions.length);
    console.log('🔮 Upcoming sessions:', upcomingSessions.length);

    res.json({
      success: true,
      data: {
        allSessions: sessions,
        todaySessions: todaySessions,
        upcomingSessions: upcomingSessions,
        totalSessions: sessions.length,
        debug: {
          parentId: parentId,
          childrenFound: children.length,
          childrenIds: childrenIds,
          sessionsFound: sessions.length
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

router.post('/end', auth, async (req, res) => {
  try {
    const { meeting_class_id, session_id, endedAt } = req.body;
    console.log('📩 Received session end payload:', { meeting_class_id, session_id, endedAt });

    if (!meeting_class_id) {
      return res.status(400).json({ success: false, error: 'meeting_class_id is required' });
    }

    if (!endedAt) {
      return res.status(400).json({ success: false, error: 'endedAt timestamp missing' });
    }

    // Try finding the participant record
    let participantRecord = null;

    if (session_id) {
      participantRecord = await SessionParticipant.findById(session_id);
    }

    if (!participantRecord) {
      participantRecord = await SessionParticipant.findOne({
        meeting_class_id,
        participant_id: req.user.id,
        endedAt: null
      });
    }

    if (!participantRecord) {
      console.log('❌ No matching active participant found');
      return res.status(404).json({ success: false, error: 'Active session not found for participant' });
    }

    // Prevent overwriting if already ended
    if (participantRecord.endedAt) {
      console.log('⚠️ Session already ended previously');
      return res.status(200).json({
        success: true,
        message: 'Session already ended earlier',
        data: participantRecord
      });
    }

    // Save end time
    participantRecord.endedAt = new Date(endedAt);

    // Calculate duration (in minutes)
    const durationMs = participantRecord.endedAt - participantRecord.joinedAt;
    participantRecord.duration = Math.max(1, Math.floor(durationMs / 60000));

    await participantRecord.save();

    console.log('✅ Session ended successfully:', {
      id: participantRecord._id,
      duration: participantRecord.duration,
      endedAt: participantRecord.endedAt
    });

    res.status(200).json({
      success: true,
      message: 'Session ended successfully',
      data: participantRecord
    });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
