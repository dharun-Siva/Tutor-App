/**
 * Parent Billing Routes - New billing system using class_billing table
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');

// Import models and services
const User = require('../models/sequelize/user');
const Class = require('../models/sequelize/Class');
const ClassBilling = require('../models/sequelize/ClassBilling')(sequelize, DataTypes);
const { getParentBills, getParentCurrentMonthBills } = require('../services/billingService');
const auth = require('../middleware/auth-postgres');

/**
 * @route   GET /api/parent-billing/current-month
 * @desc    Get current month's bills for parent's children
 * @access  Private (Parent)
 */
router.get('/current-month', auth(['parent']), async (req, res) => {
  try {
    console.log(`\nFetching current month bills for parent: ${req.user.id}`);

    const parentId = req.user.id;

    // Get current month bills
    const bills = await getParentCurrentMonthBills(parentId);

    console.log(`Found ${bills.length} bills for current month`);

    // Get count of unique/distinct classes
    const uniqueClassIds = new Set();
    bills.forEach(bill => {
      if (bill.class_ids && Array.isArray(bill.class_ids)) {
        bill.class_ids.forEach(classId => uniqueClassIds.add(classId));
      }
    });

    const summary = {
      totalBills: bills.length,
      totalTransactions: bills.length, // Total billing records
      totalClasses: uniqueClassIds.size, // Count of distinct classes
      totalAmount: bills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      paidAmount: bills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      unpaidAmount: bills
        .filter(bill => bill.status === 'unpaid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      billsByStatus: {
        paid: bills.filter(bill => bill.status === 'paid').length,
        unpaid: bills.filter(bill => bill.status === 'unpaid').length,
        cancelled: bills.filter(bill => bill.status === 'cancelled').length
      }
    };

    res.json({
      success: true,
      data: {
        bills,
        summary,
        month: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      }
    });
  } catch (error) {
    console.error('Error fetching current month bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/parent-billing/all
 * @desc    Get all bills for parent (with pagination)
 * @access  Private (Parent)
 */
router.get('/all', auth(['parent']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'month_year',
      sortOrder = 'desc'
    } = req.query;

    const parentId = req.user.id;

    // Build where clause
    const where = { parent_id: parentId };

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      where.status = { [Op.in]: statusArray };
    }

    // Get total count
    const total = await ClassBilling.count({ where });

    // Get paginated bills
    const bills = await ClassBilling.findAll({
      where,
      attributes: {
        include: ['student_id', 'parent_id', 'month_year', 'total_classes_count', 'amount', 'currency', 'status', 'billing_generated_date', 'due_date', 'class_ids', 'notes', 'createdAt', 'updatedAt']
      },
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      raw: false
    });

    // Manually fetch student details for each bill
    const enrichedBills = await Promise.all(bills.map(async (bill) => {
      const billData = bill.toJSON();
      
      // Fetch student details
      if (billData.student_id) {
        try {
          const student = await User.findByPk(billData.student_id, {
            attributes: ['id', 'firstName', 'lastName', 'email']
          });
          billData.student = student;
        } catch (err) {
          console.error('Error fetching student:', err);
        }
      }
      
      // If class_ids exist, fetch the class details
      if (billData.class_ids && billData.class_ids.length > 0) {
        try {
          const classes = await Class.findAll({
            where: { id: { [Op.in]: billData.class_ids } },
            attributes: ['id', 'title', 'subject', 'tutorId', 'classDate']
          });
          
          // Get tutor details for the first class (or most common)
          if (classes.length > 0 && classes[0].tutorId) {
            const tutor = await User.findByPk(classes[0].tutorId, {
              attributes: ['id', 'firstName', 'lastName', 'email']
            });
            billData.tutor = tutor;
            billData.tutorId = tutor;
            billData.classes = classes;
            billData.classTitle = classes[0].title || 'Multiple Classes';
            
            // Fetch subject name if subject is an ID
            let subjectName = classes[0].subject || 'Multiple Subjects';
            if (classes[0].subject) {
              try {
                const Subject = require('../models/sequelize/Subject');
                const subjectObj = await Subject.findByPk(classes[0].subject, {
                  attributes: ['id', 'subjectName', 'subjectCode']
                });
                if (subjectObj) {
                  subjectName = subjectObj.subjectName || subjectObj.subjectCode || subjectName;
                }
              } catch (subjectErr) {
                console.error('Error fetching subject:', subjectErr);
                // Fallback to the original subject value
              }
            }
            billData.subject = subjectName;
          }
        } catch (err) {
          console.error('Error enriching bill with class details:', err);
        }
      }
      
      return billData;
    }));

    // Calculate summary stats
    // Get count of unique/distinct classes
    const uniqueClassIds = new Set();
    enrichedBills.forEach(bill => {
      if (bill.class_ids && Array.isArray(bill.class_ids)) {
        bill.class_ids.forEach(classId => uniqueClassIds.add(classId));
      }
    });

    const summary = {
      totalBills: total,
      totalTransactions: total, // Total billing records
      totalClasses: uniqueClassIds.size, // Count of distinct classes
      totalAmount: enrichedBills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      paidAmount: enrichedBills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      unpaidAmount: enrichedBills
        .filter(bill => bill.status === 'unpaid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0)
    };

    res.json({
      success: true,
      data: {
        bills: enrichedBills,
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
    console.error('Error fetching all parent bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/parent-billing/:billId
 * @desc    Get specific bill details
 * @access  Private (Parent, Admin)
 */
router.get('/:billId', auth(['parent', 'admin', 'superadmin']), async (req, res) => {
  try {
    const { billId } = req.params;
    const parentId = req.user.id;

    const bill = await ClassBilling.findByPk(billId, {
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'parent',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Check authorization - parents can only see their own bills
    if (req.user.role === 'parent' && bill.parent_id !== parentId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: bill
    });
  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bill details',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/parent-billing/month/:monthYear
 * @desc    Get bills for specific month (format: YYYY-MM)
 * @access  Private (Parent)
 */
router.get('/month/:monthYear', auth(['parent']), async (req, res) => {
  try {
    const { monthYear } = req.params;
    const parentId = req.user.id;

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(monthYear)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month format. Use YYYY-MM (e.g., 2025-11)'
      });
    }

    const bills = await ClassBilling.findAll({
      where: {
        parent_id: parentId,
        month_year: monthYear
      },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const summary = {
      month: monthYear,
      totalBills: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      totalClasses: bills.reduce((sum, bill) => sum + (bill.total_classes_count || 0), 0),
      paidAmount: bills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      unpaidAmount: bills
        .filter(bill => bill.status === 'unpaid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0)
    };

    res.json({
      success: true,
      data: {
        bills,
        summary
      }
    });
  } catch (error) {
    console.error('Error fetching month bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/parent-billing/:billId/pay
 * @desc    Mark a bill as paid
 * @access  Private (Parent, Admin)
 */
router.post('/:billId/pay', auth(['parent', 'admin']), async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentMethod = 'card', paymentReference } = req.body;
    const parentId = req.user.id;

    // Verify bill exists and belongs to parent (if parent)
    const bill = await ClassBilling.findByPk(billId);
    
    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    if (req.user.role === 'parent' && bill.parent_id !== parentId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: This bill does not belong to you'
      });
    }

    // Update bill status to paid
    bill.status = 'paid';
    await bill.save();

    res.json({
      success: true,
      message: 'Bill marked as paid successfully',
      data: bill
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
