const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BillingTransaction = require('../models/BillingTransaction');
const SessionParticipant = require('../models/SessionParticipant');
const SessionHistory = require('../models/SessionHistory');
const Class = require('../models/Class');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   GET /api/billing/transactions
// @desc    Get billing transactions with filters
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const { 
      status,
      paymentStatus,
      startDate,
      endDate,
      parentId,
      studentId,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (parentId) query['billedTo.parentId'] = parentId;
    if (studentId) query['billedTo.studentId'] = studentId;
    
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    // For parents, only show their own transactions
    if (req.user.role === 'parent') {
      query['billedTo.parentId'] = req.user.id;
    }

    const transactions = await BillingTransaction.find(query)
      .sort({ invoiceDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BillingTransaction.countDocuments(query);

    res.json({
      transactions,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalTransactions: total
    });

  } catch (error) {
    console.error('Error fetching billing transactions:', error);
    res.status(500).json({ message: 'Server error fetching billing transactions' });
  }
});

// @route   GET /api/billing/transactions/:transactionId
// @desc    Get specific billing transaction details
// @access  Private
router.get('/transactions/:transactionId', auth, async (req, res) => {
  try {
    const transaction = await BillingTransaction.findById(req.params.transactionId)
      .populate('sessionId')
      .populate('participantId')
      .populate('billedTo.parentId', 'name email')
      .populate('billedTo.studentId', 'name email')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email');

    if (!transaction) {
      return res.status(404).json({ message: 'Billing transaction not found' });
    }

    // Authorization check
    if (req.user.role === 'parent' && 
        transaction.billedTo.parentId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get session details from SessionHistory
    const session = await SessionHistory.findById(transaction.sessionId)
      .populate({
        path: 'classId',
        populate: {
          path: 'tutor',
          select: 'firstName lastName email'
        }
      });

    res.json({
      transaction,
      session: session ? {
        ...session.toObject(),
        tutor: session.classId?.tutor,
        class: {
          subject: session.classId?.subject,
          title: session.classId?.title
        }
      } : null,
      billingSummary: transaction.getBillingSummary()
    });

  } catch (error) {
    console.error('Error fetching billing transaction:', error);
    res.status(500).json({ message: 'Server error fetching billing transaction' });
  }
});

// @route   POST /api/billing/transactions/:transactionId/approve
// @desc    Approve a billing transaction
// @access  Private (Admin only)
router.post('/transactions/:transactionId/approve', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const transaction = await BillingTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Billing transaction not found' });
    }

    if (transaction.status !== 'draft') {
      return res.status(409).json({ message: 'Transaction can only be approved from draft status' });
    }

    transaction.status = 'approved';
    transaction.approvedBy = req.user.id;
    transaction.approvedAt = new Date();
    await transaction.save();

    res.json({
      message: 'Transaction approved successfully',
      transaction
    });

  } catch (error) {
    console.error('Error approving transaction:', error);
    res.status(500).json({ message: 'Server error approving transaction' });
  }
});

// @route   POST /api/billing/transactions/:transactionId/payment
// @desc    Record payment for a billing transaction
// @access  Private (Admin only)
router.post('/transactions/:transactionId/payment', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { paymentMethod, paymentReference } = req.body;

    const transaction = await BillingTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Billing transaction not found' });
    }

    transaction.markAsPaid(paymentMethod, paymentReference);
    await transaction.save();

    res.json({
      message: 'Payment recorded successfully',
      transaction
    });

  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ message: 'Server error recording payment' });
  }
});

// @route   POST /api/billing/transactions/:transactionId/discount
// @desc    Apply discount to a billing transaction
// @access  Private (Admin only)
router.post('/transactions/:transactionId/discount', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { discountType, value, reason } = req.body;

    const transaction = await BillingTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Billing transaction not found' });
    }

    if (transaction.status === 'paid') {
      return res.status(409).json({ message: 'Cannot apply discount to paid transaction' });
    }

    const discount = transaction.applyDiscount(discountType, value, reason);
    await transaction.save();

    res.json({
      message: 'Discount applied successfully',
      discount,
      newTotal: transaction.totalAmount
    });

  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({ message: 'Server error applying discount' });
  }
});

// @route   POST /api/billing/transactions/:transactionId/adjustment
// @desc    Apply adjustment to a billing transaction
// @access  Private (Admin only)
router.post('/transactions/:transactionId/adjustment', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { adjustmentType, amount, reason } = req.body;

    const transaction = await BillingTransaction.findById(req.params.transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Billing transaction not found' });
    }

    if (transaction.status === 'paid') {
      return res.status(409).json({ message: 'Cannot apply adjustment to paid transaction' });
    }

    const adjustment = transaction.applyAdjustment(adjustmentType, amount, reason, req.user.id);
    await transaction.save();

    res.json({
      message: 'Adjustment applied successfully',
      adjustment,
      newTotal: transaction.totalAmount
    });

  } catch (error) {
    console.error('Error applying adjustment:', error);
    res.status(500).json({ message: 'Server error applying adjustment' });
  }
});

