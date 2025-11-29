const mongoose = require('mongoose');
const type = require('mongoose/lib/schema/operators/type');

const sessionParticipantSchema = new mongoose.Schema({
  participant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meeting_class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  participant_type: {
    type: String,
    enum: ['tutor', 'student'],
    required: true
  },
  
  // Agora integration
  agoraUid: {
    type: Number,
    default: null
  },
  
  // Session timing
  joined_at: {
    type: Date,
    default: null
  },
  ended_at: {
    type: Date,
    default: null
  },

   title: {
    type: String,
    default: ''
  },

  start_time: {
    type: String,
    default: ''
  },

  duration: {
    type: Number, // in minutes (calculated when ended)
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  
  // Billing and Payment Information
  billingAmount: {
    type: Number, // total amount to be billed
    default: 0
  },
  currency: {
    type: String,
    default: 'psd'
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  totalPayable: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed', 'Deferred'],
    default: 'Deferred.'
  },
  paymentMethod: {
    type: String,
    default: null
  },
  paymentDate: {
    type: Date,
    default: null
  },
  invoiceId: {
    type: String,
    default: null
  },
  
  // Additional Fields
  notes: {
    type: String,
    default: ''
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
sessionParticipantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate session duration when session ends
sessionParticipantSchema.methods.calculateDuration = function() {
  if (this.joinedAt && this.endedAt) {
    const durationMs = this.endedAt - this.joinedAt;
    this.duration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
  }
  return this.duration;
};

// Calculate billing amount based on hourly rate and duration in minutes
sessionParticipantSchema.methods.calculateBillingAmount = function(hourlyRate) {
  if (this.duration && hourlyRate) {
    // Convert duration from minutes to hours and multiply by hourly rate
    this.billingAmount = (this.duration / 60) * hourlyRate;
  }
  return this.billingAmount;
};

// Calculate total payable amount
sessionParticipantSchema.methods.calculateTotalPayable = function() {
  this.totalPayable = this.billingAmount - this.discountAmount + this.taxAmount;
  return this.totalPayable;
};

// Method to check for duplicate entry on same day
sessionParticipantSchema.statics.findTodayEntry = async function(participantId, meetingClassId, date = new Date()) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  
  return await this.findOne({
    participant_id: participantId,
    meeting_class_id: meetingClassId,
    date: { $gte: startOfDay, $lt: endOfDay }
  });
};

module.exports = mongoose.model('SessionParticipant', sessionParticipantSchema);
