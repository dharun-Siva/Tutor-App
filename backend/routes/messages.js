const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/messages/admin
// @desc    Admin creates/sends a message to parents
// @access  Private (Admin, SuperAdmin)
router.post('/admin', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { title, content, recipientId, type, priority, expiresAt } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Get admin's center
    let centerId;
    if (req.user.role === 'admin') {
      const admin = await User.findById(req.user.id);
      centerId = admin.assignments?.center;
    }
    // SuperAdmin can specify centerId or it will be handled differently

    const message = new Message({
      senderId: req.user.id,
      recipientId: recipientId || null, // null for broadcast
      centerId: centerId,
      title,
      content,
      type: type || 'general',
      priority: priority || 'normal',
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await message.save();

    // Populate sender info for response
    await message.populate('senderId', 'firstName lastName email role');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// @route   GET /api/messages/admin
// @desc    Admin gets messages from parents (inbox)
// @access  Private (Admin, SuperAdmin)
router.get('/admin', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const adminId = req.user.id;
    const { page = 1, limit = 20, priority, unreadOnly } = req.query;

    // Get admin's center
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Build query for messages sent to this admin or broadcast messages
    let query = {
      $or: [
        { recipientId: adminId }, // Messages specifically for this admin
        { recipientId: null }     // Broadcast messages (from parents)
      ],
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    // Filter by admin's center if they have one
    if (admin.assignments?.center) {
      query.centerId = admin.assignments.center;
    }

    // Filter by priority if specified
    if (priority) {
      query.priority = priority;
    }

    // Filter unread only if specified
    if (unreadOnly === 'true') {
      query['isRead.userId'] = { $ne: adminId };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'firstName lastName email role')
      .populate('recipientId', 'firstName lastName email role')
      .sort({ priority: -1, createdAt: -1 }) // urgent first, then newest
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Add read status for each message
    const messagesWithReadStatus = messages.map(msg => ({
      ...msg,
      isReadByUser: msg.isRead.some(read => read.userId.toString() === adminId.toString()),
      readAt: msg.isRead.find(read => read.userId.toString() === adminId.toString())?.readAt || null
    }));

    // Get total count and unread count
    const total = await Message.countDocuments(query);
    const unreadCount = await Message.getUnreadCount(adminId, admin.assignments?.center);

    res.json({
      success: true,
      data: {
        messages: messagesWithReadStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalMessages: total,
          limit: parseInt(limit)
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// @route   POST /api/messages/parent
// @desc    Parent sends a message to admin
// @access  Private (Parent)
router.post('/parent', auth(['parent']), async (req, res) => {
  try {
    console.log('🔍 Parent message endpoint called');
    console.log('🔍 Request body:', req.body);
    console.log('🔍 User from auth:', req.user);
    
    const { title, content, priority } = req.body;
    const parentId = req.user.id;

    // Validation
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    // Get parent's center to find the admin
    console.log('🔍 Looking for parent with ID:', parentId);
    const parent = await User.findById(parentId);
    console.log('🔍 Found parent:', parent ? `${parent.firstName} ${parent.lastName}` : 'Not found');
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }
    console.log('🔍 Parent assignments:', parent.assignments);

    // Find the admin for this parent's center
    let adminId = null;
    if (parent.assignments?.center) {
      console.log('🔍 Looking for admin with center:', parent.assignments.center);
      const admin = await User.findOne({ 
        role: 'admin', 
        'assignments.center': parent.assignments.center 
      });
      console.log('🔍 Found admin:', admin ? `${admin.firstName} ${admin.lastName}` : 'Not found');
      if (admin) {
        adminId = admin._id;
      }
    }

    // Ensure we have a centerId (required field)
    const centerId = parent.assignments?.center;
    console.log('🔍 Center ID:', centerId);
    if (!centerId) {
      return res.status(400).json({
        success: false,
        message: 'Parent is not assigned to any center. Please contact support.'
      });
    }

    // If no specific admin found, leave recipientId as null (broadcast to all admins)
    const messageData = {
      senderId: parentId,
      recipientId: adminId, // Specific admin or null for broadcast
      centerId: centerId,
      title,
      content,
      type: 'parent_inquiry',
      priority: priority || 'normal'
    };
    
    console.log('🔍 Creating message with data:', messageData);
    const message = new Message(messageData);

    console.log('🔍 Attempting to save message...');
    await message.save();
    console.log('✅ Message saved successfully');

    // Populate sender info for response
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'firstName lastName email role');

    res.status(201).json({
      success: true,
      message: 'Message sent to admin successfully',
      data: populatedMessage
    });

  } catch (error) {
    console.error('Error sending parent message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message to admin',
      error: error.message
    });
  }
});

// @route   GET /api/messages/parent
// @desc    Get messages for parent (both targeted and broadcast)
// @access  Private (Parent)
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    const parentId = req.user.id;
    const { page = 1, limit = 20, priority, unreadOnly } = req.query;

    // Get parent's center
    const parent = await User.findById(parentId);
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Build query
    let query = {
      $or: [
        { recipientId: parentId }, // Messages specifically for this parent
        { recipientId: null }      // Broadcast messages
      ],
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    // Add center filter if parent has one
    if (parent.assignments?.center) {
      query.centerId = parent.assignments.center;
    }

    // Filter by priority if specified
    if (priority) {
      query.priority = priority;
    }

    // Filter unread only if specified
    if (unreadOnly === 'true') {
      query['isRead.userId'] = { $ne: parentId };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'firstName lastName email role')
      .sort({ priority: -1, createdAt: -1 }) // urgent first, then newest
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Add read status for each message
    const messagesWithReadStatus = messages.map(msg => ({
      ...msg,
      isReadByUser: msg.isRead.some(read => read.userId.toString() === parentId.toString()),
      readAt: msg.isRead.find(read => read.userId.toString() === parentId.toString())?.readAt || null
    }));

    // Get total count and unread count
    const total = await Message.countDocuments(query);
    const unreadCount = await Message.getUnreadCount(parentId, parent.assignments?.center);

    res.json({
      success: true,
      data: {
        messages: messagesWithReadStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalMessages: total,
          limit: parseInt(limit)
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('Error fetching parent messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read by parent
// @access  Private (Parent)
router.put('/:id/read', auth(['parent']), async (req, res) => {
  try {
    const messageId = req.params.id;
    const parentId = req.user.id;

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if parent is authorized to read this message
    const isAuthorized = 
      message.recipientId === null || // broadcast message
      message.recipientId.toString() === parentId.toString(); // targeted message

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this message'
      });
    }

    // Mark as read
    await message.markAsReadByUser(parentId);

    res.json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
});

// @route   GET /api/messages/admin/sent
// @desc    Get messages sent by admin
// @access  Private (Admin, SuperAdmin)
router.get('/admin/sent', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const messages = await Message.find({ senderId: req.user.id })
      .populate('recipientId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ senderId: req.user.id });

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalMessages: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sent messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sent messages',
      error: error.message
    });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete/deactivate a message
// @access  Private (Admin, SuperAdmin - only message sender)
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    // Soft delete by setting isActive to false
    message.isActive = false;
    await message.save();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

module.exports = router;