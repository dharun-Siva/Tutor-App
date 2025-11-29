/**
 * Admin Billing Management Routes - Handle bill management tasks
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config/database/config');
const { DataTypes } = require('sequelize');

// Import models and services
const User = require('../models/sequelize/user');
const Class = require('../models/sequelize/Class');
const Subject = require('../models/sequelize/Subject');
const ClassBilling = require('../models/sequelize/ClassBilling')(sequelize, DataTypes);
const {
  getParentBills,
  handleClassDeletion,
  generateOrUpdateBill
} = require('../services/billingService');
const auth = require('../middleware/auth-postgres');

// Import SessionParticipant model and set up associations
const SessionParticipantModel = require('../models/sequelize/SessionParticipant')(sequelize, DataTypes);

// Set up associations for SessionParticipant
if (typeof SessionParticipantModel.associations.participant === 'undefined') {
  SessionParticipantModel.belongsTo(User, { foreignKey: 'participant_id', as: 'participant' });
}
if (typeof SessionParticipantModel.associations.classObj === 'undefined') {
  SessionParticipantModel.belongsTo(Class, { foreignKey: 'meeting_class_id', as: 'classObj' });
}

/**
 * @route   GET /api/admin-billing/all
 * @desc    Get all bills with filters (Admin only)
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/all', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      monthYear,
      parentId,
      studentId,
      sortBy = 'billing_generated_date',
      sortOrder = 'desc'
    } = req.query;

    const where = {};

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      where.status = { [Op.in]: statusArray };
    }

    if (monthYear) {
      where.month_year = monthYear;
    }

    if (parentId) {
      where.parent_id = parentId;
    }

    if (studentId) {
      where.student_id = studentId;
    }

    const total = await ClassBilling.count({ where });

    const bills = await ClassBilling.findAll({
      where,
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
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      raw: false
    });

    const summary = {
      totalBills: total,
      totalAmount: bills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      paidAmount: bills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      unpaidAmount: bills
        .filter(bill => bill.status === 'unpaid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      byStatus: {
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
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bills',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/admin-billing/student-dashboard/all
 * @desc    Get all bills for student billing dashboard (with enriched data)
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/student-dashboard/all', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'billing_generated_date',
      sortOrder = 'desc'
    } = req.query;

    const where = {};

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
        include: ['id', 'student_id', 'parent_id', 'month_year', 'total_classes_count', 'amount', 'currency', 'status', 'billing_generated_date', 'due_date', 'class_ids', 'notes', 'createdAt', 'updatedAt']
      },
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      raw: false
    });

    // Manually fetch and enrich with student, class, tutor, and subject details
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
    const summary = {
      totalBills: total,
      totalAmount: enrichedBills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      paidAmount: enrichedBills
        .filter(bill => bill.status === 'paid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      unpaidAmount: enrichedBills
        .filter(bill => bill.status === 'unpaid')
        .reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
      demoClasses: 0  // Can be calculated if needed
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
    console.error('Error fetching student dashboard bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/admin-billing/:billId/mark-paid
 * @desc    Mark a bill as paid (Admin action)
 * @access  Private (Admin, SuperAdmin)
 */
