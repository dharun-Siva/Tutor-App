const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phoneNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isMobilePhone(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  center_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: false
  },
  assignments: {
    classes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
      default: []
    },
    children: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: []
    }
  },
  phoneNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || validator.isMobilePhone(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  center_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  // Role-based assignments with validation
  assignments: {
    classes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
      default: []
      // Removed validation as classes assignment is optional
    },
    children: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Changed ref to 'User'
      default: []
      // Removed validation as children assignment is optional
    }
  },
  
  // Tutor-specific profile fields
  tutorProfile: {
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(v) {
          if (this.role === 'tutor' && v) {
            const age = (Date.now() - v.getTime()) / (1000 * 60 * 60 * 24 * 365);
            return age >= 18;
          }
          
          return true;
        },
        message: 'Tutors must be at least 18 years old'
      }
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'US' }
    },
    education: [{
      degree: { type: String, required: true, trim: true },
      institution: { type: String, required: true, trim: true },
      year: { type: Number, required: true },
      field: { type: String, trim: true }
    }],
    experience: {
      type: Number,
      min: 0,
      default: 0
    },
    certifications: [{
      name: { type: String, required: true, trim: true },
      issuedBy: { type: String, trim: true },
      issuedDate: { type: Date },
      expiryDate: { type: Date },
      credentialId: { type: String, trim: true }
    }],
    subjects: [{
      type: String,
      required: function() { return this.role === 'tutor'; },
      trim: true
    }],
    bio: {
      type: String,
      maxlength: 1000,
      trim: true
    },
    hourlyRate: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'HKD', 'JPY'],
      default: 'USD'
    },
    availability: {
      monday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      tuesday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      wednesday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      thursday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      friday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      saturday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      sunday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      }
    },
    cvPath: {
      type: String
      // Removed validation as CV can be optional for existing tutors
    },
    cvOriginalName: String,
    specializations: [String],
    languagesSpoken: [String],
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 }
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    documents: [{
      type: { type: String, required: true },
      path: { type: String, required: true },
      originalName: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    timeZone: {
      type: String,
      enum: [
        "UTC",
        "GMT",
        "EST",
        "EDT",
        "CST",
        "CDT",
        "MST",
        "MDT",
        "PST",
        "PDT",
        "IST",
        "BST",
        "CET",
        "CEST",
        "EET",
        "EEST",
        "JST",
        "AEST",
        "AEDT",
        "ACST",
        "ACDT",
        "AWST",
        "KST",
        "HKT",
        "SGT",
        "MSK"
      ],
      // default: "UTC"
    }
  },

  // Student-specific profile fields
  studentProfile: {
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(v) {
          if (this.role === 'student' && v) {
            const age = (Date.now() - v.getTime()) / (1000 * 60 * 60 * 24 * 365);
            return age >= 5 && age <= 25; // Students typically between 5-25 years
          }
          return true;
        },
        message: 'Students must be between 5 and 25 years old'
      }
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true, default: 'US' }
    },
    grade: {
      type: String,
      enum: ['Pre-K', 'Kindergarten', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', 'College', 'Graduate'],
      trim: true
    },
    school: {
      type: String,
      trim: true
    },
    parentContact: {
      motherName: { type: String, trim: true },
      motherPhone: { type: String, trim: true },
      motherEmail: { type: String, trim: true, lowercase: true },
      fatherName: { type: String, trim: true },
      fatherPhone: { type: String, trim: true },
      fatherEmail: { type: String, trim: true, lowercase: true },
      emergencyContact: { type: String, trim: true },
      emergencyPhone: { type: String, trim: true },
      relationship: { 
        type: String, 
        trim: true,
        enum: ['Mother', 'Father', 'Guardian', 'Grandparent', 'Aunt', 'Uncle', 'Other'],
        default: 'Mother'
      }
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Not required for all students (some might not have linked parents)
    },
    hourlyRate: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'HKD', 'JPY'],
      default: 'USD'
    },
    medicalInfo: {
      allergies: { type: String, trim: true },
      medications: { type: String, trim: true },
      conditions: { type: String, trim: true },
      emergencyInfo: { type: String, trim: true },
      doctorContact: { type: String, trim: true }
    },
    academicInfo: {
      subjects: [String], // Subjects the student is studying
      preferredSubjects: [String], // Subjects student likes most
      strugglingSubjects: [String], // Subjects student needs help with
      learningStyle: {
        type: String,
        enum: ['Visual', 'Auditory', 'Kinesthetic', 'Reading/Writing', 'Mixed'],
        default: 'Mixed'
      },
      goals: { type: String, maxlength: 500, trim: true },
      notes: { type: String, maxlength: 1000, trim: true }
    },
    availability: {
      monday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      tuesday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      wednesday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      thursday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      friday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      saturday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      },
      sunday: { 
        start: String, 
        end: String, 
        available: { type: Boolean, default: false },
        timeSlots: [{
          startTime: { type: String, default: '' },
          endTime: { type: String, default: '' }
        }],
        timeSlotsZones: [{
          startTimeUTC: { type: String, default: '' },
          endTimeUTC: { type: String, default: '' }
        }]
      }
    },
    enrollmentDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['enrolled', 'on-hold', 'graduated', 'transferred', 'dropped'],
      default: 'enrolled'
    },
    timeZone: {
      type: String,
      enum: [
        "UTC",
        "GMT",
        "EST",
        "EDT",
        "CST",
        "CDT",
        "MST",
        "MDT",
        "PST",
        "PDT",
        "IST",
        "BST",
        "CET",
        "CEST",
        "EET",
        "EEST",
        "JST",
        "AEST",
        "AEDT",
        "ACST",
        "ACDT",
        "AWST",
        "KST",
        "HKT",
        "SGT",
        "MSK"
      ],
      // default: "UTC"
    }
  },
  
  // Account status for approval workflow
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { 
    virtuals: true, // Include virtual fields in JSON output
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ 'assignments.center': 1 });
UserSchema.index({ 'assignments.classes': 1 });

