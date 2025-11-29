const mongoose = require('mongoose');

const classBillingTransactionSchema = new mongoose.Schema({
  // Class and participant information
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Class details
  subject: {
    type: String,
    required: true,
    index: true
  },
  
  // Payment status
  status: {
    type: String,
    enum: ['unpaid', 'paid', 'democlass', 'void', 'canceled'],
    default: 'unpaid',
    index: true
  },
  
  // Amount and currency
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Scheduling information
  scheduledStart: {
    type: Date,
    required: true,
    index: true
  },
  scheduledEnd: {
    type: Date,
    required: true
  },
  timeZone: {
    type: String,
    default: 'UTC'
  },
  
  // Payment information
  paidAt: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'wallet', 'external', 'credit'],
    required: false
  },
  paymentReference: {
    type: String,
    required: false
  },
  
  // Rate information
  hourlyRate: {
    type: Number,
    default: 0
  },
  durationMinutes: {
    type: Number,
    required: true
  },
  
  // Additional information
  notes: {
    type: String,
    default: ''
  },
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for efficient querying
classBillingTransactionSchema.index({ 
  studentId: 1, 
  status: 1, 
  subject: 1, 
  scheduledStart: -1 
});
classBillingTransactionSchema.index({ 
  parentId: 1, 
  status: 1, 
  scheduledStart: -1 
});
classBillingTransactionSchema.index({ 
  tutorId: 1, 
  scheduledStart: -1 
});
classBillingTransactionSchema.index({ 
  classId: 1, 
  studentId: 1 
}, { 
  unique: true 
});

// Methods
classBillingTransactionSchema.methods.markAsPaid = function(paymentMethod, paymentReference, updatedBy) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.paymentMethod = paymentMethod;
  this.paymentReference = paymentReference;
  this.updatedBy = updatedBy;
  return this.save();
};

classBillingTransactionSchema.methods.markAsVoid = function(updatedBy, reason) {
  this.status = 'void';
  this.notes = reason ? `Voided: ${reason}` : 'Voided';
  this.updatedBy = updatedBy;
  return this.save();
};

// Static methods
classBillingTransactionSchema.statics.createForClass = async function(classData, paymentStatus = 'unpaid') {
  const Class = require('./Class');
  const User = require('./User');
  
  // Get class details
  const classDoc = await Class.findById(classData.classId || classData._id)
    .populate('tutor', 'firstName lastName tutorProfile')
    .populate('students', 'firstName lastName studentProfile');
  
  if (!classDoc) {
    throw new Error('Class not found');
  }
  
  // Get subject name - it might be stored directly or as ObjectId
  let subjectName = 'General';
  if (classDoc.subject) {
    if (typeof classDoc.subject === 'string') {
      // If it's a string, it's the subject name
      subjectName = classDoc.subject;
    } else {
      // If it's an ObjectId, try to populate or get the name
      try {
        const Subject = require('./Subject');
        const subjectDoc = await Subject.findById(classDoc.subject);
        subjectName = subjectDoc?.subjectName || subjectDoc?.name || 'General';
      } catch (err) {
        console.warn('Could not fetch subject name:', err);
        subjectName = 'General';
      }
    }
  }
  
  // Calculate class duration and scheduled times
  const startTime = classDoc.startTime; // Format: "HH:MM"
  const duration = classDoc.customDuration || classDoc.duration; // in minutes
  
  // For one-time classes, use classDate; for recurring, we'll need to handle per session
  let scheduledStart, scheduledEnd;
  
  if (classDoc.scheduleType === 'one-time') {
    const [hours, minutes] = startTime.split(':').map(Number);
    scheduledStart = new Date(classDoc.classDate);
    scheduledStart.setHours(hours, minutes, 0, 0);
    scheduledEnd = new Date(scheduledStart.getTime() + (duration * 60 * 1000));
  } else {
    // For recurring classes, we'll create transactions when sessions are actually scheduled
    throw new Error('Use createForRecurringClassSession for recurring classes');
  }
  
  const transactions = [];
  
  console.log('Creating transactions for', classDoc.students.length, 'students');
  
  // Create transaction for each student
  for (const student of classDoc.students) {
    console.log('Processing student:', student._id, student.firstName, student.lastName);
    
    // Use the class amount directly (no rate calculation needed)
    const transactionAmount = paymentStatus === 'democlass' ? 0 : classDoc.amount;
    
    console.log('Transaction details:', {
      classId: classDoc._id,
      tutorId: classDoc.tutor._id,
      studentId: student._id,
      parentId: student.studentProfile?.parentId,
      subject: subjectName,
      status: paymentStatus,
      amount: transactionAmount,
      currency: classDoc.currency,
      duration
    });
    
    const transaction = new this({
      classId: classDoc._id,
      tutorId: classDoc.tutor._id,
      studentId: student._id,
      parentId: student.studentProfile?.parentId,
      subject: subjectName,
      status: paymentStatus,
      amount: transactionAmount,
      currency: classDoc.currency,
      scheduledStart,
      scheduledEnd,
      timeZone: 'UTC', // Should be configurable
      hourlyRate: 0, // Not used when amount is set directly
      durationMinutes: duration,
      createdBy: classData.createdBy
    });
    
    transactions.push(transaction);
  }
  
  console.log('Attempting to save', transactions.length, 'transactions');
  
  // Save all transactions
  const savedTransactions = await this.insertMany(transactions);
  console.log('Successfully saved', savedTransactions.length, 'transactions');
  
  return savedTransactions;
};

