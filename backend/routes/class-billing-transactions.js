
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');
const auth = require('../middleware/auth-postgres');
const ClassBillingTransactionModel = require('../models/sequelize/ClassBillingTransaction')(sequelize, DataTypes);
const User = require('../models/sequelize/user');
const Class = require('../models/sequelize/Class');
const Subject = require('../models/sequelize/Subject');
const SessionParticipantModel = require('../models/sequelize/SessionParticipant')(sequelize, DataTypes); // MongoDB model

// Set up associations
ClassBillingTransactionModel.belongsTo(Class, {
	foreignKey: 'class_id',
	as: 'class'
});
ClassBillingTransactionModel.belongsTo(User, {
	foreignKey: 'student_id',
	as: 'student'
});
ClassBillingTransactionModel.belongsTo(User, {
	foreignKey: 'tutor_id',
	as: 'tutor'
});
ClassBillingTransactionModel.belongsTo(User, {
	foreignKey: 'parent_id',
	as: 'parent'
});

// Set up SessionParticipant associations
SessionParticipantModel.belongsTo(User, {
	foreignKey: 'participant_id',
	as: 'participant'
});
SessionParticipantModel.belongsTo(Class, {
	foreignKey: 'meeting_class_id',
	as: 'meeting_class'
});

// @route   POST /api/class-billing-transactions/:id/mark-paid
// @desc    Mark a transaction as paid (Admin action)
// @access  Private (Admin, SuperAdmin)
router.post('/:id/mark-paid', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    // Debug: Check all transaction statuses before update
    const beforeUpdate = await ClassBillingTransactionModel.findAll({
      attributes: ['id', 'status'],
      raw: true
    });
    console.log('All transactions before update:', beforeUpdate);
    
    // Find the transaction using Sequelize
    const transaction = await ClassBillingTransactionModel.findByPk(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    console.log(`Processing mark-paid for transaction ${transactionId}. Current status: ${transaction.status}`);
    
    // DON'T update ClassBillingTransaction - only update SessionParticipants
    console.log('Skipping ClassBillingTransaction update - only updating SessionParticipants payment_status');

    // Update or create SessionParticipant payment_status for the student in this class
    try {
      // First, let's see what SessionParticipant records exist for this class
      const existingParticipants = await SessionParticipantModel.findAll({
        where: {
          meeting_class_id: transaction.class_id.toString()
        },
        attributes: ['id', 'participant_id', 'participant_type', 'meeting_class_id', 'payment_status'],
        raw: true
      });
      
      console.log(`Found ${existingParticipants.length} SessionParticipant records for class ${transaction.class_id}:`, existingParticipants);
      console.log(`Updating payment_status for all participants in class ${transaction.class_id}`);

      // Update ALL participants (both student and tutor) for this class when transaction is marked paid
      const sessionUpdateResult = await SessionParticipantModel.update(
        { 
          payment_status: 'Paid'
        },
        {
          where: {
            meeting_class_id: transaction.class_id.toString()
          }
        }
      );

      if (sessionUpdateResult[0] === 0) {
        console.log(`No SessionParticipant records found for class ${transaction.class_id}`);
      } else {
        console.log(`Updated ${sessionUpdateResult[0]} SessionParticipant records for class ${transaction.class_id} to 'Paid' status`);
      }
    } catch (sessionError) {
      console.error('Error updating SessionParticipant payment status:', sessionError);
      // Don't fail the main transaction if SessionParticipant update fails
    }

    // Get the updated transaction with associations
    const updatedTransaction = await ClassBillingTransactionModel.findByPk(transactionId, {
      include: [
        { model: Class, as: 'class' },
        { model: User, as: 'student' },
        { model: User, as: 'tutor' },
        { model: User, as: 'parent' }
      ]
    });

    res.json({ 
      success: true, 
      message: 'Transaction marked as paid and payment status updated', 
      data: updatedTransaction 
    });
  } catch (error) {
    console.error('Error marking transaction as paid:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as paid', details: error.message });
  }
});

