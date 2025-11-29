const mongoose = require('mongoose');

const sessionHistorySchema = new mongoose.Schema({
  // Reference to the class
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },

  // Meeting information
  meetingId: {
    type: String,
    required: true
  },

  // Session timing
  sessionDate: {
    type: Date,
    required: true
  },

  scheduledStartTime: {
    type: Date,
    required: true
  },

  scheduledEndTime: {
    type: Date,
    required: true
  },

  // Actual meeting tracking
  actualStartTime: {
    type: Date,
    default: null // Set when first person joins
  },

  actualEndTime: {
    type: Date,
    default: null // Set when last person leaves
  },

  // Participants tracking
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['student', 'tutor'],
      required: true
    },
    joinTime: {
      type: Date
    },
    leaveTime: {
      type: Date
    },
    duration: {
      type: Number // Duration in minutes
    }
  }],

  // Session status
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },

  // Additional session data
  totalDuration: {
    type: Number // Total meeting duration in minutes
  },

  notes: {
    type: String,
    trim: true
  },

  // Recording information (if available)
  recordingUrl: {
    type: String
  },

  // Attendance summary
  attendanceSummary: {
    totalParticipants: Number,
    studentsPresent: Number,
    tutorsPresent: Number
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
sessionHistorySchema.index({ classId: 1, sessionDate: -1 });
sessionHistorySchema.index({ meetingId: 1 });
sessionHistorySchema.index({ sessionDate: -1 });

// Virtual for calculating session duration
sessionHistorySchema.virtual('calculatedDuration').get(function() {
  if (this.actualStartTime && this.actualEndTime) {
    return Math.round((this.actualEndTime - this.actualStartTime) / (1000 * 60));
  }
  return null;
});

// Method to add participant
sessionHistorySchema.methods.addParticipant = function(userId, role) {
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  
  if (!existingParticipant) {
    this.participants.push({
      userId,
      role,
      joinTime: new Date()
    });
  }
  
  // Update actual start time if this is the first participant
  if (!this.actualStartTime) {
    this.actualStartTime = new Date();
    this.status = 'in-progress';
  }
  
  return this.save();
};

// Method to remove participant
sessionHistorySchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  
  if (participant && !participant.leaveTime) {
    participant.leaveTime = new Date();
    
    // Calculate duration for this participant
    if (participant.joinTime) {
      participant.duration = Math.round((participant.leaveTime - participant.joinTime) / (1000 * 60));
    }
  }
  
  // Check if all participants have left
  const activeParticipants = this.participants.filter(p => !p.leaveTime);
  if (activeParticipants.length === 0) {
    this.actualEndTime = new Date();
    this.status = 'completed';
    this.totalDuration = this.calculatedDuration;
    
    // Update attendance summary
    this.attendanceSummary = {
      totalParticipants: this.participants.length,
      studentsPresent: this.participants.filter(p => p.role === 'student').length,
      tutorsPresent: this.participants.filter(p => p.role === 'tutor').length
    };
  }
  
  return this.save();
};

// Method to check if session can be joined
sessionHistorySchema.methods.canJoin = function(joinWindowMinutes = 15) {
  const now = new Date();
  const joinTime = new Date(this.scheduledStartTime.getTime() - joinWindowMinutes * 60000);
  const endTime = new Date(this.scheduledEndTime.getTime() + joinWindowMinutes * 60000);
  
  return now >= joinTime && now <= endTime && this.status !== 'completed';
};

module.exports = mongoose.model('SessionHistory', sessionHistorySchema);