classBillingTransactionSchema.statics.createForRecurringClassSession = async function(classDoc, sessionDate, paymentStatus = 'unpaid', createdBy) {
  const User = require('./User');
  
  // Calculate session times
  const [hours, minutes] = classDoc.startTime.split(':').map(Number);
  const scheduledStart = new Date(sessionDate);
  scheduledStart.setHours(hours, minutes, 0, 0);
  
  const duration = classDoc.customDuration || classDoc.duration;
  const scheduledEnd = new Date(scheduledStart.getTime() + (duration * 60 * 1000));
  
  const transactions = [];
  
  // Populate students if needed
  if (!classDoc.populated('students')) {
    await classDoc.populate('students', 'firstName lastName studentProfile');
  }
  if (!classDoc.populated('tutor')) {
    await classDoc.populate('tutor', 'firstName lastName tutorProfile');
  }
  
  // Get subject name
  let subjectName = 'General';
  if (classDoc.subject) {
    if (typeof classDoc.subject === 'string') {
      subjectName = classDoc.subject;
    } else {
      try {
        const Subject = require('./Subject');
        const subjectDoc = await Subject.findById(classDoc.subject);
        subjectName = subjectDoc?.subjectName || subjectDoc?.name || 'General';
      } catch (err) {
        console.warn('Could not fetch subject name:', err);
        subjectName = 'General';
      }
    }
  }
  
  // Create transaction for each student
  for (const student of classDoc.students) {
    // Use the class amount directly (no rate calculation needed)
    const transactionAmount = paymentStatus === 'democlass' ? 0 : classDoc.amount;
    
    const transaction = new this({
      classId: classDoc._id,
      tutorId: classDoc.tutor._id,
      studentId: student._id,
      parentId: student.studentProfile?.parentId,
      subject: subjectName,
      status: paymentStatus,
      amount: transactionAmount,
      currency: classDoc.currency,
      scheduledStart,
      scheduledEnd,
      timeZone: 'UTC',
      hourlyRate: 0, // Not used when amount is set directly
      durationMinutes: duration,
      createdBy
    });
    
    transactions.push(transaction);
  }
  
  return await this.insertMany(transactions);
};

classBillingTransactionSchema.statics.updateForClassChange = async function(classId, newPaymentStatus, updatedBy) {
  // Only update unpaid and democlass transactions, leave paid ones alone
  return await this.updateMany(
    { 
      classId, 
      status: { $in: ['unpaid', 'democlass'] } 
    },
    { 
      status: newPaymentStatus,
      updatedBy,
      updatedAt: new Date()
    }
  );
};

classBillingTransactionSchema.statics.getBillingReport = async function(filters = {}) {
  const matchStage = {};
  
  // Apply filters
  if (filters.status && Array.isArray(filters.status)) {
    matchStage.status = { $in: filters.status };
  } else if (filters.status) {
    matchStage.status = filters.status;
  }
  
  if (filters.subject && Array.isArray(filters.subject)) {
    matchStage.subject = { $in: filters.subject };
  } else if (filters.subject) {
    matchStage.subject = filters.subject;
  }
  
  if (filters.dateFrom || filters.dateTo) {
    matchStage.scheduledStart = {};
    if (filters.dateFrom) {
      matchStage.scheduledStart.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      matchStage.scheduledStart.$lte = new Date(filters.dateTo);
    }
  }
  
  if (filters.tutorId) {
    matchStage.tutorId = filters.tutorId;
  }
  
  if (filters.studentId) {
    matchStage.studentId = filters.studentId;
  }
  
  if (filters.parentId) {
    matchStage.parentId = filters.parentId;
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        paidAmount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0]
          }
        },
        unpaidAmount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'unpaid'] }, '$amount', 0]
          }
        },
        democlass: {
          $sum: {
            $cond: [{ $eq: ['$status', 'democlass'] }, 1, 0]
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  
  return result[0] || {
    totalTransactions: 0,
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    democlass: 0
  };
};

module.exports = mongoose.model('ClassBillingTransaction', classBillingTransactionSchema);