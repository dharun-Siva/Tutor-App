const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  // Basic class information
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },

  // Subject information
  subject: {
    type: String,
    required: true,
    trim: true
    // Removed enum restriction to allow dynamic subjects from Subject collection
  },

  // Tutor assignment
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Students enrolled
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Class capacity
  maxCapacity: {
    type: Number,
    default: 10,
    min: 1,
    max: 50
  },

  // Time and schedule information
  startTime: {
    type: String, // Format: "HH:MM" (24-hour)
    required: true
  },

  duration: {
    type: Number, // Duration in minutes
    required: true,
    enum: [30, 35, 45, 60, 90, 120], // Predefined durations
    default: 35
  },

  customDuration: {
    type: Number, // For custom durations in minutes
    min: 30,
    max: 120
  },

    // Date scheduling
    scheduleType: {
      type: String,
      enum: ['one-time', 'weekly-recurring'],
      required: true,
      default: 'one-time'
    },

    // For one-time classes
    classDate: {
      type: Date,
      required: function() {
        return this.scheduleType === 'one-time';
      }
    },

    // For recurring classes
    recurringDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],

  startDate: {
    type: Date,
    required: function() {
      return this.scheduleType === 'weekly-recurring';
    }
  },

  endDate: {
    type: Date,
    required: function() {
      return this.scheduleType === 'weekly-recurring';
    }
  },

  // Class status (simplified)
  status: {
    type: String,
    enum: ['scheduled', 'completed'],
    default: 'scheduled'
  },

  // Payment status for billing
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'democlass'],
    default: 'unpaid'
  },

  // Billing amount and currency
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'INR', 'GBP', 'CAD', 'AUD'] // Common currencies
  },

  // MEETING INTEGRATION FIELDS
  meetingId: {
    type: String,
    unique: true,
    sparse: true // Allow null values but enforce uniqueness when present
  },

  meetingLink: {
    type: String
  },

  meetingPlatform: {
    type: String,
    enum: ['agora', 'zoom', 'meet'],
    default: 'agora'
  },

  // Join settings
  joinWindowMinutes: {
    type: Number,
    default: 15,
    min: 5,
    max: 30
  },

  // Administrative information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  center: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },

  // Additional metadata
  notes: {
    type: String,
    trim: true
  },

  // For tracking individual class sessions (for recurring classes)
  sessions: [{
    sessionDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled'
    },
    attendees: [{
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      attended: {
        type: Boolean,
        default: false
      }
    }],
    notes: String
  }]

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

// Indexes for better query performance
classSchema.index({ tutor: 1, classDate: 1 });
classSchema.index({ tutor: 1, startDate: 1, endDate: 1 });
classSchema.index({ subject: 1 });
classSchema.index({ status: 1 });
classSchema.index({ center: 1 });

// Virtual for getting effective duration
classSchema.virtual('effectiveDuration').get(function() {
  return this.customDuration || this.duration;
});

// Virtual for calculating end time
classSchema.virtual('endTime').get(function() {
  if (!this.startTime) return null;

  // startTime is expected to be 'HH:MM' string; if it's a Date, extract hours/minutes
  let hours, minutes;
  if (typeof this.startTime === 'string') {
    [hours, minutes] = this.startTime.split(':').map(Number);
  } else if (this.startTime instanceof Date) {
    hours = this.startTime.getHours();
    minutes = this.startTime.getMinutes();
  } else {
    // fallback: try to parse as Date
    const parsed = new Date(this.startTime);
    if (!isNaN(parsed.getTime())) {
      hours = parsed.getHours();
      minutes = parsed.getMinutes();
    } else {
      return null;
    }
  }
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + this.effectiveDuration;
  
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
});

// Method to check if tutor is available for the given time slot
classSchema.statics.checkTutorAvailability = async function(tutorId, date, startTime, duration) {
  // startTime may be 'HH:MM' or a Date; handle both
  let hours, minutes;
  if (typeof startTime === 'string') {
    [hours, minutes] = startTime.split(':').map(Number);
  } else if (startTime instanceof Date) {
    hours = startTime.getHours();
    minutes = startTime.getMinutes();
  } else {
    const parsed = new Date(startTime);
    hours = parsed.getHours();
    minutes = parsed.getMinutes();
  }
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + duration;
  
  // Check for overlapping classes
  const overlappingClasses = await this.find({
    tutor: tutorId,
    status: { $ne: 'cancelled' },
    $or: [
      // One-time classes on the same date
      {
        scheduleType: 'one-time',
        classDate: {
          $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
        }
      },
      // Recurring classes that might overlap
      {
        scheduleType: 'weekly-recurring',
        startDate: { $lte: date },
        endDate: { $gte: date },
        recurringDays: { $in: [date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()] }
      }
    ]
  });

  // Check for time conflicts
  for (const cls of overlappingClasses) {
    const [clsHours, clsMins] = cls.startTime.split(':').map(Number);
    const clsStartMinutes = clsHours * 60 + clsMins;
    const clsEndMinutes = clsStartMinutes + (cls.customDuration || cls.duration);

    // Check if time slots overlap
    if ((startMinutes < clsEndMinutes) && (endMinutes > clsStartMinutes)) {
      return false; // Conflict found
    }
  }

  return true; // No conflicts
};