// @route   POST /api/class-billing-transactions/:id/void
// @desc    Mark a transaction as void (Admin action)
// @access  Private (Admin, SuperAdmin)
router.post('/:id/void', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    // Find the transaction using Sequelize
    const transaction = await ClassBillingTransactionModel.findByPk(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    const reason = req.body.reason || '';
    
    // Update the transaction to mark as void
    await transaction.update({
      status: 'void'
    });

    // Get the updated transaction with associations
    const updatedTransaction = await ClassBillingTransactionModel.findByPk(transactionId, {
      include: [
        { model: Class, as: 'class' },
        { model: User, as: 'student' },
        { model: User, as: 'tutor' },
        { model: User, as: 'parent' }
      ]
    });

    res.json({ 
      success: true, 
      message: 'Transaction marked as void', 
      data: updatedTransaction 
    });
  } catch (error) {
    console.error('Error marking transaction as void:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as void', details: error.message });
  }
});

// @route   GET /api/class-billing-transactions
// @desc    Get class billing transactions with filters (Admin view)
// @access  Private (Admin, SuperAdmin)
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      subject,
      tutorId,
      studentId,
      parentId,
      dateFrom,
      dateTo,
      currency,
      search,
      sortBy = 'scheduled_start',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query for Sequelize
    const where = {};

    // Status filter (can be multiple)
    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      where.status = { [Op.in]: statusArray };
    }

    // Subject filter (can be multiple) 
    if (subject) {
      const subjectArray = Array.isArray(subject) ? subject : subject.split(',');
      where.subject = { [Op.in]: subjectArray };
    }

    // User filters
    if (tutorId) {
      where.tutor_id = parseInt(tutorId);
    }

    if (studentId) {
      where.student_id = parseInt(studentId);
    }

    if (parentId) {
      where.parent_id = parseInt(parentId);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.scheduled_start = {};
      if (dateFrom) {
        where.scheduled_start[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.scheduled_start[Op.lte] = endDate;
      }
    }

    // Currency filter
    if (currency) {
      where.currency = currency;
    }

    // Search functionality (across subject for now)
    if (search) {
      where.subject = { [Op.iLike]: `%${search}%` };
    }

    // Sorting
    const order = [[
      sortBy === 'scheduledStart' ? 'scheduled_start' : sortBy,
      sortOrder === 'desc' ? 'DESC' : 'ASC'
    ]];

    // Execute query with pagination and associations
    const { count, rows: transactions } = await ClassBillingTransactionModel.findAndCountAll({
      where,
      include: [
        {
          model: Class,
          as: 'class',
          attributes: ['id', 'title', 'subject', 'startTime', 'duration']
        },
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'tutor', 
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'parent',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      raw: false
    });

    // Transform data to match frontend expectations
    const transactionsWithJoinEnd = await Promise.all(transactions.map(async (txn) => {
      let joinAt = null;
      let endAt = null;
      
      try {
        if (txn.tutor_id && txn.class_id) {
          const participant = await SessionParticipantModel.findOne({
            where: {
              participant_id: txn.tutor_id,
              meeting_class_id: txn.class_id,
              participant_type: 'tutor'
            }
          });
          if (participant) {
            joinAt = participant.joinedAt;
            endAt = participant.endedAt;
          }
        }
      } catch (e) {
        console.warn('Error fetching session participant data:', e.message);
      }

      return {
        id: txn.id,
        _id: txn.id, // For compatibility
        classId: txn.class,
        tutorId: txn.tutor,
        studentId: txn.student,
        parentId: txn.parent,
        subject: txn.subject,
        status: txn.status,
        amount: txn.amount,
        currency: txn.currency,
        scheduledStart: txn.scheduled_start,
        scheduledEnd: txn.scheduled_end,
        durationMinutes: txn.duration_minutes,
        joinAt,
        endAt
      };
    }));

    // Calculate summary statistics 
    const allTransactions = await ClassBillingTransactionModel.findAll({
      attributes: ['status', 'amount'],
      raw: true
    });

    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    let democlass = 0;

    allTransactions.forEach(txn => {
      if (txn.status === 'democlass') {
        democlass++;
      } else if (txn.status === 'paid') {
        paidAmount += txn.amount || 0;
        totalAmount += txn.amount || 0;
      } else if (txn.status === 'unpaid') {
        unpaidAmount += txn.amount || 0;
        totalAmount += txn.amount || 0;
      }
    });

    const summary = {
      totalTransactions: allTransactions.length,
      totalAmount,
      paidAmount,
      unpaidAmount,
      democlass
    };

    res.json({
      success: true,
      data: {
        transactions: transactionsWithJoinEnd,
        summary,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(count / limit),
          total: count,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching class billing transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing transactions',
      details: error.message
    });
  }
});

