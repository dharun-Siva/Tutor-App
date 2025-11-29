const mongoose = require('mongoose');

const subtopicSchema = new mongoose.Schema({
  subtopicName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
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

// Ensure unique subtopic names within the same topic and center
subtopicSchema.index({ subtopicName: 1, topicId: 1, centerId: 1 }, { unique: true });

module.exports = mongoose.model('Subtopic', subtopicSchema);