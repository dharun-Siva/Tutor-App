const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  gradeCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10
  },
  gradeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  }
}, {
  timestamps: true
});

// Ensure unique grade codes within the same center
gradeSchema.index({ gradeCode: 1, centerId: 1 }, { unique: true });

// Virtual for subjects
gradeSchema.virtual('subjects', {
  ref: 'Subject',
  localField: '_id',
  foreignField: 'gradeId'
});

module.exports = mongoose.model('Grade', gradeSchema);