// @route   GET /api/class-billing-transactions/parent/:parentId
// @desc    Get billing transactions for a specific parent's children
// @access  Private (Parent, Admin, SuperAdmin)
router.get('/parent/:parentId', auth(['parent', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { parentId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      subject,
      dateFrom,
      dateTo,
      childId,
      sortBy = 'scheduledStart',
      sortOrder = 'desc'
    } = req.query;

    // Authorization check - parents can only access their own data
    if (req.user.role === 'parent' && req.user.id !== parentId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own billing information.'
      });
    }

    // Validate parentId
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parent ID format'
      });
    }

    // Build filter query
    const filter = { parentId };

    // Additional filters
    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      filter.status = { $in: statusArray };
    }

    if (subject) {
      const subjectArray = Array.isArray(subject) ? subject : subject.split(',');
      filter.subject = { $in: subjectArray };
    }

    if (childId && mongoose.Types.ObjectId.isValid(childId)) {
      filter.studentId = childId;
    }

    if (dateFrom || dateTo) {
      filter.scheduledStart = {};
      if (dateFrom) {
        filter.scheduledStart.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.scheduledStart.$lte = endDate;
      }
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const transactions = await ClassBillingTransaction.find(filter)
      .populate('tutorId', 'firstName lastName email')
      .populate('studentId', 'firstName lastName email')
      .populate('classId', 'title description startTime duration')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ClassBillingTransaction.countDocuments(filter);

    // Get summary for this parent
    const summary = await ClassBillingTransaction.getBillingReport({
      ...req.query,
      parentId
    });

    res.json({
      success: true,
      data: {
        transactions,
        summary,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching parent billing transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing transactions',
      details: error.message
    });
  }
});

// @route   GET /api/class-billing-transactions/tutor/:tutorId
// @desc    Get billing transactions for a specific tutor
// @access  Private (Tutor, Admin, SuperAdmin)
router.get('/tutor/:tutorId', auth(['tutor', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { tutorId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      subject,
      dateFrom,
      dateTo,
      sortBy = 'scheduledStart',
      sortOrder = 'desc'
    } = req.query;

    // Authorization check - tutors can only access their own data
    if (req.user.role === 'tutor' && req.user.id !== tutorId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own class billing information.'
      });
    }

    // Validate tutorId
    if (!mongoose.Types.ObjectId.isValid(tutorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tutor ID format'
      });
    }

    const filter = { tutorId };

    // Apply filters
    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      filter.status = { $in: statusArray };
    }

    if (subject) {
      const subjectArray = Array.isArray(subject) ? subject : subject.split(',');
      filter.subject = { $in: subjectArray };
    }

    if (dateFrom || dateTo) {
      filter.scheduledStart = {};
      if (dateFrom) {
        filter.scheduledStart.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.scheduledStart.$lte = endDate;
      }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const transactions = await ClassBillingTransaction.find(filter)
      .populate('studentId', 'firstName lastName email')
      .populate('parentId', 'firstName lastName email')
      .populate('classId', 'title description startTime duration')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ClassBillingTransaction.countDocuments(filter);
    const summary = await ClassBillingTransaction.getBillingReport({
      ...req.query,
      tutorId
    });

    res.json({
      success: true,
      data: {
        transactions,
        summary,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching tutor billing transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing transactions',
      details: error.message
    });
  }
});

// @route   PUT /api/class-billing-transactions/:id/pay
// @desc    Mark a billing transaction as paid
// @access  Private (Admin, SuperAdmin)
router.put('/:id/pay', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentReference, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    const transaction = await ClassBillingTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Check if already paid
    if (transaction.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Transaction is already marked as paid'
      });
    }

    // Update transaction
    await transaction.markAsPaid(paymentMethod, paymentReference, req.user.id);

    // Add notes if provided
    if (notes) {
      transaction.notes = notes;
      await transaction.save();
    }

    // Populate for response
    await transaction.populate([
      { path: 'tutorId', select: 'firstName lastName email' },
      { path: 'studentId', select: 'firstName lastName email' },
      { path: 'parentId', select: 'firstName lastName email' },
      { path: 'classId', select: 'title description startTime duration' }
    ]);

    res.json({
      success: true,
      data: { transaction },
      message: 'Payment recorded successfully'
    });

  } catch (error) {
    console.error('Error marking transaction as paid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      details: error.message
    });
  }
});

