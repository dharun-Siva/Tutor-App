// ...existing model requires...
const sequelize = require('../config/database/config');
const { DataTypes, Op } = require('sequelize');
const UserModel = require('../models/sequelize/user');
const ClassModel = require('../models/sequelize/Class');
const SessionParticipant = require('../models/sequelize/SessionParticipant')(sequelize, DataTypes);
const SubjectModel = require('../models/Subject.postgres')(sequelize, DataTypes);

// Set up associations AFTER initialization
if (typeof SessionParticipant.associations.classObj === 'undefined') {
  SessionParticipant.belongsTo(ClassModel, { foreignKey: 'meeting_class_id', as: 'classObj' });
  ClassModel.hasMany(SessionParticipant, { foreignKey: 'meeting_class_id', as: 'session_participants' });
}
// Ensure ClassModel belongsTo UserModel as 'tutor'
if (typeof ClassModel.associations.tutor === 'undefined') {
  ClassModel.belongsTo(UserModel, { as: 'tutor', foreignKey: 'tutorId' });
}
const auth = require('../middleware/auth-postgres');
const express = require('express');
const router = express.Router();

//const UserModel = require('../models/sequelize/User');
//const Class = require('../models/sequelize/Class');

//const sequelize = require('../config/database/config');
//const { DataTypes, Op } = require('sequelize');
//const SessionParticipant = require('../models/sequelize/SessionParticipant')(sequelize, DataTypes);

// Add association for participant details using correct User model reference
if (typeof SessionParticipant.associations.participant === 'undefined') {
  SessionParticipant.belongsTo(UserModel, { foreignKey: 'participant_id', as: 'participant' });
}


console.log('SessionParticipants routes loaded');

// Helper function to extract currency from user profile
const getCurrencyFromUserProfile = (user, participant_type, fallbackCurrency = 'USD') => {
  let currency = null;
  let profile = null;
  
  if (!user) {
    console.log('🔍 [CURRENCY] User is null, returning fallback:', fallbackCurrency);
    return fallbackCurrency;
  }
  
  // Handle Sequelize instances - get the actual values
  const userData = user.dataValues || user;
  
  if (participant_type === 'tutor') {
    profile = userData.tutor_profile;
  } else if (participant_type === 'student') {
    profile = userData.student_profile;
  }
  
  // Handle case where profile is a JSON string
  if (typeof profile === 'string') {
    try {
      profile = JSON.parse(profile);
      console.log('🔍 [CURRENCY] Parsed profile from JSON string');
    } catch (e) {
      console.error('🔍 [CURRENCY] Failed to parse profile JSON string:', e.message);
      return fallbackCurrency;
    }
  }
  
  // Extract currency from profile
  currency = profile?.currency;
  
  console.log(`🔍 [CURRENCY] Extracted for ${participant_type}:`, {
    profile_type: typeof profile,
    currency_value: currency,
    currency_type: typeof currency,
    fallback: fallbackCurrency,
    final_currency: currency || fallbackCurrency,
    profile_keys: profile ? Object.keys(profile).slice(0, 10) : null
  });
  
  // Fallback to provided fallback currency (class currency or USD)
  return currency || fallbackCurrency;
};

// ...existing code...

