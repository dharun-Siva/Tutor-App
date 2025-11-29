const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subjectCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  subjectName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  gradeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade',
    required: true
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  }
}, {
  timestamps: true
});

// Ensure unique subject codes within the same grade and center
subjectSchema.index({ subjectCode: 1, gradeId: 1, centerId: 1 }, { unique: true });

// Virtual for topics
subjectSchema.virtual('topics', {
  ref: 'Topic',
  localField: '_id',
  foreignField: 'subjectId'
});

module.exports = mongoose.model('Subject', subjectSchema);