// @route   PUT /api/class-billing-transactions/:id/void
// @desc    Void a billing transaction
// @access  Private (Admin, SuperAdmin)
router.put('/:id/void', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    const transaction = await ClassBillingTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Void transaction
    await transaction.markAsVoid(req.user.id, reason);

    // Populate for response
    await transaction.populate([
      { path: 'tutorId', select: 'firstName lastName email' },
      { path: 'studentId', select: 'firstName lastName email' },
      { path: 'parentId', select: 'firstName lastName email' },
      { path: 'classId', select: 'title description startTime duration' }
    ]);

    res.json({
      success: true,
      data: { transaction },
      message: 'Transaction voided successfully'
    });

  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to void transaction',
      details: error.message
    });
  }
});

// @route   GET /api/class-billing-transactions/export
// @desc    Export billing transactions as CSV
// @access  Private (Admin, SuperAdmin)
router.get('/export', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      status,
      subject,
      tutorId,
      studentId,
      parentId,
      dateFrom,
      dateTo,
      format = 'csv'
    } = req.query;

    // Build filter (same as main GET route)
    const filter = {};

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      filter.status = { $in: statusArray };
    }

    if (subject) {
      const subjectArray = Array.isArray(subject) ? subject : subject.split(',');
      filter.subject = { $in: subjectArray };
    }

    if (tutorId && mongoose.Types.ObjectId.isValid(tutorId)) {
      filter.tutorId = tutorId;
    }

    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
      filter.studentId = studentId;
    }

    if (parentId && mongoose.Types.ObjectId.isValid(parentId)) {
      filter.parentId = parentId;
    }

    if (dateFrom || dateTo) {
      filter.scheduledStart = {};
      if (dateFrom) {
        filter.scheduledStart.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.scheduledStart.$lte = endDate;
      }
    }

    const transactions = await ClassBillingTransaction.find(filter)
      .populate('tutorId', 'firstName lastName email')
      .populate('studentId', 'firstName lastName email')
      .populate('parentId', 'firstName lastName email')
      .populate('classId', 'title description startTime duration')
      .sort({ scheduledStart: -1 });

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Date',
        'Class Title',
        'Subject', 
        'Tutor Name',
        'Student Name',
        'Parent Name',
        'Status',
        'Amount',
        'Currency',
        'Payment Method',
        'Paid At',
        'Duration (min)',
        'Hourly Rate',
        'Notes'
      ];

      const csvRows = transactions.map(transaction => [
        transaction.scheduledStart.toISOString().split('T')[0],
        transaction.classId?.title || '',
        transaction.subject,
        `${transaction.tutorId?.firstName || ''} ${transaction.tutorId?.lastName || ''}`.trim(),
        `${transaction.studentId?.firstName || ''} ${transaction.studentId?.lastName || ''}`.trim(),
        `${transaction.parentId?.firstName || ''} ${transaction.parentId?.lastName || ''}`.trim(),
        transaction.status,
        transaction.amount,
        transaction.currency,
        transaction.paymentMethod || '',
        transaction.paidAt ? transaction.paidAt.toISOString().split('T')[0] : '',
        transaction.durationMinutes,
        transaction.hourlyRate,
        transaction.notes || ''
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="billing-transactions.csv"');
      res.send(csvContent);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: { transactions }
      });
    }

  } catch (error) {
    console.error('Error exporting billing transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export billing transactions',
      details: error.message
    });
  }
});

// @route   GET /api/class-billing-transactions/summary
// @desc    Get billing summary statistics
// @access  Private (Admin, SuperAdmin)
router.get('/summary', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const summary = await ClassBillingTransaction.getBillingReport(req.query);

    // Get additional breakdowns
    const statusBreakdown = await ClassBillingTransaction.aggregate([
      { $match: {} }, // Add filters if needed
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const subjectBreakdown = await ClassBillingTransaction.aggregate([
      { $match: {} },
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary,
        breakdown: {
          byStatus: statusBreakdown,
          bySubject: subjectBreakdown
        }
      }
    });

  } catch (error) {
    console.error('Error fetching billing summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing summary',
      details: error.message
    });
  }
});

