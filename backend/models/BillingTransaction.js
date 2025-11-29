const mongoose = require('mongoose');

const billingTransactionSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingSession',
    required: true
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SessionParticipant',
    required: true
  },
  
  // Core billing information
  transactionType: {
    type: String,
    enum: ['charge', 'credit', 'refund', 'adjustment'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Billing period
  billingPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  
  // Rate and time calculations
  hourlyRate: {
    type: Number,
    required: true
  },
  billableMinutes: {
    type: Number,
    required: true
  },
  actualMinutes: {
    type: Number,
    required: true
  },
  
  // Discounts and adjustments
  discounts: [{
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'promotional']
    },
    value: Number,
    reason: String,
    appliedAmount: Number
  }],
  adjustments: [{
    type: {
      type: String,
      enum: ['late_penalty', 'technical_issue', 'quality_bonus', 'manual']
    },
    amount: Number,
    reason: String,
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'cash', 'wallet', 'other'],
    default: null
  },
  paymentReference: {
    type: String,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  
  // Parent/Student billing
  billedTo: {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    billingEmail: String,
    billingName: String
  },
  
  // Invoice information
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  
  // Tax and fees
  taxRate: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  platformFee: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Approval and processing
  status: {
    type: String,
    enum: ['draft', 'approved', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  
  // Notes and metadata
  description: {
    type: String,
    required: true
  },
  internalNotes: {
    type: String,
    default: ''
  },
  customerNotes: {
    type: String,
    default: ''
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
billingTransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate unique invoice number
billingTransactionSchema.pre('save', function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.invoiceNumber = `INV-${timestamp}-${random}`;
  }
  next();
});

// Calculate total amount including tax and fees
billingTransactionSchema.methods.calculateTotalAmount = function() {
  let subtotal = this.amount;
  
  // Apply discounts
  this.discounts.forEach(discount => {
    if (discount.type === 'percentage') {
      discount.appliedAmount = subtotal * (discount.value / 100);
    } else if (discount.type === 'fixed') {
      discount.appliedAmount = discount.value;
    }
    subtotal -= discount.appliedAmount;
  });
  
  // Apply adjustments
  this.adjustments.forEach(adjustment => {
    subtotal += adjustment.amount;
  });
  
  // Calculate tax
  this.taxAmount = subtotal * (this.taxRate / 100);
  
  // Calculate final total
  this.totalAmount = subtotal + this.taxAmount + this.platformFee;
  
  return this.totalAmount;
};

// Apply discount
billingTransactionSchema.methods.applyDiscount = function(discountType, value, reason) {
  const discount = {
    type: discountType,
    value: value,
    reason: reason,
    appliedAmount: 0
  };
  
  this.discounts.push(discount);
  this.calculateTotalAmount();
  
  return discount;
};

// Apply adjustment
billingTransactionSchema.methods.applyAdjustment = function(adjustmentType, amount, reason, appliedBy) {
  const adjustment = {
    type: adjustmentType,
    amount: amount,
    reason: reason,
    appliedBy: appliedBy,
    appliedAt: new Date()
  };
  
  this.adjustments.push(adjustment);
  this.calculateTotalAmount();
  
  return adjustment;
};

// Mark as paid
billingTransactionSchema.methods.markAsPaid = function(paymentMethod, paymentReference) {
  this.paymentStatus = 'paid';
  this.status = 'paid';
  this.paymentMethod = paymentMethod;
  this.paymentReference = paymentReference;
  this.paidAt = new Date();
  
  return this;
};

// Generate billing summary
billingTransactionSchema.methods.getBillingSummary = function() {
  return {
    invoiceNumber: this.invoiceNumber,
    amount: this.amount,
    discounts: this.discounts.reduce((sum, d) => sum + (d.appliedAmount || 0), 0),
    adjustments: this.adjustments.reduce((sum, a) => sum + a.amount, 0),
    taxAmount: this.taxAmount,
    platformFee: this.platformFee,
    totalAmount: this.totalAmount,
    paymentStatus: this.paymentStatus,
    dueDate: this.dueDate,
    billableMinutes: this.billableMinutes,
    hourlyRate: this.hourlyRate
  };
};

// Static method to get billing report for a period
billingTransactionSchema.statics.getBillingReport = async function(startDate, endDate, filters = {}) {
  const matchStage = {
    'billingPeriod.startDate': { $gte: new Date(startDate) },
    'billingPeriod.endDate': { $lte: new Date(endDate) }
  };
  
  // Apply additional filters
  if (filters.status) matchStage.status = filters.status;
  if (filters.paymentStatus) matchStage.paymentStatus = filters.paymentStatus;
  if (filters.parentId) {
    // Validate ObjectId before creating
    if (mongoose.Types.ObjectId.isValid(filters.parentId)) {
      matchStage['billedTo.parentId'] = new mongoose.Types.ObjectId(filters.parentId);
    } else {
      // If invalid ObjectId, return empty result
      return {
        totalTransactions: 0,
        totalAmount: 0,
        totalBillableMinutes: 0,
        paidAmount: 0,
        pendingAmount: 0
      };
    }
  }
  
  const report = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        totalBillableMinutes: { $sum: '$billableMinutes' },
        paidAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0]
          }
        },
        pendingAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'pending'] }, '$totalAmount', 0]
          }
        },
        byStatus: {
          $push: {
            status: '$status',
            amount: '$totalAmount'
          }
        }
      }
    }
  ]);
  
  return report[0] || {
    totalTransactions: 0,
    totalAmount: 0,
    totalBillableMinutes: 0,
    paidAmount: 0,
    pendingAmount: 0
  };
};

module.exports = mongoose.model('BillingTransaction', billingTransactionSchema);