// Sequelize-based: Join a session - create or update participation record
router.post('/pg/join', auth(['tutor', 'student']), async (req, res) => {
  try {
  const { meeting_class_id } = req.body;
  const participant_id = req.user.id;
  console.log('🔗 [JOIN] Received meeting_class_id:', meeting_class_id);
  console.log('🔗 [JOIN] Received participant_id:', participant_id);
    const participant_type = req.user.role;

    if (!meeting_class_id) {
      return res.status(400).json({ success: false, error: 'meeting_class_id is required' });
    }

    // Check for existing entry for this meeting (regardless of date) to support rejoin scenario
    const existingEntry = await SessionParticipant.findOne({
      where: {
        participant_id,
        meeting_class_id
      },
      order: [['created_at', 'DESC']]  // Get the most recent record
    });

    // If entry exists, clear ended_at (they're rejoining) and update joined_at to now
    if (existingEntry) {
      console.log('🔗 [JOIN] Found existing entry - Rejoin scenario. Entry ID:', existingEntry.id);
      // Generate new Agora UID for rejoin
      const agoraUid = Math.floor(Math.random() * 10000);
      existingEntry.ended_at = null;  // Clear the ended_at to show session is active again
      existingEntry.joined_at = new Date();  // Update joined_at to current time
      existingEntry.status = 'active';
      existingEntry.agoraUid = agoraUid;  // Store the generated Agora UID
      await existingEntry.save();
      console.log('🔗 [JOIN] Updated existing entry - ended_at cleared, session marked active');
      console.log('🔗 [JOIN] Generated new Agora UID for rejoin:', agoraUid);
      return res.status(200).json({ success: true, message: 'Session rejoined successfully', data: existingEntry, sessionParticipantId: existingEntry.id, isExisting: true, isRejoin: true });
    }

    // Fetch class details to get duration and other info
    const classDetails = await ClassModel.findByPk(meeting_class_id);
    if (!classDetails) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    // Get duration in minutes (use customDuration if available, otherwise use default duration)
    const durationInMinutes = classDetails.customDuration || classDetails.duration || 0;
    
    // Initialize billing calculation data
    let billingAmount = 0;
    let totalPayable = 0;
    let userCurrency = 'USD'; // default currency

    // Fetch user data for billing and currency
    const user = await UserModel.findByPk(participant_id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log(`🔗 [JOIN] User data fetched:`, JSON.stringify(user.dataValues, null, 2));

    // Extract currency from user profile (tutor_profile or student_profile)
    userCurrency = getCurrencyFromUserProfile(user, participant_type, classDetails.currency || 'USD');
    console.log(`🔗 [JOIN] Extracted currency from user profile: ${userCurrency}`);

    // If participant is a tutor, calculate total_payable based on hourly rate
    if (participant_type === 'tutor') {
      // Extract hourly rate from tutor_profile.hourlyRate, with fallback to hourlyRate field
      const userData = user.dataValues || user;
      let hourlyRate = userData.tutor_profile?.hourlyRate || userData.hourlyRate || 0;
      
      // Convert to number if it's a string
      hourlyRate = Number(hourlyRate) || 0;
      
      console.log(`🔗 [JOIN] Extracted hourly rate: ${hourlyRate}, type: ${typeof hourlyRate}`);
      console.log(`🔗 [JOIN] Duration: ${durationInMinutes} min`);
      
      // Calculate billing amount: (duration in minutes / 60) * hourlyRate
      billingAmount = (durationInMinutes / 60) * hourlyRate;
      totalPayable = billingAmount; // Initially, total_payable equals billing_amount (no discounts/taxes applied yet)

      console.log(`🔗 [JOIN] Tutor ${participant_id} - Calculation: (${durationInMinutes}/60) * ${hourlyRate} = ${billingAmount}, totalPayable: ${totalPayable}`);
    }

    // Create new session participation record with calculated values
    // Generate random Agora UID
    const agoraUid = Math.floor(Math.random() * 10000);
    
    console.log(`🔗 [JOIN] About to create SessionParticipant with:`);
    console.log(`  - participant_id: ${participant_id}`);
    console.log(`  - meeting_class_id: ${meeting_class_id}`);
    console.log(`  - participant_type: ${participant_type}`);
    console.log(`  - agoraUid: ${agoraUid}`);
    console.log(`  - durationInMinutes: ${durationInMinutes}`);
    console.log(`  - billingAmount: ${billingAmount}`);
    console.log(`  - totalPayable: ${totalPayable}`);
    
    const now = new Date();
    const newParticipant = await SessionParticipant.create({
      participant_id,
      meeting_class_id,
      participant_type,
      agoraUid,
      joined_at: now,
      status: 'active',
      center: classDetails.centerId || classDetails.center,
      title: classDetails.title,
      start_time: classDetails.startTime,
      duration: durationInMinutes,
      billing_amount: billingAmount,
      discount_amount: 0,
      tax_amount: 0,
      total_payable: totalPayable,
      payment_status: 'Pending',
      classes_paymentType: classDetails.paymentStatus || 'unpaid',
      currency: userCurrency
    });
    
    console.log(`🔗 [JOIN] Created SessionParticipant - ID: ${newParticipant.id}`);
    console.log(`🔗 [JOIN] Generated Agora UID: ${agoraUid}`);
    console.log(`🔗 [JOIN] Stored Agora UID in DB: ${newParticipant.agoraUid}`);
    console.log(`🔗 [JOIN] Raw database values:`, JSON.stringify(newParticipant.dataValues, null, 2));
    console.log(`🔗 [JOIN] Retrieved billing_amount: ${newParticipant.billing_amount} (type: ${typeof newParticipant.billing_amount})`);
    console.log(`🔗 [JOIN] Retrieved total_payable: ${newParticipant.total_payable} (type: ${typeof newParticipant.total_payable})`);
    
    return res.status(200).json({ success: true, message: 'Participant joined successfully', data: newParticipant, sessionParticipantId: newParticipant.id, id: newParticipant.id });
  } catch (error) {
    console.error('❌ Error saving participant:', error);
    res.status(500).json({ success: false, error: 'Failed to save participant', details: error.message });
  }
});

// Sequelize-based: End a session - update participation record with end time and duration
router.post('/pg/end', auth(['tutor', 'student']), async (req, res) => {
  try {
    const { meeting_class_id, sessionParticipantId, endedAt } = req.body;
    const participant_id = req.user.id;
    if (!meeting_class_id || !sessionParticipantId) {
      return res.status(400).json({ success: false, error: 'meeting_class_id and sessionParticipantId are required' });
    }
    const sessionEntry = await SessionParticipant.findOne({
      where: { id: sessionParticipantId, participant_id, meeting_class_id, ended_at: null }
    });
    if (!sessionEntry) {
      return res.status(404).json({ success: false, error: 'No active session found' });
    }
    
    sessionEntry.ended_at = endedAt ? new Date(endedAt) : new Date();
    
    // Calculate actual duration in minutes from joined_at to ended_at
    const actualDurationMs = sessionEntry.ended_at.getTime() - sessionEntry.joined_at.getTime();
    const actualDurationMinutes = Math.floor(actualDurationMs / 60000);
    sessionEntry.duration = actualDurationMinutes;
    
    // Fetch user to get current currency and hourly rate
    const user = await UserModel.findByPk(participant_id);
    if (user) {
      // Update currency from user profile
      sessionEntry.currency = getCurrencyFromUserProfile(user, sessionEntry.participant_type, sessionEntry.currency || 'USD');
      console.log(`📊 [END] Updated currency: ${sessionEntry.currency}`);
    }
    
    // Recalculate billing_amount and total_payable based on actual duration for tutors
    if (sessionEntry.participant_type === 'tutor') {
      if (user) {
        const userData = user.dataValues || user;
        const hourlyRate = userData.tutor_profile?.hourlyRate || userData.hourlyRate || 0;
        // Recalculate: (actual duration in minutes / 60) * hourlyRate
        sessionEntry.billing_amount = (actualDurationMinutes / 60) * hourlyRate;
        // Recalculate total_payable: billing_amount - discount_amount + tax_amount
        sessionEntry.total_payable = sessionEntry.billing_amount - (sessionEntry.discount_amount || 0) + (sessionEntry.tax_amount || 0);
        
        console.log(`📊 [END] Tutor ${participant_id} - Actual Duration: ${actualDurationMinutes} min, Hourly Rate: ${hourlyRate}, New Billing: ${sessionEntry.billing_amount}, Total Payable: ${sessionEntry.total_payable}`);
      }
    }
    
    sessionEntry.status = 'ended';
    await sessionEntry.save();
    res.status(200).json({ success: true, message: 'Session ended successfully', data: sessionEntry });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({ success: false, error: 'Failed to end session', details: error.message });
  }
});
// Get latest sessionParticipantId for a user and class
// Alias route for frontend typo (missing hyphen)
router.get('/latest', auth(['tutor', 'student', 'admin']), async (req, res) => {
  // ...existing code...
});
router.get('/api/sessionparticipants/latest', auth(['tutor', 'student', 'admin']), async (req, res) => {
  // Call the same logic as /latest
  const { userId, meeting_class_id } = req.query;
  if (!userId || !meeting_class_id) {
    return res.status(400).json({ success: false, error: 'userId and meeting_class_id are required' });
  }
  try {
    const entry = await SessionParticipant.findOne({
      where: {
        participant_id: userId,
        meeting_class_id
      },
      order: [['joined_at', 'DESC']]
    });
    if (!entry) {
      return res.status(404).json({ success: false, error: 'No session participant found' });
    }
    return res.status(200).json({ success: true, sessionParticipantId: entry.id, id: entry.id });
  } catch (error) {
    console.error('❌ Error fetching latest sessionParticipantId:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessionParticipantId', details: error.message });
  }

  try {
    const { userId, meeting_class_id } = req.query;
    if (!userId || !meeting_class_id) {
      return res.status(400).json({ success: false, error: 'userId and meeting_class_id are required' });
    }
    const entry = await SessionParticipant.findOne({
      where: {
        participant_id: userId,
        meeting_class_id
      },
      order: [['joined_at', 'DESC']]
    });
    if (!entry) {
      return res.status(404).json({ success: false, error: 'No session participant found' });
    }
    return res.status(200).json({ success: true, sessionParticipantId: entry.id, id: entry.id });
  } catch (error) {
    console.error('❌ Error fetching latest sessionParticipantId:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessionParticipantId', details: error.message });
  }
});
// ...existing code...
// Get all session participants (admin access)
// @route   GET /api/sessions-participants/history
// @desc    Get all session participants (admin only)
// @access  Private (Admin)
// Unified session participants history route
// @route   GET /api/sessions-participants/history
// @desc    Get session participants (all for admin/superadmin, filtered for others)
// @access  Private
router.get('/history', auth(['tutor', 'student', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    // Build filter for center-based access
    const filter = {};
    
    // For admin users, filter by center (only show participants from their center)
      if (req.user.role === 'admin') {
        const adminCenter = req.user.center_id || req.user.assignments?.center;
        if (adminCenter) {
          filter.center = adminCenter;
          console.log('🔍 [ADMIN FILTER] Filter for admin center:', JSON.stringify(filter));
        } else {
          // Admin has no center assigned
          console.log('🔍 [ADMIN FILTER] Admin has no center assigned');
          return res.status(200).json({
            success: true,
            data: [],
            count: 0
          });
        }
      }
    
    // For tutor users, only show their own session participations as tutor
    if (req.user.role === 'tutor') {
      filter.participant_id = req.user.id;
      filter.participant_type = 'tutor';
      console.log('🔍 [TUTOR FILTER] Filter:', JSON.stringify(filter));
      console.log('🔍 [TUTOR FILTER] User ID:', req.user.id);
    }
    
    // For student users, only show their own session participations as student
    if (req.user.role === 'student') {
      filter.participant_id = req.user.id;
      filter.participant_type = 'student';
    }
    
      let participants;
      const ClassModel = require('../models/sequelize/Class');
      console.log('🔍 [QUERY] Executing findAll with filter:', JSON.stringify(filter));
      participants = await SessionParticipant.findAll({
        where: filter,
        order: [['joined_at', 'DESC']],
        limit: parseInt(limit),
        include: [
          {
            model: UserModel,
            as: 'participant',
            attributes: ['id', 'firstName', 'lastName', 'email', 'role']
          },
          {
            model: ClassModel,
            as: 'classObj',
            attributes: ['id', 'title', 'subject', 'startTime', 'duration', 'amount', 'currency', 'paymentStatus', 'scheduleType'],
            include: [
              {
                model: UserModel,
                as: 'tutor',
                attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'tutor_profile']
              }
            ]
          }
        ]
      });
      // Debug log to inspect raw joined data
      console.log('DEBUG participants raw:', JSON.stringify(participants, null, 2));
      console.log('🔍 [DEBUG] Participants count:', participants.length);
      console.log('🔍 [DEBUG] User role:', req.user.role);

    // Attach durationMinutes and paymentStatus from classbillingtransactions (Sequelize)
    const ClassBillingTransaction = require('../models/sequelize/ClassBillingTransaction')(sequelize, DataTypes);
    async function attachBillingInfoToParticipantsSequelize(participants) {
      const pairs = participants.map(p => ({
        class_id: p.meeting_class_id,
        tutor_id: p.tutor_id || p.participant_id
      }));
      const uniquePairs = Array.from(new Set(pairs.map(JSON.stringify))).map(JSON.parse);
      const transactions = await ClassBillingTransaction.findAll({
        where: {
          [Op.or]: uniquePairs.map(pair => ({ class_id: pair.class_id, tutor_id: pair.tutor_id }))
        },
        attributes: ['id', 'class_id', 'tutor_id', 'duration_minutes', 'status', 'amount', 'currency']
      });
      const lookup = {};
      console.log('🔍 [BILLING] Total transactions found:', transactions.length);
      transactions.forEach((tx, idx) => {
        console.log(`🔍 [BILLING] Transaction ${idx}: class_id=${tx.class_id}, tutor_id=${tx.tutor_id}, amount=${tx.amount}, status=${tx.status}, currency=${tx.currency}`);
        lookup[`${tx.class_id}_${tx.tutor_id}`] = {
          transactionId: tx.id,
          durationMinutes: tx.duration_minutes,
          status: tx.status,
          paymentAmount: tx.amount,
          currency: tx.currency
        };
      });
      console.log('🔍 [BILLING] Lookup keys created:', Object.keys(lookup));
      return participants.map((p, idx) => {
        const class_id = p.meeting_class_id;
        const tutor_id = p.tutor_id || p.participant_id;
        const key = `${class_id}_${tutor_id}`;
        const billing = lookup[key] || {};
        console.log(`🔍 [PARTICIPANT] ${idx}: class_id=${class_id}, tutor_id=${tutor_id}, key=${key}, billing found=${!!lookup[key]}, billing=${JSON.stringify(billing)}`);
        // Debug log participant object
        console.log('DEBUG participant:', p.participant);
        let student = {
          firstName: '',
          lastName: '',
          email: '',
          id: ''
        };
        if (p.participant && p.participant.dataValues) {
          student = {
            firstName: p.participant.dataValues.firstName || '',
            lastName: p.participant.dataValues.last_name || p.participant.dataValues.lastName || '',
            email: p.participant.dataValues.email || '',
            id: p.participant.dataValues.id || ''
          };
        }
        // Separate concerns:
        // paymentType: The original class payment type (immutable - from Classes table)
        // paymentStatus: The transaction payment status (mutable - from SessionParticipant or ClassBillingTransaction)
        const classPaymentType = p.classObj && p.classObj.paymentStatus ? p.classObj.paymentStatus : null;
        const transactionPaymentStatus = p.payment_status || billing.status || null;
        
        return { 
          ...p.dataValues, 
          id: p.id || p.dataValues.id, // Ensure id is preserved
          _id: p.id || p.dataValues.id, // Also provide _id for compatibility
          paymentType: classPaymentType ?? null, // Original class payment type (demo class, unpaid, paid)
          paymentStatus: transactionPaymentStatus ?? null, // Transaction status (can change when marked paid/void)
          transactionId: billing.transactionId ?? null, 
          durationMinutes: billing.durationMinutes ?? null, 
          paymentAmount: billing.paymentAmount ?? null, 
          currency: billing.currency ?? null, 
          student 
        };
      });
    }
    const participantsWithBilling = await attachBillingInfoToParticipantsSequelize(participants);
      
      // Fetch subject details for all subjects in classObj
      const subjectIds = [...new Set(participantsWithBilling
        .map(p => p.classObj?.subject)
        .filter(s => s))];
      console.log('🔍 [SUBJECTS] Extracted subject IDs:', subjectIds);
      let subjectMap = {};
      if (subjectIds.length > 0) {
        const Subject = require('../models/sequelize/Subject');
        console.log('🔍 [SUBJECTS] Subject model loaded');
        const subjects = await Subject.findAll({
          where: { id: subjectIds },
          attributes: ['id', 'subjectCode', 'subjectName']
        });
        console.log('🔍 [SUBJECTS] Found subjects:', subjects.map(s => ({ id: s.id, name: s.subjectName })));
        subjects.forEach(s => {
          subjectMap[s.id] = s;
        });
      } else {
        // Debug: if no subject IDs found, check all subjects in DB
        console.log('🔍 [SUBJECTS] No subject IDs extracted. Checking all subjects in DB...');
        try {
          const Subject = require('../models/sequelize/Subject');
          const allSubjects = await Subject.findAll({ attributes: ['id', 'subjectCode', 'subjectName'], limit: 5 });
          console.log('🔍 [SUBJECTS] All subjects in DB (sample):', allSubjects.map(s => ({ id: s.id, name: s.subjectName })));
        } catch (e) {
          console.error('🔍 [SUBJECTS] Error fetching all subjects:', e.message);
        }
      }
      console.log('🔍 [SUBJECTS] Subject map created:', Object.keys(subjectMap).length, 'subjects');
      
      // Add tutorName field to each participant
      let formatted = participantsWithBilling.map((p, idx) => {
        // Ensure classObj is a plain object
        let classObjData = p.classObj;
        if (p.classObj && typeof p.classObj.toJSON === 'function') {
          classObjData = p.classObj.toJSON();
        }
        
        // Fallback amount: use billing amount, then classObj.amount, then 0
        const finalAmount = p.paymentAmount !== null && p.paymentAmount !== undefined 
          ? p.paymentAmount 
          : (classObjData && classObjData.amount !== null && classObjData.amount !== undefined
              ? classObjData.amount 
              : 0);
        
        // Get currency from tutor's profile (tutor_profile.currency), fall back to class/billing currency
        let finalCurrency = 'USD';
        if (classObjData && classObjData.tutor) {
          finalCurrency = getCurrencyFromUserProfile(classObjData.tutor, 'tutor', classObjData.currency || 'USD');
        } else {
          finalCurrency = p.currency || (classObjData && classObjData.currency) || 'USD';
        }
        
        // Attach subject details to classObj
        if (classObjData && classObjData.subject && subjectMap[classObjData.subject]) {
          console.log(`🔍 [SUBJECT ATTACH] Participant ${idx}: Found subject ${classObjData.subject} -> ${subjectMap[classObjData.subject].subjectName}`);
          classObjData.subjectName = subjectMap[classObjData.subject].subjectName;
          classObjData.subjectCode = subjectMap[classObjData.subject].subjectCode;
        } else {
          console.log(`🔍 [SUBJECT ATTACH] Participant ${idx}: Subject NOT found for ${classObjData?.subject}`);
        }
        
        return {
          ...p,
          classObj: classObjData,
          paymentAmount: finalAmount,
          currency: finalCurrency,
          tutorName: classObjData && classObjData.tutor
            ? `${classObjData.tutor.firstName || classObjData.tutor.first_name || ''} ${classObjData.tutor.lastName || classObjData.tutor.last_name || ''}`.trim()
            : 'N/A'
        };
      });
      
      // Attach tutor profile data (including hourlyRate) to each participant's classObj.tutor
      formatted = formatted.map((p, idx) => {
        if (p.classObj && p.classObj.tutor && p.classObj.tutor.id) {
          const tutorId = p.classObj.tutor.id;
          // Fetch tutor profile from User table
          const tutorUser = participants.find(sp => sp.classObj?.tutor?.id === tutorId)?.classObj?.tutor;
          if (tutorUser) {
            // Attach tutorProfile with hourlyRate
            p.classObj.tutor.tutorProfile = tutorUser.tutor_profile || {};
            // Also attach tutor_profile for backward compatibility
            p.classObj.tutor.tutor_profile = tutorUser.tutor_profile || {};
          }
        }
        return p;
      });
      
      // If tutor user, filter to show only classes where they are the instructor
      if (req.user.role === 'tutor') {
        formatted = formatted.filter(p => 
          p.classObj && p.classObj.tutor && p.classObj.tutor.id === req.user.id
        );
        console.log(`✅ [TUTOR] Filtered to ${formatted.length} classes where tutor is instructor`);
      }
      
      res.status(200).json({
        success: true,
        data: formatted,
        count: formatted.length
      });
  } catch (error) {
    console.error('❌ Error fetching all session participants (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session participants',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Get all session participants for a parent's children
// @route   GET /api/session-participants/parent
// @desc    Get all session participants for a parent's children ONLY
// @access  Private (Parent)
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    const parentId = req.user.id;
    console.log('📋 Fetching session participants for parent:', parentId);
    
    // Find all students with their full student_profile to check parent_id
    const students = await UserModel.findAll({
      where: { role: 'student' },
      attributes: ['id', 'student_profile'],
      raw: false  // Don't use raw, we need the full object
    });
    
    console.log('📋 Total students found:', students.length);
    
    // Filter students whose parent_id matches current parent
    const childrenIds = [];
    for (const student of students) {
      let studentProfile = student.student_profile;
      let parentIdInProfile = null;
      
      console.log(`  Student ${student.id} profile type:`, typeof studentProfile, 'value:', studentProfile);
      
      // Handle both JSON string and object formats
      if (typeof studentProfile === 'string') {
        try {
          const parsed = JSON.parse(studentProfile);
          parentIdInProfile = parsed.parent_id || parsed.parentId;
        } catch (e) {
          console.error(`    Parse error for student ${student.id}:`, e.message);
          parentIdInProfile = null;
        }
      } else if (typeof studentProfile === 'object' && studentProfile) {
        parentIdInProfile = studentProfile.parent_id || studentProfile.parentId;
      }
      
      console.log(`  Student ${student.id} parent_id in profile:`, parentIdInProfile);
      
      if (parentIdInProfile && parentIdInProfile.toString() === parentId.toString()) {
        childrenIds.push(student.id);
        console.log(`  ✅ Matched! Added student ${student.id}`);
      }
    }
    
    console.log('📋 Children IDs found:', childrenIds);
    
    if (!childrenIds.length) {
      console.log('⚠️ No children found for parent');
      return res.json({ success: true, data: [] });
    }

    // Find all session participants for these children (Sequelize)
    const sessionParticipants = await SessionParticipant.findAll({
      where: {
        participant_id: childrenIds,
        participant_type: 'student'
      },
      include: [
        {
          model: UserModel,
          as: 'participant',
          attributes: ['firstName', 'lastName', 'email']
        },
        {
          model: ClassModel,
          as: 'classObj',
          attributes: ['id', 'title', 'subject', 'tutorId', 'startTime', 'duration'],
          include: [
            {
              model: UserModel,
              as: 'tutor',
              attributes: ['id', 'firstName', 'lastName', 'email']
            }
          ]
        }
      ],
      attributes: [
        'id', 
        'participant_id', 
        'meeting_class_id',
        'joined_at',
        'ended_at',
        'status',
        'title',
        'start_time',
        'duration',
        'currency'
      ]
    });
    console.log('📋 Session participants found:', sessionParticipants.length);

    // Get unique subject IDs to fetch subject names
    const subjectIds = [...new Set(
      sessionParticipants
        .map(sp => sp.classObj?.subject)
        .filter(Boolean)
    )];
    
    // Fetch subject details if there are any subject IDs
    let subjectMap = {};
    if (subjectIds.length > 0) {
      try {
        const subjects = await SubjectModel.findAll({
          where: { id: subjectIds },
          attributes: ['id', 'subjectName', 'subjectCode']
        });
        subjects.forEach(s => {
          subjectMap[s.id] = s.subjectName || s.subjectCode || s.id;
        });
        console.log('Subject map created:', subjectMap);
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    }
    
    // Transform the data for frontend consumption
    const sessionParticipantsWithTutor = sessionParticipants.map(sp => {
      const spData = sp.toJSON ? sp.toJSON() : sp;
      const participant = spData.participant || {};
      const classObj = spData.classObj || {};
      const tutor = classObj.tutor || {};
      
      // Calculate duration in minutes
      let durationInMinutes = '-';
      if (spData.ended_at && spData.joined_at) {
        const startTime = new Date(spData.joined_at);
        const endTime = new Date(spData.ended_at);
        if (startTime.getTime() && endTime.getTime()) {  // Check if dates are valid
          durationInMinutes = Math.round((endTime - startTime) / (1000 * 60)); // Convert ms to minutes
        }
      } else if (spData.duration) {
        durationInMinutes = parseInt(spData.duration);
      } else if (classObj.duration) {
        durationInMinutes = parseInt(classObj.duration);
      }
      
      // Format dates, ensuring they're valid
      const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return (date instanceof Date && !isNaN(date.getTime())) ? date.toLocaleString() : '-';
      };
      
      const formatDateOnly = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return (date instanceof Date && !isNaN(date.getTime())) ? date.toLocaleDateString() : '-';
      };
      
      const formatTimeOnly = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return (date instanceof Date && !isNaN(date.getTime())) ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
      };
      
      // Get subject name from map or use the ID
      const subjectName = classObj.subject ? (subjectMap[classObj.subject] || classObj.subject) : '-';
      
      // Use joined_at or start_time for date/time display - prefer joined_at since it has data
      const sessionTimestamp = spData.joined_at || spData.start_time || classObj.startTime;
      
      console.log('Debug - Session timestamp:', {
        joined_at: spData.joined_at,
        start_time: spData.start_time,
        classObjStartTime: classObj.startTime,
        sessionTimestamp,
        formatted: formatDateOnly(sessionTimestamp)
      });
      
      return {
        childName: `${participant.firstName || ''} ${participant.lastName || ''}`.trim() || '-',
        sessionTitle: classObj.title || spData.title || '-',
        subject: subjectName,
        tutor: `${tutor.firstName || ''} ${tutor.lastName || ''}`.trim() || '-',
        date: formatDateOnly(sessionTimestamp),
        startTime: formatTimeOnly(sessionTimestamp),
        joinedAt: formatDate(spData.joined_at),
        endedAt: formatDate(spData.ended_at),
        duration: durationInMinutes === '-' ? '-' : durationInMinutes + ' min',
        currency: spData.currency || 'USD',
        status: spData.status || '-'
      };
    });

    return res.json({ success: true, data: sessionParticipantsWithTutor });
  } catch (err) {
    console.error('Error fetching session participants for parent:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Join a session - create or update participation record
router.post('/join', auth(['tutor', 'student']), async (req, res) => {
  try {
    // Accept meeting_class_id from body, but also tolerate alternative sources (classId query/body or Referer)
    let meeting_class_id = req.body.meeting_class_id;
    // Fallback: support client sending `classId` (MeetingPage uses classId query param)
    if (!meeting_class_id && req.body.classId) meeting_class_id = req.body.classId;
    // Fallback: support query param (in case client posts without body but includes classId in URL)
    if (!meeting_class_id && req.query && req.query.classId) meeting_class_id = req.query.classId;
    // Fallback: try to parse referer header for a classId query param (useful when join is triggered from /meeting page)
    if (!meeting_class_id && req.get('referer')) {
      try {
        const refererUrl = new URL(req.get('referer'));
        const classIdFromReferer = refererUrl.searchParams.get('classId');
        if (classIdFromReferer) {
          meeting_class_id = classIdFromReferer;
          console.log('🔍 [FALLBACK] Extracted classId from Referer header:', meeting_class_id);
        }
      } catch (e) {
        // ignore URL parse errors
      }
    }
    const participant_id = req.user.id;
    //const participant_id = req.user.id;
    const participant_type = req.user.role;

    console.log('📝 Session join request:', { 
      participant_id, 
      meeting_class_id, 
      participant_type 
    });

    // Validate required fields
    if (!meeting_class_id) {
      return res.status(400).json({
        success: false,
        error: 'meeting_class_id is required'
      });
    }


    // Validate that the class exists - try multiple lookup strategies
    console.log('🔍 Looking up class with meeting_class_id:', meeting_class_id);
    
    let classExists = null;
    
    // Strategy 1: Try direct ID lookup by primary key (works for numeric or string PKs)
    try {
      console.log('🔍 Strategy 1: Trying direct ID lookup by primary key');
      classExists = await ClassModel.findByPk(meeting_class_id);
    } catch (err) {
      console.error('🔍 Strategy 1 error during findByPk:', err && err.message ? err.message : err);
    }
    
    // Strategy 2: Try meetingId field lookup (if it's a URL identifier like 'class-xyz')
    if (!classExists) {
      console.log('🔍 Strategy 2: Trying meetingId field lookup for URL identifier');
      classExists = await ClassModel.findOne({
        where: { meetingId: meeting_class_id }
      });
    }
    
    // Strategy 3: Try without prefix (remove 'class-' or 'session-')
    if (!classExists && meeting_class_id.includes('-')) {
      const cleanId = meeting_class_id.replace(/^(class-|session-)/, '');
      console.log('🔍 Strategy 3: Trying with cleaned ID:', cleanId);
      classExists = await ClassModel.findOne({
        where: { meetingId: cleanId }
      }) || await ClassModel.findByPk(cleanId);
    }
    
    console.log('🔍 Class lookup result:', classExists ? `Found class with ID ${classExists.id}` : 'Not found');
    
    if (!classExists) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // For tutors, optionally validate they are assigned to the class (but allow if not strictly assigned)
    // if (participant_type === 'tutor') {
    //   // Allow tutors to join even if not strictly assigned (for flexibility)
    //   // Just log if they're not the assigned tutor
    //   if (!classExists.tutor || classExists.tutor.toString() !== participant_id) {
    //     console.log('⚠️ Tutor joining class they are not assigned to as primary tutor');
    //   }
    // }

    console.log('📦 Saving participant data:', {
  title: classExists.title,
  startTime: classExists.startTime
});

    // Check for existing entry for this meeting (regardless of date) to support rejoin scenario
    const existingEntry = await SessionParticipant.findOne({
      where: {
        participant_id,
        meeting_class_id: classExists.id // Use the actual database ID for duplicate check
      },
      order: [['created_at', 'DESC']]  // Get the most recent record
    });

    // If entry exists, clear ended_at (they're rejoining) and update joined_at to now
    if (existingEntry) {
      console.log('✅ Found existing entry - Rejoin scenario. Entry ID:', existingEntry.id);
      // Generate new Agora UID for rejoin
      const agoraUid = Math.floor(Math.random() * 10000);
      existingEntry.ended_at = null;  // Clear the ended_at to show session is active again
      existingEntry.joined_at = new Date();  // Update joined_at to current time
      existingEntry.agoraUid = agoraUid;  // Store the generated Agora UID
      existingEntry.status = 'active';
      await existingEntry.save();
      console.log('✅ Updated existing entry - ended_at cleared, session marked active');
      console.log('✅ Generated new Agora UID for rejoin:', agoraUid);
      console.log('✅ Stored Agora UID in DB:', existingEntry.agoraUid);
      console.log('💾 Store this existingEntry.id in localStorage:', existingEntry.id);
      return res.status(200).json({
        success: true,
        message: 'Session rejoined successfully',
        data: existingEntry,
        sessionParticipantId: existingEntry.id, // Include the ID explicitly for easy access
        isExisting: true,
        isRejoin: true
      });
    }

    // Get user billing rate for calculations
    const user = await UserModel.findByPk(participant_id);
    
    let billingAmount = 0;
    let totalPayable = 0;
    let userCurrency = 'USD'; // default currency
    
    // Extract currency from user profile (tutor_profile or student_profile)
    userCurrency = getCurrencyFromUserProfile(user, participant_type, classExists.currency || 'USD');
    console.log(`🔗 [/join] Extracted currency from user profile: ${userCurrency}`);
    
    // If participant is a tutor, calculate total_payable based on hourly rate
    if (participant_type === 'tutor') {
      // Extract hourly rate from tutor_profile.hourlyRate (using tutor_profile, not tutorProfile)
      const userData = user.dataValues || user;
      let hourlyRate = userData.tutor_profile?.hourlyRate || userData.hourlyRate || 0;
      // Calculate billing amount: (duration in minutes / 60) * hourlyRate
      billingAmount = (classExists.duration / 60) * Number(hourlyRate);
      totalPayable = billingAmount; // Initially equals billing_amount
      console.log(`🔗 [/join] Tutor ${participant_id} - Hourly Rate: ${hourlyRate}, Duration: ${classExists.duration} min, Billing: ${billingAmount}, Total Payable: ${totalPayable}`);
    }

    // Create new session participation record using the actual database ID
    console.log('📝 Creating session participant with database class ID:', classExists.id);
    
    // Determine payment_status based on class paymentStatus
    let paymentStatus = 'unpaid'; // default
    if (classExists.paymentStatus === 'paid') {
      paymentStatus = 'paid';
    } else if (classExists.paymentStatus === 'democlass') {
      paymentStatus = 'unpaid'; // demo classes are unpaid (no payment)
    }
    
    // Generate random Agora UID
    const agoraUid = Math.floor(Math.random() * 10000);
    console.log('💾 About to create SessionParticipant with currency:', userCurrency);
    console.log('💾 Generated Agora UID:', agoraUid);
    
    const newParticipant = await SessionParticipant.create({
      participant_id,
      meeting_class_id: classExists.id, // Use the actual database ID, not the URL identifier
      center: classExists.centerId, // Use centerId from Class model
      participant_type,
      agoraUid,
      joined_at: new Date(),
      billing_amount: billingAmount,
      discount_amount: 0,
      tax_amount: 0,
      total_payable: totalPayable,
      currency: userCurrency,
      payment_status: paymentStatus,
      classes_paymentType: classExists.paymentStatus,
      title: classExists.title,
      start_time: classExists.startTime,
      duration: classExists.duration,
    });

    console.log("✅ Participant saved successfully:", {
      id: newParticipant.id,
      participant_type: newParticipant.participant_type,
      currency: newParticipant.currency,
      currency_from_dataValues: newParticipant.dataValues?.currency,
      agoraUid: newParticipant.agoraUid,
      agoraUid_from_dataValues: newParticipant.dataValues?.agoraUid
    });
    res.status(200).json({
      success: true,
      message: "Participant joined successfully",
      data: newParticipant,
      sessionParticipantId: newParticipant.id
    });

    //const savedParticipant = await newParticipant.save();

  } catch (error) {
    console.error('❌ Error joining session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



// End a session - update participation record with end time and duration
router.post('/end', auth(['tutor', 'student']), async (req, res) => {
  try {
    // Accept multiple possible field names from clients
    const { meeting_class_id, participant_id: requestParticipantId, endedAt: requestEndedAt } = req.body;
    // session id may be sent as `session_id` or `sessionParticipantId` (frontend uses sessionParticipantId)
    let session_id = req.body.session_id || req.body.sessionParticipantId || req.body.sessionParticipantID || req.body.sessionId;
    // Normalize common bad values
    if (typeof session_id === 'string' && (session_id.trim() === '' || session_id === 'undefined' || session_id === 'null')) {
      session_id = null;
    }


    console.log("📥 /end route called with body:", req.body);
    console.log("👤 Authenticated user:", req.user);
console.log("📝 Debug meeting_class_id type:", typeof meeting_class_id, meeting_class_id);



        const participant_id = requestParticipantId ||req.user.id;

    if (!meeting_class_id) {
  return res.status(400).json({ success: false, error: 'meeting_class_id is required' });
}
    // Note: We'll validate session ownership after finding the session document
    // This allows using session document IDs from localStorage while ensuring security
    
    // Use provided endedAt timestamp or current time
    
    let sessionEntry = null;
    if (session_id) {
      try {
        sessionEntry = await SessionParticipant.findByPk(session_id);
        console.log('🔍 Found session by PK (session_id):', session_id, !!sessionEntry);
      } catch (err) {
        console.warn('🔍 Error finding session by PK:', err && err.message ? err.message : err);
      }
    }

    // If no sessionEntry found by id, try to find an active session for this participant+class
    if (!sessionEntry) {
      sessionEntry = await SessionParticipant.findOne({
        where: {
          participant_id,
          meeting_class_id,
          ended_at: null // only active sessions
        }
      });
      console.log('🔍 Found active session by participant+class:', !!sessionEntry);
    }

    // If still not found, try to find the latest session for this participant+class (even if ended) as a best-effort
    if (!sessionEntry) {
      console.log('🔍 No active session found, trying latest session for participant+class as fallback');
      sessionEntry = await SessionParticipant.findOne({
        where: { participant_id, meeting_class_id },
        order: [['joined_at', 'DESC']]
      });
      console.log('🔍 Found latest session fallback:', !!sessionEntry);
    }

    // if (!sessionEntry) {

    //    console.log("⚠️ No active session found for:", {
    //   participant_id,
    //   meeting_class_id,
    //   endedAt:null,
    // });
      
    if (!sessionEntry) {
      return res.status(404).json({ success: false, error: 'No active session found' });
    }

    if (!['admin', 'superadmin'].includes(req.user.role)) {
      if (sessionEntry.participant_id.toString() !== participant_id.toString()) {
        return res.status(403).json({ success: false, error: 'Cannot end session for another participant' });
      }
    }

    // Use the underscored DB field `ended_at` to check if session already ended
    if (sessionEntry.ended_at) {
      return res.status(200).json({
        success: true,
        message: 'Session already ended',
        data: sessionEntry,
        isAlreadyEnded: true,
      });
    }

    // Set ended_at from request or now
    sessionEntry.ended_at = requestEndedAt ? new Date(requestEndedAt) : new Date();

    // Update title and start_time if provided in request body (accept multiple key variants)
    const newTitle = req.body.title || req.body.classTitle || null;
    const newStartTime = req.body.start_time || req.body.startTime || null;
    if (newTitle) sessionEntry.title = newTitle;
    if (newStartTime) sessionEntry.start_time = newStartTime;

    // Debug raw incoming duration value (helps diagnose zero vs missing)
    console.log('🔍 Raw duration in request body:', req.body.duration, 'type:', typeof req.body.duration);

    // Determine duration: prefer explicit value from client if provided (allow zero), otherwise compute from joined_at
    let newDuration = null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'duration') && req.body.duration !== null && !Number.isNaN(Number(req.body.duration))) {
      const raw = Number(req.body.duration);
      // If client sent a large number, assume milliseconds; otherwise treat as minutes
      newDuration = raw > 10000 ? Math.floor(raw / 60000) : Math.floor(raw);
      console.log('🔍 Interpreting client duration:', { raw, interpretedMinutes: newDuration });
    } else {
      const joinedAtTime = new Date(sessionEntry.joined_at).getTime();
      const endedAtTime = sessionEntry.ended_at.getTime();
      const durationMs = endedAtTime - joinedAtTime;
      newDuration = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs / 60000)) : 0;
      console.log('🔍 Computed duration from timestamps (ms):', durationMs, 'minutes:', newDuration);
    }

    // Ensure duration is a finite integer (minutes)
    if (!Number.isFinite(newDuration) || Number.isNaN(Number(newDuration))) newDuration = 0;
    sessionEntry.duration = Math.floor(newDuration);

    // Recompute billing_amount and total_payable safely based on actual duration
    // First, fetch the user's profile data for currency and hourly rate
    let hourlyRate = 0;
    try {
      const user = await UserModel.findByPk(sessionEntry.participant_id);
      if (user) {
        // Update currency from user profile
        sessionEntry.currency = getCurrencyFromUserProfile(user, sessionEntry.participant_type, sessionEntry.currency || 'USD');
        console.log(`🔍 Updated currency from user profile: ${sessionEntry.currency}`);
        
        if (sessionEntry.participant_type === 'tutor') {
          const userData = user.dataValues || user;
          hourlyRate = userData.tutor_profile?.hourlyRate || userData.hourlyRate || 0;
          console.log(`🔍 Tutor hourly rate: ${hourlyRate}`);
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err.message);
      hourlyRate = 0;
    }
    
    // Calculate new billing_amount based on actual duration and hourly rate
    sessionEntry.billing_amount = (Number(sessionEntry.duration) / 60) * hourlyRate;
    
    // Calculate total_payable: billing_amount - discount_amount + tax_amount
    // IMPORTANT: Convert all values to numbers to avoid string concatenation errors
    const discountAmount = Number(sessionEntry.discount_amount) || 0;
    const taxAmount = Number(sessionEntry.tax_amount) || 0;
    sessionEntry.total_payable = sessionEntry.billing_amount - discountAmount + taxAmount;
    
    console.log('🔍 Recalculated billing:', {
      duration: sessionEntry.duration,
      hourlyRate: hourlyRate,
      billing_amount: sessionEntry.billing_amount,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_payable: sessionEntry.total_payable
    });

    //  if (typeof sessionEntry.calculateTotalPayable === 'function') {
    //   sessionEntry.calculateTotalPayable();


    // }

        const updatedSession = await sessionEntry.save();

    console.log('✅ Session ended successfully:', {
      sessionId: updatedSession.id,
      ended_at: updatedSession.ended_at,
      duration: updatedSession.duration,
      billing_amount: updatedSession.billing_amount,
      title: updatedSession.title,
      start_time: updatedSession.start_time,
    });
    res.status(200).json({
      success: true,
      message: 'Session ended successfully',
      data: updatedSession,
    });

    
    if (sessionEntry.endedAt) {
      console.log("⚠️ Session already ended earlier. Overwriting for debug test.");
    }
    
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// @route   POST /api/sessions-participants/:id/mark-paid
// @desc    Mark a session participant as paid (Admin action)
// @access  Private (Admin, SuperAdmin)
router.post('/:id/mark-paid', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const participantId = req.params.id;
    
    console.log(`Marking SessionParticipant ${participantId} as paid`);
    
    // Update the SessionParticipant payment_status to 'Paid'
    const updateResult = await SessionParticipant.update(
      { 
        payment_status: 'Paid'
      },
      {
        where: {
          id: participantId
        }
      }
    );

    if (updateResult[0] === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'SessionParticipant not found' 
      });
    }

    console.log(`Successfully updated SessionParticipant ${participantId} to 'Paid' status`);

    // Get the updated record
    const updatedParticipant = await SessionParticipant.findByPk(participantId, {
      include: [
        { model: UserModel, as: 'participant' },
        { model: ClassModel, as: 'classObj' }
      ]
    });

    res.json({ 
      success: true, 
      message: 'Payment status updated successfully', 
      data: updatedParticipant 
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update payment status', 
      details: error.message 
    });
  }
});

// @route   POST /api/sessions-participants/:id/void
// @desc    Mark a session participant as void (Admin action)
// @access  Private (Admin, SuperAdmin)
router.post('/:id/void', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const participantId = req.params.id;
    
    console.log(`Marking SessionParticipant ${participantId} as void`);
    
    // Update the SessionParticipant payment_status to 'Void'
    const updateResult = await SessionParticipant.update(
      { 
        payment_status: 'Void'
      },
      {
        where: {
          id: participantId
        }
      }
    );

    if (updateResult[0] === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'SessionParticipant not found' 
      });
    }

    console.log(`Successfully updated SessionParticipant ${participantId} to 'Void' status`);

    // Get the updated record
    const updatedParticipant = await SessionParticipant.findByPk(participantId, {
      include: [
        { model: UserModel, as: 'participant' },
        { model: ClassModel, as: 'classObj' }
      ]
    });

    res.json({ 
      success: true, 
      message: 'Payment status voided successfully', 
      data: updatedParticipant 
    });
  } catch (error) {
    console.error('Error voiding payment status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to void payment status', 
      details: error.message 
    });
  }
});

