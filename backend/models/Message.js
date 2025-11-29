const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null means broadcast to all parents
  },
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Center',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['announcement', 'reminder', 'alert', 'general', 'parent_inquiry'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['urgent', 'normal', 'info'],
    default: 'normal'
  },
  isRead: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  }
}, {
  timestamps: true
});

// Index for performance
messageSchema.index({ centerId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ priority: 1, createdAt: -1 });

// Virtual for checking if message is read by specific user
messageSchema.methods.isReadByUser = function(userId) {
  return this.isRead.some(read => read.userId.toString() === userId.toString());
};

// Method to mark message as read by user
messageSchema.methods.markAsReadByUser = function(userId) {
  const existingRead = this.isRead.find(read => read.userId.toString() === userId.toString());
  if (!existingRead) {
    this.isRead.push({ userId, readAt: new Date() });
  }
  return this.save();
};

// Static method to get unread count for user
messageSchema.statics.getUnreadCount = function(userId, centerId) {
  return this.countDocuments({
    $or: [
      { recipientId: userId },
      { recipientId: null } // broadcast messages
    ],
    centerId: centerId,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ],
    'isRead.userId': { $ne: userId }
  });
};

module.exports = mongoose.model('Message', messageSchema);