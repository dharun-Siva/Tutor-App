const mongoose = require('mongoose');

const meetingSessionSchema = new mongoose.Schema({
  // Participant references
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
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
  actualStartTime: {
    type: Date,
    default: null
  },
  actualEndTime: {
    type: Date,
    default: null
  },
  meetingLink: {
    type: String,
    required: true
  },
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'waiting', 'starting', 'in-progress', 'ending', 'completed', 'timeout', 'cancelled', 'technical_issue'],
    default: 'scheduled'
  },
  totalScheduledDuration: {
    type: Number, // in minutes
    required: true
  },
  totalActualDuration: {
    type: Number, // in minutes
    default: 0
  },
  
  // Billing related
  tutorRate: {
    type: Number,
    required: true
  },
  studentRate: {
    type: Number,
    required: true
  },
  billingStatus: {
    type: String,
    enum: ['pending', 'calculated', 'invoiced', 'paid'],
    default: 'pending'
  },
  
  // Session metadata
  notes: {
    type: String,
    default: ''
  },
  materials: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  homework: {
    type: String,
    default: ''
  },
  sessionRating: {
    tutorRating: {
      type: Number,
      min: 1,
      max: 5
    },
    studentRating: {
      type: Number,
      min: 1,
      max: 5
    },
    parentRating: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Meeting platform details
  platformType: {
    type: String,
    enum: ['google-meet', 'zoom', 'jitsi', 'custom', 'agora'],
    default: 'agora'
  },
  platformMeetingId: String,
  recordingUrl: String,
  
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
meetingSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate actual duration when session ends
meetingSessionSchema.methods.calculateActualDuration = function() {
  if (this.actualStartTime && this.actualEndTime) {
    const durationMs = this.actualEndTime - this.actualStartTime;
    this.totalActualDuration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
  }
  return this.totalActualDuration;
};

// Generate unique meeting ID
meetingSessionSchema.methods.generateMeetingId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  this.meetingId = `session-${timestamp}-${random}`;
  return this.meetingId;
};

// Generate meeting link based on platform
meetingSessionSchema.methods.generateMeetingLink = function() {
  if (!this.meetingId) {
    this.generateMeetingId();
  }
  
  // For now, generate Agora-based meeting links
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  this.meetingLink = `${baseUrl}/meeting/${this.meetingId}`;
  
  return this.meetingLink;
};

// Check if a participant can join the session
// Allow tutor or any student that is recorded as a participant for this session to join.
// This method is async because it may need to consult the SessionParticipant collection.
meetingSessionSchema.methods.canParticipantJoin = async function(participantId) {
  try {
    // Convert to strings for comparison
    const tutorId = this.tutorId ? this.tutorId.toString() : null;
    const studentId = this.studentId ? this.studentId.toString() : null;
    const participantIdStr = participantId.toString();

    if (participantIdStr === tutorId) return true;
    if (participantIdStr === studentId) return true;
    if (participantIdStr === tutorId) {
      console.log(`canParticipantJoin: allowed because participant is tutor (${participantIdStr}) for session ${this._id}`);
      return true;
    }
    if (participantIdStr === studentId) {
      console.log(`canParticipantJoin: allowed because participant matches session.studentId (${participantIdStr}) for session ${this._id}`);
      return true;
    }

    // Check if participant is listed in the related Class students
    try {
      const Class = require('./Class');
      if (this.classId) {
        const cls = await Class.findById(this.classId).select('students').lean();
        if (cls && Array.isArray(cls.students) && cls.students.map(String).includes(participantIdStr)) {
          console.log(`canParticipantJoin: allowed because participant is in Class.students (${participantIdStr}) for class ${this.classId}`);
          return true;
        }
      }
    } catch (err) {
      // non-fatal, continue to other checks
      console.warn('Could not verify class students in canParticipantJoin:', err.message || err);
    }

    // Fallback: check SessionParticipant records (supporting multiple field name variants)
    try {
      const SessionParticipant = require('./SessionParticipant');

      // Try camelCase sessionId/participantId (used in some places)
      let participantRecord = await SessionParticipant.findOne({ sessionId: this._id, participantId: participantId }).lean();
      if (participantRecord) {
        console.log(`canParticipantJoin: allowed because SessionParticipant record found (camelCase) for participant ${participantIdStr} session ${this._id}`);
        return true;
      }

      // Try snake_case participant_id / meeting_class_id
      participantRecord = await SessionParticipant.findOne({ participant_id: participantId, meeting_class_id: this.classId }).lean();
      if (participantRecord) {
        console.log(`canParticipantJoin: allowed because SessionParticipant record found (snake_case) for participant ${participantIdStr} class ${this.classId}`);
        return true;
      }
    } catch (err) {
      console.warn('Fallback SessionParticipant check failed in canParticipantJoin:', err.message || err);
    }

  console.log(`canParticipantJoin: denied for participant ${participantIdStr} on session ${this._id}. No matching tutor/student/class/participant-record found.`);
  return false;
  } catch (err) {
    // On error, be conservative and deny access
    console.error('Error checking participant join permission:', err);
    return false;
  }
};

// Add indexes for better query performance
meetingSessionSchema.index({ studentId: 1, scheduledStartTime: -1 });
meetingSessionSchema.index({ tutorId: 1, scheduledStartTime: -1 });
meetingSessionSchema.index({ classId: 1 });
meetingSessionSchema.index({ status: 1 });
meetingSessionSchema.index({ scheduledStartTime: -1 });

module.exports = mongoose.model('MeetingSession', meetingSessionSchema);