// @route   GET /api/billing/reports/summary
// @desc    Get billing summary report
// @access  Private (Admin/Parent)
router.get('/reports/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate, parentId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const filters = {};
    
    // For parents, only show their own data
    if (req.user.role === 'parent') {
      filters.parentId = req.user.id;
    } else if (parentId) {
      filters.parentId = parentId;
    }

    const report = await BillingTransaction.getBillingReport(startDate, endDate, filters);

    // Get additional breakdown by status
    const statusBreakdown = await BillingTransaction.aggregate([
      {
        $match: {
          'billingPeriod.startDate': { $gte: new Date(startDate) },
          'billingPeriod.endDate': { $lte: new Date(endDate) },
          ...(filters.parentId && mongoose.Types.ObjectId.isValid(filters.parentId) && { 'billedTo.parentId': new mongoose.Types.ObjectId(filters.parentId) })
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.json({
      ...report,
      statusBreakdown,
      period: { startDate, endDate }
    });

  } catch (error) {
    console.error('Error generating billing report:', error);
    res.status(500).json({ message: 'Server error generating billing report' });
  }
});

// @route   GET /api/billing/reports/parent/:parentId
// @desc    Get detailed billing report for a parent
// @access  Private (Admin/Parent)
router.get('/reports/parent/:parentId', auth, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { startDate, endDate, groupBy = 'month' } = req.query;

    // Authorization check
    if (req.user.role === 'parent' && req.user.id !== parentId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    // Get parent information
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({ message: 'Invalid parent ID format' });
    }
    
    const parent = await User.findById(parentId).populate('children', 'name email');
    if (!parent) {
      return res.status(404).json({ message: 'Parent not found' });
    }

    // Get transactions for this parent
    const transactions = await BillingTransaction.find({
      'billedTo.parentId': new mongoose.Types.ObjectId(parentId),
      'billingPeriod.startDate': { $gte: new Date(startDate) },
      'billingPeriod.endDate': { $lte: new Date(endDate) }
    })
    .populate('sessionId', 'scheduledStartTime actualStartTime actualEndTime')
    .populate('billedTo.studentId', 'name')
    .sort({ invoiceDate: -1 });

    // Group transactions by specified period
    const groupedTransactions = {};
    const summary = {
      totalAmount: 0,
      totalSessions: 0,
      averageSessionCost: 0,
      paymentsByStatus: {}
    };

    transactions.forEach(transaction => {
      const date = new Date(transaction.invoiceDate);
      let groupKey;
      
      if (groupBy === 'month') {
        groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        groupKey = weekStart.toISOString().split('T')[0];
      } else {
        groupKey = date.toISOString().split('T')[0];
      }

      if (!groupedTransactions[groupKey]) {
        groupedTransactions[groupKey] = [];
      }
      groupedTransactions[groupKey].push(transaction);

      // Update summary
      summary.totalAmount += transaction.totalAmount;
      summary.totalSessions += 1;
      
      if (!summary.paymentsByStatus[transaction.paymentStatus]) {
        summary.paymentsByStatus[transaction.paymentStatus] = {
          count: 0,
          amount: 0
        };
      }
      summary.paymentsByStatus[transaction.paymentStatus].count += 1;
      summary.paymentsByStatus[transaction.paymentStatus].amount += transaction.totalAmount;
    });

    summary.averageSessionCost = summary.totalSessions > 0 ? 
      summary.totalAmount / summary.totalSessions : 0;

    res.json({
      parent: {
        id: parent._id,
        name: parent.name,
        email: parent.email,
        children: parent.children
      },
      summary,
      groupedTransactions,
      period: { startDate, endDate, groupBy }
    });

  } catch (error) {
    console.error('Error generating parent billing report:', error);
    res.status(500).json({ message: 'Server error generating parent billing report' });
  }
});

// @route   GET /api/billing/outstanding
// @desc    Get outstanding payments
// @access  Private (Admin)
router.get('/outstanding', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { overdueDays = 0 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overdueDays);

    const outstandingTransactions = await BillingTransaction.find({
      paymentStatus: 'pending',
      dueDate: { $lte: cutoffDate }
    })
    .populate('billedTo.parentId', 'name email phone')
    .populate('billedTo.studentId', 'name')
    .populate('sessionId', 'scheduledStartTime')
    .sort({ dueDate: 1 });

    const summary = {
      totalOutstanding: outstandingTransactions.reduce((sum, t) => sum + t.totalAmount, 0),
      totalTransactions: outstandingTransactions.length,
      byAgeGroup: {}
    };

    // Group by age (days overdue)
    outstandingTransactions.forEach(transaction => {
      const daysOverdue = Math.floor((new Date() - transaction.dueDate) / (1000 * 60 * 60 * 24));
      let ageGroup;
      
      if (daysOverdue <= 30) ageGroup = '0-30 days';
      else if (daysOverdue <= 60) ageGroup = '31-60 days';
      else if (daysOverdue <= 90) ageGroup = '61-90 days';
      else ageGroup = '90+ days';

      if (!summary.byAgeGroup[ageGroup]) {
        summary.byAgeGroup[ageGroup] = { count: 0, amount: 0 };
      }
      summary.byAgeGroup[ageGroup].count += 1;
      summary.byAgeGroup[ageGroup].amount += transaction.totalAmount;
    });

    res.json({
      summary,
      outstandingTransactions
    });

  } catch (error) {
    console.error('Error fetching outstanding payments:', error);
    res.status(500).json({ message: 'Server error fetching outstanding payments' });
  }
});

module.exports = router;