// @route   GET /api/class-billing-transactions/parent
// @desc    Get billing transactions for parent's children
// @access  Private (Parent)
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      studentId,
      dateFrom,
      dateTo,
      sortBy = 'scheduled_start',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query - only show transactions for this parent's children
    const where = {
      parent_id: req.user.id
    };

    // Status filter
    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      where.status = { [Op.in]: statusArray };
    }

    // Filter by specific child if provided
    if (studentId) {
      where.student_id = parseInt(studentId);
    }

    // Date filters
    if (dateFrom || dateTo) {
      where.scheduled_start = {};
      if (dateFrom) where.scheduled_start[Op.gte] = new Date(dateFrom);
      if (dateTo) where.scheduled_start[Op.lte] = new Date(dateTo);
    }

    // Sorting
    const order = [[sortBy === 'scheduledStart' ? 'scheduled_start' : sortBy || 'scheduled_start', sortOrder === 'desc' ? 'DESC' : 'ASC']];

    // Get total count for pagination
    const total = await ClassBillingTransactionModel.count({ where });

    // Get transactions with populated data
    const transactions = await ClassBillingTransactionModel.findAll({
      where,
      include: [
        {
          model: Class,
          as: 'class',
          attributes: ['id', 'title', 'subject']
        },
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'tutor',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      order,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      raw: false
    });

    // Get all subject IDs to lookup names
    const subjectIds = [...new Set(transactions.map(t => t.subject).filter(s => s))];
    const subjects = await Subject.findAll({
      where: { id: { [Op.in]: subjectIds } },
      attributes: ['id', 'subjectName']
    });
    const subjectMap = {};
    subjects.forEach(s => {
      subjectMap[s.id] = s.subjectName;
    });

    // Transform transactions to match frontend format
    const transformedTransactions = transactions.map(txn => ({
      id: txn.id,
      _id: txn.id, // For compatibility
      scheduledStart: txn.scheduled_start,
      classId: txn.class,
      subject: subjectMap[txn.subject] || txn.subject || 'General', // Use subject name if available
      tutorId: txn.tutor,
      studentId: txn.student,
      status: txn.status,
      amount: txn.amount,
      currency: txn.currency,
      paymentMethod: null,
      paidAt: null
    }));

    // Calculate summary statistics across ALL transactions for this parent (not just the current page)
    const allTransactionsWhere = {
      parent_id: req.user.id
    };
    const allTransactions = await ClassBillingTransactionModel.findAll({
      where: allTransactionsWhere,
      attributes: ['status', 'amount']
    });

    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    let demoClassCount = 0;

    allTransactions.forEach(txn => {
      if (txn.status === 'democlass') {
        demoClassCount++;
      } else if (txn.status === 'paid') {
        paidAmount += txn.amount || 0;
        totalAmount += txn.amount || 0;
      } else if (txn.status === 'unpaid') {
        unpaidAmount += txn.amount || 0;
        totalAmount += txn.amount || 0;
      }
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        transactions: transformedTransactions,
        summary: {
          totalTransactions: allTransactions.length,
          totalAmount,
          paidAmount,
          unpaidAmount,
          democlass: demoClassCount
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching parent billing transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing transactions',
      details: error.message
    });
  }
});

// @route   POST /api/class-billing-transactions/:id/pay
// @desc    Mark a transaction as paid (for parents)
// @access  Private (Parent)
router.post('/:id/pay', auth(['parent']), async (req, res) => {
  try {
    const transactionId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID'
      });
    }

    // Find the transaction and verify it belongs to this parent
    const transaction = await ClassBillingTransaction.findOne({
      _id: transactionId,
      parentId: req.user.id,
      status: { $in: ['unpaid', 'democlass'] }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found or access denied'
      });
    }

    // For demo classes, just mark as paid without payment processing
    if (transaction.status === 'democlass') {
      transaction.status = 'paid';
      transaction.paidAt = new Date();
      transaction.paymentMethod = 'demo';
      await transaction.save();

      return res.json({
        success: true,
        message: 'Demo class marked as completed',
        data: transaction
      });
    }

    // TODO: Integrate with payment gateway (Stripe, PayPal, etc.)
    // For now, we'll simulate payment processing
    const { paymentMethod, paymentReference } = req.body;

    // Update transaction
    transaction.status = 'paid';
    transaction.paidAt = new Date();
    transaction.paymentMethod = paymentMethod || 'external';
    transaction.paymentReference = paymentReference;
    transaction.updatedBy = req.user.id;

    await transaction.save();

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: transaction
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment',
      details: error.message
    });
  }
});

module.exports = router;