// Get all active session participants for a specific meeting (for video room names display)
// @route   GET /api/session-participants/by-meeting/:meeting_class_id
// @desc    Get all active participants in a meeting with their names
// @access  Private (authenticated users in the meeting)
router.get('/by-meeting/:meeting_class_id', auth(['tutor', 'student']), async (req, res) => {
  try {
    let { meeting_class_id } = req.params;
    const currentUserId = req.user.id;  // Get current logged-in user
    
    if (!meeting_class_id) {
      return res.status(400).json({ success: false, error: 'meeting_class_id is required' });
    }

    console.log(`🔍 Fetching participants for meeting: ${meeting_class_id}`);

    // Step 1: Look up the Class by meetingId (URL identifier like 'class-xyz')
    let classRecord = null;
    if (meeting_class_id.includes('-') || !meeting_class_id.match(/^[0-9]+$/)) {
      // Looks like a URL identifier, try to find the class
      console.log(`  📌 Trying to find class by meetingId: ${meeting_class_id}`);
      classRecord = await ClassModel.findOne({
        where: { meetingId: meeting_class_id }
      });
      
      if (!classRecord && meeting_class_id.startsWith('class-')) {
        // Try without prefix
        const cleanId = meeting_class_id.replace(/^class-/, '');
        console.log(`  📌 Trying to find class by meetingId without prefix: ${cleanId}`);
        classRecord = await ClassModel.findOne({
          where: { meetingId: cleanId }
        });
      }
    }

    // If found the class, use its database ID
    let lookupId = meeting_class_id;
    if (classRecord) {
      lookupId = classRecord.id;
      console.log(`  ✅ Resolved ${meeting_class_id} → Class ID ${lookupId}`);
    }

    // Step 2: Fetch participants from SessionParticipant table (those who have already joined)
    console.log(`📋 Fetching SessionParticipant records for class: ${lookupId}`);
    let participants = await SessionParticipant.findAll({
      where: {
        meeting_class_id: lookupId,
        [Op.or]: [
          { ended_at: null },  // Still in session
          { status: 'active' }
        ]
      },
      include: [
        {
          model: UserModel,
          as: 'participant',
          attributes: ['id', 'firstName', 'lastName', 'email', 'role']
        }
      ],
      attributes: ['id', 'participant_id', 'meeting_class_id', 'participant_type', 'joined_at', 'status'],
      order: [['joined_at', 'ASC']],
      raw: false
    });

    console.log(`📊 Found ${participants.length} active participants from SessionParticipant table for class ${lookupId}`);

    // Step 3: Transform data to include participant names
    const participantList = participants.map(p => ({
      id: p.id,
      participant_id: p.participant_id,
      meeting_class_id: p.meeting_class_id,
      name: p.participant ? `${p.participant.firstName || ''} ${p.participant.lastName || ''}`.trim() : 'Unknown',
      email: p.participant?.email,
      role: p.participant?.role,
      participant_type: p.participant_type,
      joined_at: p.joined_at,
      status: p.status,
      source: 'database'  // Mark as from database
    }));

    // Step 4: Check if current user is the only one in the session
    const currentUserInList = participantList.some(p => p.participant_id === currentUserId);
    if (participantList.length === 0 || !currentUserInList) {
      console.log(`⏳ Few participants in database. Current user (${currentUserId}) in list: ${currentUserInList}`);
      console.log(`💡 Possible reasons: Recent join, database sync delay, or first person joining`);
      console.log(`📌 Returning ${participantList.length} database participants. Frontend can use polling to wait for more.`);
    }

    console.log('Participant list:', participantList);

    res.status(200).json({
      success: true,
      data: participantList,
      count: participantList.length,
      info: {
        source: 'database',
        lookupId: lookupId,
        meetingId: meeting_class_id,
        currentUserId: currentUserId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching participants for meeting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch participants',
      details: error.message
    });
  }
});

module.exports = router;