const mongoose = require('mongoose');

const homeworkAssignmentSchema = new mongoose.Schema({
  // Reference to the homework content (created by admin)
  homeworkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Homework',
    required: true
  },
  
  // Student who received the assignment
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Tutor who assigned the homework
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Class context for the assignment
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  
  // Center context for the assignment (for easier queries)
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center'
  },
  
  // Assignment status tracking
  status: {
    type: String,
    enum: ['assigned', 'inprogress', 'completed', 'incomplete'],
    default: 'assigned',
    required: true
  },
  
  // Date tracking
  assignedDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  startDate: {
    type: Date // Optional: when student should start
  },
  
  dueDate: {
    type: Date // Optional: when homework is due
  },
  
  startedDate: {
    type: Date // When student started working (status becomes 'inprogress')
  },
  
  completedDate: {
    type: Date // When student completed (status becomes 'completed')
  },
  
  // Additional assignment details
  notes: {
    type: String,
    trim: true // Optional notes from tutor
  },
  
  // Completion tracking
  submissionData: {
    type: mongoose.Schema.Types.Mixed // Store student's submission data
  },
  
  grade: {
    type: Number,
    min: 0,
    max: 100 // Optional: grade given by tutor after completion
  },
  
  feedback: {
    type: String,
    trim: true // Optional: tutor's feedback on completed homework
  },
  
  // Audit fields
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for better query performance
homeworkAssignmentSchema.index({ studentId: 1, status: 1 }); // For student dashboard
homeworkAssignmentSchema.index({ tutorId: 1, classId: 1 }); // For tutor dashboard
homeworkAssignmentSchema.index({ homeworkId: 1 }); // For homework analytics
homeworkAssignmentSchema.index({ centerId: 1 }); // For center-based queries
homeworkAssignmentSchema.index({ dueDate: 1 }); // For due date queries
homeworkAssignmentSchema.index({ assignedDate: -1 }); // For recent assignments

// Compound index for unique assignments (prevent duplicate assignments)
homeworkAssignmentSchema.index({ homeworkId: 1, studentId: 1 }, { unique: true });

// Virtual to populate homework details
homeworkAssignmentSchema.virtual('homework', {
  ref: 'Homework',
  localField: 'homeworkId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate student details
homeworkAssignmentSchema.virtual('student', {
  ref: 'User',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate tutor details
homeworkAssignmentSchema.virtual('tutor', {
  ref: 'User',
  localField: 'tutorId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate class details
homeworkAssignmentSchema.virtual('class', {
  ref: 'Class',
  localField: 'classId',
  foreignField: '_id',
  justOne: true
});

// Virtual to calculate time remaining until due date
homeworkAssignmentSchema.virtual('timeRemaining').get(function() {
  if (!this.dueDate) return null;
  
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due.getTime() - now.getTime();
  
  if (diffTime < 0) return 'Overdue';
  
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `${diffDays} days remaining`;
});

// Virtual to check if assignment is overdue
homeworkAssignmentSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'completed') return false;
  return new Date() > new Date(this.dueDate);
});

// Middleware to update status-related dates
homeworkAssignmentSchema.pre('save', function(next) {
  // Set startedDate when status changes to 'inprogress'
  if (this.isModified('status') && this.status === 'inprogress' && !this.startedDate) {
    this.startedDate = new Date();
  }
  
  // Set completedDate when status changes to 'completed'
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  
  next();
});

// Static method to get assignments for a tutor
homeworkAssignmentSchema.statics.findByTutor = function(tutorId, options = {}) {
  return this.find({ tutorId, isActive: true, ...options })
    .populate('homework', 'homeworkName description gradeId subjectId topicId subtopicId')
    .populate('student', 'firstName lastName email fullName')
    .populate('class', 'title subject')
    .sort({ assignedDate: -1 });
};

// Static method to get assignments for a student
homeworkAssignmentSchema.statics.findByStudent = function(studentId, options = {}) {
  return this.find({ studentId, isActive: true, ...options })
    .populate('homework', 'homeworkName description filePath dueDate')
    .populate('tutor', 'firstName lastName fullName')
    .populate('class', 'title subject')
    .sort({ assignedDate: -1 });
};

// Ensure virtual fields are serialized
homeworkAssignmentSchema.set('toJSON', { virtuals: true });
homeworkAssignmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('HomeworkAssignment', homeworkAssignmentSchema);