router.put('/:billId/mark-paid', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { billId } = req.params;
    const { notes, paidDate } = req.body;

    const bill = await ClassBilling.findByPk(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    // Update bill status
    bill.status = 'paid';
    if (notes) {
      bill.notes = (bill.notes || '') + `\nMarked paid on ${new Date().toISOString()}: ${notes}`;
    }

    await bill.save();

    console.log(`✓ Bill ${billId} marked as paid`);

    res.json({
      success: true,
      message: 'Bill marked as paid',
      data: bill
    });
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bill',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/admin-billing/:billId/mark-unpaid
 * @desc    Mark a bill as unpaid (Admin action)
 * @access  Private (Admin, SuperAdmin)
 */
router.put('/:billId/mark-unpaid', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { billId } = req.params;
    const { notes } = req.body;

    const bill = await ClassBilling.findByPk(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    bill.status = 'unpaid';
    if (notes) {
      bill.notes = (bill.notes || '') + `\nMarked unpaid on ${new Date().toISOString()}: ${notes}`;
    }

    await bill.save();

    console.log(`✓ Bill ${billId} marked as unpaid`);

    res.json({
      success: true,
      message: 'Bill marked as unpaid',
      data: bill
    });
  } catch (error) {
    console.error('Error marking bill as unpaid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bill',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/admin-billing/:billId/add-note
 * @desc    Add notes to a bill
 * @access  Private (Admin, SuperAdmin)
 */
router.put('/:billId/add-note', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { billId } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        error: 'Note text is required'
      });
    }

    const bill = await ClassBilling.findByPk(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: 'Bill not found'
      });
    }

    bill.notes = (bill.notes || '') + `\n[${new Date().toISOString()}] ${note}`;
    await bill.save();

    console.log(`✓ Note added to bill ${billId}`);

    res.json({
      success: true,
      message: 'Note added to bill',
      data: bill
    });
  } catch (error) {
    console.error('Error adding note to bill:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add note',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/admin-billing/generate-for-month
 * @desc    Manually generate bills for a specific month
 * @access  Private (Admin, SuperAdmin)
 */
router.post('/generate-for-month', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { monthYear } = req.body;

    if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month format. Use YYYY-MM (e.g., 2025-11)'
      });
    }

    // Import the bill generation job
    const { autoGenerateBillsForMonth } = require('../services/billGenerationJobs');

    // Trigger bill generation
    const result = await autoGenerateBillsForMonth(monthYear);

    res.json({
      success: true,
      message: `Bills generated for ${monthYear}`,
      data: result
    });
  } catch (error) {
    console.error('Error generating bills manually:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate bills',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/admin-billing/generate-next-month-bills
 * @desc    Generate bills for NEXT MONTH for all active classes (when system date changes to >= 25)
 * @access  Private (Admin, SuperAdmin)
 */
router.post('/generate-next-month-bills', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const today = new Date();
    const todayDay = today.getDate();

    console.log('\n🔔 MANUAL TRIGGER: Generate Next Month Bills');
    console.log(`Current date: ${today.toISOString()}`);
    console.log(`Current day: ${todayDay}`);

    if (todayDay < 25) {
      return res.status(400).json({
        success: false,
        error: `Current day is ${todayDay}. Bills are only generated for next month when day >= 25.`
      });
    }

    // Get next month
    const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthYear = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

    console.log(`\n📅 Generating bills for next month: ${nextMonthYear}`);

    // Import the bill generation job which handles all classes for a month
    const { autoGenerateBillsForMonth } = require('../services/billGenerationJobs');

    // Trigger bill generation for next month
    const result = await autoGenerateBillsForMonth(nextMonthYear);

    console.log(`\n========== RESULT ==========`);
    console.log(`✅ Bills generated successfully`);

    res.json({
      success: true,
      message: `Next month (${nextMonthYear}) bills generated`,
      data: result
    });

  } catch (error) {
    console.error('Error generating next month bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate next month bills',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/admin-billing/handle-class-deletion
 * @desc    Handle the deletion of a class and recalculate affected bills
 * @access  Private (Admin, SuperAdmin)
 */
router.post('/handle-class-deletion', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { classId } = req.body;

    if (!classId) {
      return res.status(400).json({
        success: false,
        error: 'Class ID is required'
      });
    }

    // Handle the class deletion and recalculate bills
    const affectedBills = await handleClassDeletion(classId);

    console.log(`\n✓ Handled deletion of class ${classId}`);
    console.log(`✓ Updated ${affectedBills.length} affected bills\n`);

    res.json({
      success: true,
      message: `Updated ${affectedBills.length} bills affected by class deletion`,
      data: {
        classId,
        affectedBillsCount: affectedBills.length,
        affectedBills
      }
    });
  } catch (error) {
    console.error('Error handling class deletion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle class deletion',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/admin-billing/parent/:parentId/bills
 * @desc    Get all bills for a specific parent
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/parent/:parentId/bills', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { parentId } = req.params;

    const bills = await getParentBills(parentId);

    const summary = {
      totalBills: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0),
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
    console.error('Error fetching parent bills:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parent bills',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/admin-billing/tutor-billing/all
 * @desc    Get all tutor billing data from session participants
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/tutor-billing/all', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'joined_at',
      sortOrder = 'desc'
    } = req.query;

    const SessionParticipant = SessionParticipantModel;

    // Build where clause
    const where = {
      participant_type: 'tutor',
      total_payable: { [Op.gt]: 0 }
    };

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      where.payment_status = { [Op.in]: statusArray };
    }

    // Get total count
    const total = await SessionParticipant.count({ where });

    // Get paginated tutor billing records
    const tutorBillings = await SessionParticipant.findAll({
      where,
      attributes: [
        'id', 'participant_id', 'meeting_class_id', 'participant_type',
        'joined_at', 'ended_at', 'duration', 'title', 'start_time',
        'billing_amount', 'discount_amount', 'tax_amount', 'total_payable',
        'payment_status', 'currency', 'classes_paymenttype'
      ],
      include: [
        {
          model: User,
          as: 'participant',
          attributes: ['id', 'firstName', 'lastName', 'email', 'tutor_profile']
        },
        {
          model: Class,
          as: 'classObj',
          attributes: ['id', 'title', 'subject', 'duration', 'scheduleType', 'centerId']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      raw: false
    });

    // Enrich the data and fetch subject names
    const enrichedBillings = await Promise.all(tutorBillings.map(async (billing) => {
      const billingData = billing.toJSON ? billing.toJSON() : billing;
      const tutor = billingData.participant || {};
      const classObj = billingData.classObj || {};
      
      // Fetch subject name if subject ID exists
      let subjectName = 'N/A';
      if (classObj.subject) {
        try {
          const subjectRecord = await Subject.findByPk(classObj.subject, {
            attributes: ['id', 'subjectName']
          });
          subjectName = subjectRecord?.subjectName || classObj.subject;
        } catch (err) {
          console.error(`Error fetching subject ${classObj.subject}:`, err);
          subjectName = classObj.subject;
        }
      }
      
      return {
        id: billingData.id,
        _id: billingData.id,
        tutorId: billingData.participant_id,
        tutorName: `${tutor.firstName || ''} ${tutor.lastName || ''}`.trim() || 'Unknown',
        tutorEmail: tutor.email,
        hourlyRate: tutor.tutor_profile?.hourlyRate || 0,
        className: classObj.title || 'N/A',
        subject: classObj.subject || 'N/A',
        subjectName: subjectName,
        duration: billingData.duration,
        durationMinutes: billingData.duration,
        paymentAmount: parseFloat(billingData.total_payable) || 0,
        totalPayable: parseFloat(billingData.total_payable) || 0,
        currency: billingData.currency || 'USD',
        paymentStatus: billingData.payment_status || 'Pending',
        payment_status: billingData.payment_status || 'Pending',
        paymentType: billingData.classes_paymenttype || 'N/A',
        joined_at: billingData.joined_at,
        ended_at: billingData.ended_at,
        billingAmount: parseFloat(billingData.billing_amount) || 0,
        discountAmount: parseFloat(billingData.discount_amount) || 0,
        taxAmount: parseFloat(billingData.tax_amount) || 0,
        classObj: {
          title: classObj.title,
          subject: classObj.subject,
          subjectName: subjectName,
          scheduleType: classObj.scheduleType,
          paymentType: billingData.classes_paymenttype || 'N/A'
        },
        participant_type: billingData.participant_type
      };
    }));

    // Calculate summary
    const summary = {
      totalBillings: total,
      totalAmount: enrichedBillings.reduce((sum, bill) => sum + (bill.paymentAmount || 0), 0),
      paidAmount: enrichedBillings
        .filter(bill => bill.paymentStatus?.toLowerCase() === 'paid')
        .reduce((sum, bill) => sum + (bill.paymentAmount || 0), 0),
      pendingAmount: enrichedBillings
        .filter(bill => bill.paymentStatus?.toLowerCase() === 'pending')
        .reduce((sum, bill) => sum + (bill.paymentAmount || 0), 0),
      byStatus: {
        Paid: enrichedBillings.filter(bill => bill.paymentStatus?.toLowerCase() === 'paid').length,
        Pending: enrichedBillings.filter(bill => bill.paymentStatus?.toLowerCase() === 'pending').length,
        Failed: enrichedBillings.filter(bill => bill.paymentStatus?.toLowerCase() === 'failed').length
      }
    };

    res.json({
      success: true,
      data: enrichedBillings,
      summary,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching tutor billing data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tutor billing information',
      details: error.message
    });
  }
});

module.exports = router;



