const mongoose = require('mongoose');
const validator = require('validator');

const CenterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Center name is required'],
    trim: true,
    unique: true,
    minlength: [3, 'Center name must be at least 3 characters'],
    maxlength: [100, 'Center name cannot exceed 100 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [50, 'City name cannot exceed 50 characters']
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [50, 'State name cannot exceed 50 characters']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      trim: true,
      validate: {
        validator: function(v) {
          return /^\d{5}(-\d{4})?$/.test(v);
        },
        message: 'Please provide a valid ZIP code'
      }
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    }
  },
  
  contact: {
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, 'Please provide a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
      validate: {
        validator: function(v) {
          // More flexible phone validation
          return /^[\+]?[1-9][\d]{0,15}$/.test(v.replace(/[\s\-\(\)]/g, ''));
        },
        message: 'Please provide a valid phone number'
      }
    },
    website: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || validator.isURL(v);
        },
        message: 'Please provide a valid website URL'
      }
    }
  },
  
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: async function(v) {
        if (!v) return true; // Allow null/undefined
        const User = mongoose.model('User');
        const user = await User.findById(v);
        return user && user.role === 'admin';
      },
      message: 'Assigned user must have admin role'
    }
  },
  
  capacity: {
    maxStudents: {
      type: Number,
      required: [true, 'Maximum student capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [10000, 'Capacity cannot exceed 10,000']
    },
    maxTutors: {
      type: Number,
      required: [true, 'Maximum tutor capacity is required'],
      min: [1, 'Tutor capacity must be at least 1'],
      max: [1000, 'Tutor capacity cannot exceed 1,000']
    }
  },
  
  operatingHours: {
    monday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' },
      closed: { type: Boolean, default: false }
    },
    tuesday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' },
      closed: { type: Boolean, default: false }
    },
    wednesday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' },
      closed: { type: Boolean, default: false }
    },
    thursday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' },
      closed: { type: Boolean, default: false }
    },
    friday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' },
      closed: { type: Boolean, default: false }
    },
    saturday: {
      open: { type: String, default: '10:00' },
      close: { type: String, default: '16:00' },
      closed: { type: Boolean, default: false }
    },
    sunday: {
      open: { type: String, default: '10:00' },
      close: { type: String, default: '16:00' },
      closed: { type: Boolean, default: true }
    }
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  establishedDate: {
    type: Date
  },
  
  // Analytics and metadata
  statistics: {
    currentStudents: { type: Number, default: 0 },
    currentTutors: { type: Number, default: 0 },
    totalClassesCompleted: { type: Number, default: 0 },
    averageRating: { type: Number, min: 0, max: 5, default: 0 }
  }
  
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Virtual for full address
CenterSchema.virtual('fullAddress').get(function() {
  const { address, city, state, zipCode } = this.location;
  return `${address}, ${city}, ${state} ${zipCode}`;
});

// Virtual for current utilization rate
CenterSchema.virtual('utilizationRate').get(function() {
  const studentRate = this.capacity.maxStudents > 0 
    ? Math.round((this.statistics.currentStudents / this.capacity.maxStudents) * 100)
    : 0;
  const tutorRate = this.capacity.maxTutors > 0 
    ? Math.round((this.statistics.currentTutors / this.capacity.maxTutors) * 100)
    : 0;
  
  return {
    students: studentRate,
    tutors: tutorRate,
    overall: Math.round((studentRate + tutorRate) / 2)
  };
});

// Indexes for performance
CenterSchema.index({ name: 1 });
CenterSchema.index({ 'location.city': 1 });
CenterSchema.index({ 'location.state': 1 });
CenterSchema.index({ admin: 1 });
CenterSchema.index({ isActive: 1 });

// Pre-save middleware for validation
CenterSchema.pre('save', function(next) {
  // Validate operating hours format (HH:MM)
  const timeFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of days) {
    if (this.operatingHours[day] && !this.operatingHours[day].closed) {
      if (!timeFormat.test(this.operatingHours[day].open)) {
        return next(new Error(`Invalid opening time format for ${day}. Use HH:MM format.`));
      }
      if (!timeFormat.test(this.operatingHours[day].close)) {
        return next(new Error(`Invalid closing time format for ${day}. Use HH:MM format.`));
      }
      
      // Validate that opening time is before closing time
      const [openHour, openMin] = this.operatingHours[day].open.split(':').map(Number);
      const [closeHour, closeMin] = this.operatingHours[day].close.split(':').map(Number);
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;
      
      if (openMinutes >= closeMinutes) {
        return next(new Error(`Opening time must be before closing time for ${day}`));
      }
    }
  }
  
  next();
});

// Static methods
CenterSchema.statics.findByAdmin = function(adminId) {
  return this.findOne({ admin: adminId, isActive: true });
};

CenterSchema.statics.findByLocation = function(city, state) {
  return this.find({
    'location.city': new RegExp(city, 'i'),
    'location.state': new RegExp(state, 'i'),
    isActive: true
  });
};

CenterSchema.statics.getAvailableCapacity = async function(centerId) {
  const center = await this.findById(centerId);
  if (!center) throw new Error('Center not found');
  
  return {
    students: center.capacity.maxStudents - center.statistics.currentStudents,
    tutors: center.capacity.maxTutors - center.statistics.currentTutors
  };
};

// Instance methods
CenterSchema.methods.assignAdmin = async function(adminId) {
  const User = mongoose.model('User');
  const admin = await User.findById(adminId);
  
  if (!admin) {
    throw new Error('Admin user not found');
  }
  
  if (admin.role !== 'admin') {
    throw new Error('User must have admin role');
  }
  
  if (admin.assignments.center && admin.assignments.center.toString() !== this._id.toString()) {
    throw new Error('Admin is already assigned to another center');
  }
  
  // Update both center and user
  this.admin = adminId;
  admin.assignments.center = this._id;
  
  await Promise.all([this.save(), admin.save()]);
  
  return this;
};

CenterSchema.methods.updateStatistics = async function() {
  const User = mongoose.model('User');
  
  // Count current students and tutors assigned to this center
  const currentStudents = await User.countDocuments({
    role: 'student',
    isActive: true,
    // In a real implementation, you'd have a proper relationship
    // For now, we'll update this when we have class assignments
  });
  
  const currentTutors = await User.countDocuments({
    role: 'tutor',
    isActive: true,
    // In a real implementation, you'd have a proper relationship
  });
  
  this.statistics.currentStudents = currentStudents;
  this.statistics.currentTutors = currentTutors;
  
  await this.save();
  return this;
};

CenterSchema.methods.isOperational = function(day = null, time = null) {
  const today = day || new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dayHours = this.operatingHours[today];
  
  if (!dayHours || dayHours.closed) {
    return false;
  }
  
  if (time) {
    const [hour, minute] = time.split(':').map(Number);
    const checkMinutes = hour * 60 + minute;
    
    const [openHour, openMin] = dayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = dayHours.close.split(':').map(Number);
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    return checkMinutes >= openMinutes && checkMinutes <= closeMinutes;
  }
  
  return true;
};

module.exports = mongoose.model('Center', CenterSchema);
