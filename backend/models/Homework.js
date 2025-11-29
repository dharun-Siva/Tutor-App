const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema({
  homeworkName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  gradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade',
    required: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  subtopicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subtopic',
    required: true
  },
  dueDate: {
    type: Date
  },
  fileName: {
    type: String
  },
  filePath: {
    type: String
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  exerciseData: {
    type: String  // JSON string containing exercise data
  },
  csvContent: {
    type: String  // Raw CSV content
  },
  correctAnswersSummary: {
    totalQuestions: {
      type: Number,
      default: 0
    },
    questionTypes: [{
      type: String
    }],
    exerciseIds: [{
      type: String
    }]
  },
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
homeworkSchema.index({ gradeId: 1, subjectId: 1, topicId: 1, subtopicId: 1 });
homeworkSchema.index({ dueDate: 1 });
homeworkSchema.index({ createdAt: -1 });

// Virtual to populate related data
homeworkSchema.virtual('grade', {
  ref: 'Grade',
  localField: 'gradeId',
  foreignField: '_id',
  justOne: true
});

homeworkSchema.virtual('subject', {
  ref: 'Subject',
  localField: 'subjectId',
  foreignField: '_id',
  justOne: true
});

homeworkSchema.virtual('topic', {
  ref: 'Topic',
  localField: 'topicId',
  foreignField: '_id',
  justOne: true
});

homeworkSchema.virtual('subtopic', {
  ref: 'Subtopic',
  localField: 'subtopicId',
  foreignField: '_id',
  justOne: true
});

homeworkSchema.virtual('creator', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Ensure virtual fields are serialized
homeworkSchema.set('toJSON', { virtuals: true });
homeworkSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Homework', homeworkSchema);