// Static method to generate meeting info for a class data object
classSchema.statics.generateMeetingInfo = function(classData) {
  if (!classData.meetingId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    classData.meetingId = `class-${timestamp}-${random}`;
  }
  
  if (!classData.meetingLink) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    classData.meetingLink = `/meeting/${classData.meetingId}`;
  }

  if (!classData.meetingPlatform) {
    classData.meetingPlatform = 'agora'; // default platform
  }

  if (!classData.joinWindowMinutes) {
    classData.joinWindowMinutes = 15; // default 15 minutes before class starts
  }
  
  return classData;
};

// Method to generate meeting ID and link
classSchema.methods.generateMeeting = function() {
  if (!this.meetingId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    this.meetingId = `class-${this._id.toString().slice(-8)}-${random}`;
  }
  
  if (!this.meetingLink) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.meetingLink = `/meeting/${this.meetingId}`;
  }
  
  return {
    meetingId: this.meetingId,
    meetingLink: this.meetingLink
  };
};

// Method to check if class can be joined now
classSchema.methods.canJoin = function() {
  const now = new Date();
  
  if (this.status !== 'scheduled') {
    return { canJoin: false, reason: 'Class not scheduled' };
  }
  
  let sessionTime = null;
  
  if (this.scheduleType === 'one-time') {
    // For one-time classes, derive hours/minutes safely from startTime or classDate
    let hours, minutes;
    if (typeof this.startTime === 'string') {
      [hours, minutes] = this.startTime.split(':').map(Number);
    } else if (this.startTime instanceof Date) {
      hours = this.startTime.getHours();
      minutes = this.startTime.getMinutes();
    } else if (this.classDate instanceof Date) {
      const dt = new Date(this.classDate);
      hours = dt.getHours();
      minutes = dt.getMinutes();
    } else {
      return { canJoin: false, reason: 'Invalid start time' };
    }
    sessionTime = new Date(this.classDate);
    sessionTime.setHours(hours, minutes, 0, 0);
  } else if (this.scheduleType === 'weekly-recurring') {
    // For recurring classes, check today first, then find next occurrence
    const [hours, minutes] = this.startTime.split(':').map(Number);
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    
    // Check if today is a class day
    if (this.recurringDays.includes(dayName)) {
      const todaySession = new Date(today);
      todaySession.setHours(hours, minutes, 0, 0);
      
      // Check if today's session is within the joinable window
      const joinWindow = this.joinWindowMinutes * 60000; // Convert to milliseconds
      const joinTime = todaySession.getTime() - joinWindow;
      const endTime = todaySession.getTime() + (this.effectiveDuration * 60000);
      const currentTime = now.getTime();
      
      // If today's session is still active (within join window or during class)
      if (currentTime >= joinTime && currentTime <= endTime) {
        sessionTime = todaySession;
      }
    }
    
    // If no active session today, find next occurrence
    if (!sessionTime) {
      sessionTime = this.getNextSessionTime();
    }
  }
  
  if (!sessionTime) {
    return { canJoin: false, reason: 'No upcoming session' };
  }
  
  const joinWindow = this.joinWindowMinutes * 60000; // Convert to milliseconds
  const joinTime = sessionTime.getTime() - joinWindow;
  const endTime = sessionTime.getTime() + (this.effectiveDuration * 60000);
  const currentTime = now.getTime();
  
  if (currentTime < joinTime) {
    const minutesUntil = Math.ceil((joinTime - currentTime) / 60000);
    return { canJoin: false, reason: `Join available in ${minutesUntil} minutes` };
  }
  
  if (currentTime > endTime) {
    return { canJoin: false, reason: 'Session has ended' };
  }
  
  return { canJoin: true, reason: 'Ready to join', nextSessionTime: sessionTime };
};

// Method to get next session time for recurring classes
classSchema.methods.getNextSessionTime = function() {
  if (this.scheduleType !== 'weekly-recurring') return null;
  
  const now = new Date();
  // parse startTime defensively
  let hours, minutes;
  if (typeof this.startTime === 'string') {
    [hours, minutes] = this.startTime.split(':').map(Number);
  } else if (this.startTime instanceof Date) {
    hours = this.startTime.getHours();
    minutes = this.startTime.getMinutes();
  } else {
    const parsed = new Date(this.startTime);
    hours = parsed.getHours();
    minutes = parsed.getMinutes();
  }
  
  // Check each day from today for the next occurrence
  for (let i = 0; i < 14; i++) { // Check next 2 weeks
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + i);
    
    const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (this.recurringDays.includes(dayName)) {
      const sessionTime = new Date(checkDate);
      sessionTime.setHours(hours, minutes, 0, 0);
      
      // Make sure it's in the future and within the class date range
      const startDateOk = this.startDate ? sessionTime >= new Date(this.startDate) : true;
      const endDateOk = this.endDate ? sessionTime <= new Date(this.endDate) : true;
      if (sessionTime > now && startDateOk && endDateOk) {
        return sessionTime;
      }
    }
  }
  
  return null;
};

