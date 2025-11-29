const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  topicName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
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

// Ensure unique topic names within the same subject and center
topicSchema.index({ topicName: 1, subjectId: 1, centerId: 1 }, { unique: true });

// Virtual for subtopics
topicSchema.virtual('subtopics', {
  ref: 'Subtopic',
  localField: '_id',
  foreignField: 'topicId'
});

module.exports = mongoose.model('Topic', topicSchema);