// Pre-save middleware for password hashing
UserSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();
  
  // Validate password strength
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(this.password)) {
    throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
  }
  
  // Hash password
  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  this.passwordChangedAt = new Date();
  next();
});

// Pre-save middleware for role-based validation
UserSchema.pre('save', function(next) {
  // Clear assignments that don't apply to the user's role
  if (this.role !== 'tutor' && this.role !== 'student') {
    this.assignments.classes = [];
  }
  if (this.role !== 'parent') {
    this.assignments.children = [];
  }
  next();
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.isLocked) {
    throw new Error('Account is temporarily locked');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  // Lock account after max attempts
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    },
    $set: {
      lastLogin: new Date()
    }
  });
};

UserSchema.methods.changePassword = async function(currentPassword, newPassword) {
  const isMatch = await this.comparePassword(currentPassword);
  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }
  
  this.password = newPassword;
  await this.save();
};

UserSchema.methods.hasPermission = function(permission) {
  const rolePermissions = {
    superadmin: ['*'], // All permissions
    admin: ['manage_center', 'view_all_classes', 'manage_tutors', 'manage_students'],
    tutor: ['view_assigned_classes', 'manage_class_content', 'view_students'],
    parent: ['view_children_progress', 'communicate_tutors'],
    student: ['view_classes', 'submit_assignments', 'view_progress']
  };
  
  const userPermissions = rolePermissions[this.role] || [];
  return userPermissions.includes('*') || userPermissions.includes(permission);
};

UserSchema.methods.canAccessResource = function(resourceType, resourceId) {
  switch (this.role) {
    case 'superadmin':
      return true;
    case 'admin':
      if (resourceType === 'center') {
        return this.assignments.center && this.assignments.center.toString() === resourceId.toString();
      }
      return true; // Admin can access resources within their center
    case 'tutor':
      if (resourceType === 'class') {
        return this.assignments.classes.some(classId => classId.toString() === resourceId.toString());
      }
      return false;
    case 'student':
      if (resourceType === 'class') {
        return this.assignments.classes.some(classId => classId.toString() === resourceId.toString());
      }
      return false;
    case 'parent':
      if (resourceType === 'student') {
        return this.assignments.children.some(childId => childId.toString() === resourceId.toString());
      }
      return false;
    default:
      return false;
  }
};

// Static methods
UserSchema.statics.findByCredentials = async function(identifier, password, role) {
  const user = await this.findOne({
    $or: [{ email: identifier }, { username: identifier }],
    role,
    isActive: true
  }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  if (user.isLocked) {
    throw new Error('Account is temporarily locked due to too many failed login attempts');
  }
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await user.incrementLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  } else {
    await user.updateOne({ lastLogin: new Date() });
  }
  
  return user;
};

UserSchema.statics.createUser = async function(userData) {
  const user = new this(userData);
  await user.save();
  return user;
};

UserSchema.statics.getRoleBasedQuery = function(role, userId, assignments) {
  const baseQuery = { role, isActive: true };
  
  switch (role) {
    case 'admin':
      if (assignments && assignments.center) {
        baseQuery['assignments.center'] = assignments.center;
      }
      break;
    case 'tutor':
    case 'student':
      if (assignments && assignments.classes && assignments.classes.length > 0) {
        baseQuery['assignments.classes'] = { $in: assignments.classes };
      }
      break;
    case 'parent':
      if (assignments && assignments.children && assignments.children.length > 0) {
        baseQuery['assignments.children'] = { $in: assignments.children };
      }
      break;
  }
  
  return baseQuery;
};

// Add indexes for better query performance
UserSchema.index({ role: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ 'assignments.children': 1 });
UserSchema.index({ 'studentProfile.grade': 1 });

module.exports = mongoose.model('User', UserSchema);