// Method to create session history entry
classSchema.methods.createSessionHistory = async function(sessionDate) {
  const SessionHistory = require('./SessionHistory');
  
  console.log('Creating session history for class:', {
    classId: this._id,
    date: sessionDate,
    meetingId: this.meetingId
  });
  
  const [hours, minutes] = this.startTime.split(':').map(Number);
  const scheduledStart = new Date(sessionDate);
  scheduledStart.setHours(hours, minutes, 0, 0);
  
  const scheduledEnd = new Date(scheduledStart.getTime() + (this.customDuration || this.duration) * 60000);
  
  console.log('Session time details:', {
    startTime: this.startTime,
    scheduledStart: scheduledStart.toISOString(),
    scheduledEnd: scheduledEnd.toISOString(),
    duration: this.customDuration || this.duration
  });

  const sessionHistory = new SessionHistory({
    classId: this._id,
    meetingId: this.meetingId,
    sessionDate: sessionDate,
    scheduledStartTime: scheduledStart,
    scheduledEndTime: scheduledEnd,
    status: 'scheduled'
  });

  try {
    console.log('Attempting to save session history:', {
      sessionData: {
        classId: sessionHistory.classId,
        meetingId: sessionHistory.meetingId,
        sessionDate: sessionHistory.sessionDate,
        scheduledStartTime: sessionHistory.scheduledStartTime,
        scheduledEndTime: sessionHistory.scheduledEndTime,
        status: sessionHistory.status
      },
      validation: await sessionHistory.validateSync()
    });

    const savedSession = await sessionHistory.save();
    
    console.log('Session history saved successfully:', {
      sessionId: savedSession._id,
      classId: savedSession.classId,
      date: savedSession.sessionDate,
      startTime: savedSession.scheduledStartTime,
      endTime: savedSession.scheduledEndTime,
      status: savedSession.status,
      timestamp: new Date().toISOString()
    });
    return savedSession;
  } catch (error) {
    console.error('Error creating session history:', error);
    throw error;
  }
};

// Method to get upcoming session count (for recurring classes)
// classSchema.methods.getUpcomingSessionCount = function() {
//   if (this.scheduleType === 'one-time') {
//     return this.status === 'scheduled' && new Date(this.classDate) >= new Date() ? 1 : 0;
//   }
  
//   const now = new Date();
//   const endDate = this.endDate;
  
//   if (now > endDate) return 0;
  
//   let count = 0;
//   const [hours, minutes] = this.startTime.split(':').map(Number);
  
//   // Count sessions from now until end date
//   for (let d = new Date(now); d <= endDate; d.setDate(d.getDate() + 1)) {
//     const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
//     if (this.recurringDays.includes(dayName)) {
//       const sessionTime = new Date(d);
//       sessionTime.setHours(hours, minutes, 0, 0);
      
//       if (sessionTime > now) {
//         count++;
//       }
//     }
//   }
  
//   return count;
// };

classSchema.methods.getUpcomingSessionCount = function () {
  if (this.scheduleType === 'one-time') {
    return this.status === 'scheduled' && new Date(this.classDate) >= new Date() ? 1 : 0;
  }

  const now = new Date();
  const endDate = new Date(this.endDate);

  if (now > endDate) return 0;

  let count = 0;
  const [hours, minutes] = this.startTime.split(':').map(Number);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const d = new Date(now);
  d.setHours(0, 0, 0, 0); // normalize to start of current day

  while (d <= endDate) {
    const dayName = dayNames[d.getDay()];

    if (this.recurringDays.includes(dayName)) {
      const sessionTime = new Date(d);
      sessionTime.setHours(hours, minutes, 0, 0);

      if (sessionTime > now) {
        count++;
      }
    }

    d.setDate(d.getDate() + 1);
  }

  return count;
};



// Pre-save middleware for validation
classSchema.pre('save', async function(next) {
  // Validate custom duration
  if (this.customDuration && ![30, 35, 45, 60, 90, 120].includes(this.duration)) {
    if (this.customDuration < 30 || this.customDuration > 180) {
      return next(new Error('Custom duration must be between 30 and 180 minutes'));
    }
  }

  // Check tutor availability
  if (this.isNew || this.isModified(['tutor', 'startTime', 'duration', 'customDuration', 'classDate', 'startDate', 'endDate', 'recurringDays'])) {
    const duration = this.customDuration || this.duration;
    
    if (this.scheduleType === 'one-time') {
      const isAvailable = await this.constructor.checkTutorAvailability(
        this.tutor, this.classDate, this.startTime, duration
      );
      if (!isAvailable) {
        return next(new Error('Tutor is not available at the specified time'));
      }
    }
    // For recurring classes, we'll check availability when creating individual sessions
  }

  next();
});

module.exports = mongoose.model('Class', classSchema);
