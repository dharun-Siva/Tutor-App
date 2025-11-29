const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Center = require('../models/Center');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Get all centers (SuperAdmin only)
router.get('/', auth(['superadmin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    const query = {};
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { 'location.city': new RegExp(search, 'i') },
        { 'location.state': new RegExp(search, 'i') }
      ];
    }
    
    // Filter by status
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: 'admin',
        select: 'firstName lastName email username fullName'
      }
    };
    
    const centers = await Center.find(query)
      .populate(options.populate)
      .sort(options.sort)
      .limit(options.limit * options.page)
      .skip((options.page - 1) * options.limit);
      
    const total = await Center.countDocuments(query);
    
    res.json({
      success: true,
      data: centers,
      pagination: {
        current: options.page,
        pages: Math.ceil(total / options.limit),
        total
      }
    });
    
  } catch (error) {
    console.error('Get centers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch centers'
    });
  }
});

// Get a specific center (SuperAdmin only)
router.get('/:id', auth(['superadmin']), async (req, res) => {
  try {
    const center = await Center.findById(req.params.id)
      .populate('admin', 'firstName lastName email username fullName');
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    res.json({
      success: true,
      data: center
    });
    
  } catch (error) {
    console.error('Get center error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch center'
    });
  }
});

// Create a new center (SuperAdmin only)
router.post('/', auth(['superadmin']), async (req, res) => {
  try {
    const {
      name,
      location,
      contact,
      capacity,
      operatingHours,
      description,
      establishedDate
    } = req.body;
    
    // Validate required fields
    if (!name || !location || !contact || !capacity) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, location, contact, and capacity are required'
      });
    }
    
    // Check if center name already exists
    const existingCenter = await Center.findOne({ name: name.trim() });
    if (existingCenter) {
      return res.status(400).json({
        success: false,
        error: 'A center with this name already exists'
      });
    }
    
    // Create the center
    const centerData = {
      name: name.trim(),
      location,
      contact,
      capacity,
      operatingHours: operatingHours || {},
      description: description?.trim(),
      establishedDate: establishedDate ? new Date(establishedDate) : undefined
    };
    
    const center = new Center(centerData);
    await center.save();
    
    // Log the action
    console.log(`SuperAdmin ${req.user.id} created center: ${center.name} (ID: ${center._id})`);
    
    res.status(201).json({
      success: true,
      message: 'Center created successfully',
      data: center
    });
    
  } catch (error) {
    console.error('Create center error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create center'
    });
  }
});

// Create and assign admin to center
router.post('/:id/admin', auth(['superadmin']), async (req, res) => {
  try {
    const centerId = req.params.id;
    const {
      firstName,
      lastName,
      email,
      username,
      password,
      phoneNumber
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      console.log('Missing required fields validation failed');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, username, and password are required'
      });
    }
    
    console.log('Creating admin with data:', { firstName, lastName, email, username, phoneNumber });
    console.log('Password length:', password.length);
    
    // Find the center
    const center = await Center.findById(centerId);
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    // Check if center already has an admin
    if (center.admin) {
      return res.status(400).json({
        success: false,
        error: 'Center already has an assigned admin'
      });
    }
    
    // Check if email or username already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email or username already exists'
      });
    }
    
    // Create the admin user
    const adminData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      username: username.trim(),
      password,
      role: 'admin',
      phoneNumber: phoneNumber?.trim(),
      center: centerId,
      assignments: {
        center: centerId
      }
    };
    
    const admin = new User(adminData);
    await admin.save();
    
    // Assign admin to center
    center.admin = admin._id;
    await center.save();
    
    // Log the action
    console.log(`SuperAdmin ${req.user.id} created admin ${admin.username} and assigned to center ${center.name}`);
    
    // Return admin data without password
    const adminResponse = admin.toJSON();
    delete adminResponse.password;
    
    res.status(201).json({
      success: true,
      message: 'Admin created and assigned to center successfully',
      data: {
        admin: adminResponse,
        center: center
      }
    });
    
  } catch (error) {
    console.error('Create admin error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    if (error.message && error.message.includes('Password must contain')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create admin',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update center (SuperAdmin only)
router.put('/:id', auth(['superadmin']), async (req, res) => {
  try {
    const centerId = req.params.id;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.admin;
    delete updates.statistics;
    delete updates.createdAt;
    delete updates.updatedAt;
    
    const center = await Center.findByIdAndUpdate(
      centerId,
      updates,
      { 
        new: true, 
        runValidators: true 
      }
    ).populate('admin', 'firstName lastName email username fullName');
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    // Log the action
    console.log(`SuperAdmin ${req.user.id} updated center: ${center.name} (ID: ${center._id})`);
    
    res.json({
      success: true,
      message: 'Center updated successfully',
      data: center
    });
    
  } catch (error) {
    console.error('Update center error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update center'
    });
  }
});

// Change center admin (SuperAdmin only)
router.put('/:id/admin', auth(['superadmin']), async (req, res) => {
  try {
    const centerId = req.params.id;
    const { adminId } = req.body;
    
    console.log(`Admin assignment request: centerId=${centerId}, adminId=${adminId}`);
    
    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'Admin ID is required'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(centerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid center ID'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid admin ID'
      });
    }
    
    // Find center and new admin
    const [center, newAdmin] = await Promise.all([
      Center.findById(centerId),
      User.findById(adminId)
    ]);
    
    console.log(`Found center: ${center ? center.name : 'null'}`);
    console.log(`Found admin: ${newAdmin ? newAdmin.username : 'null'}, role: ${newAdmin ? newAdmin.role : 'null'}`);
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    if (!newAdmin || newAdmin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Invalid admin user - user not found or not an admin role'
      });
    }

    // Check if admin is already assigned to a different center
    if (newAdmin.assignments.center && 
        newAdmin.assignments.center.toString() !== centerId.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Admin is already assigned to another center'
      });
    }

    // If admin is already assigned to this center, no need to change anything
    if (newAdmin.assignments.center && 
        newAdmin.assignments.center.toString() === centerId.toString() &&
        center.admin && center.admin.toString() === adminId.toString()) {
      return res.json({
        success: true,
        message: 'Admin is already assigned to this center',
        data: {
          center: center,
          admin: {
            id: newAdmin._id,
            fullName: newAdmin.fullName,
            email: newAdmin.email,
            username: newAdmin.username
          }
        }
      });
    }
    
    console.log(`Assigning admin ${adminId} to center ${centerId}`);
    console.log(`Current center admin: ${center.admin}`);
    console.log(`New admin current assignment: ${newAdmin.assignments.center}`);
    
    // Remove previous admin assignment if exists (without transaction)
    if (center.admin) {
      const previousAdmin = await User.findById(center.admin);
      if (previousAdmin) {
        console.log(`Removing previous admin assignment: ${previousAdmin.username}`);
        previousAdmin.assignments.center = undefined;
        await previousAdmin.save();
      }
    }
    
    // Assign new admin
    console.log(`Setting center.admin to: ${adminId}`);
    console.log(`Setting newAdmin.assignments.center to: ${centerId}`);
    
    center.admin = new mongoose.Types.ObjectId(adminId);
    newAdmin.assignments.center = new mongoose.Types.ObjectId(centerId);
    
    console.log(`Saving center and admin with new assignments`);
    
    // Save them sequentially
    await center.save();
    console.log(`Center saved successfully`);
    
    await newAdmin.save();
    console.log(`Admin saved successfully`);
    
    console.log(`Assignment completed successfully`);
    
    await session.commitTransaction();
    
    // Log the action
    console.log(`SuperAdmin ${req.user.id} changed admin for center ${center.name} to ${newAdmin.username}`);
    
    res.json({
      success: true,
      message: 'Admin assignment updated successfully',
      data: {
        center: center,
        admin: {
          id: newAdmin._id,
          fullName: newAdmin.fullName,
          email: newAdmin.email,
          username: newAdmin.username
        }
      }
    });
    
  } catch (error) {
    console.error('Admin assignment error occurred:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to change admin assignment';
    let statusCode = 500;
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      const validationErrors = Object.values(error.errors).map(err => err.message);
      errorMessage = `Validation failed: ${validationErrors.join(', ')}`;
      console.error('Validation errors:', validationErrors);
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      errorMessage = `Database error: ${error.message}`;
      console.error('MongoDB error:', error.message);
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }
});

// Deactivate center (SuperAdmin only)
router.patch('/:id/deactivate', auth(['superadmin']), async (req, res) => {
  try {
    const center = await Center.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).populate('admin', 'firstName lastName email username fullName');
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    // Log the action
    console.log(`SuperAdmin ${req.user.id} deactivated center: ${center.name} (ID: ${center._id})`);
    
    res.json({
      success: true,
      message: 'Center deactivated successfully',
      data: center
    });
    
  } catch (error) {
    console.error('Deactivate center error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate center'
    });
  }
});

// Reactivate center (SuperAdmin only)
router.patch('/:id/activate', auth(['superadmin']), async (req, res) => {
  try {
    const center = await Center.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).populate('admin', 'firstName lastName email username fullName');
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    // Log the action
    console.log(`SuperAdmin ${req.user.id} reactivated center: ${center.name} (ID: ${center._id})`);
    
    res.json({
      success: true,
      message: 'Center reactivated successfully',
      data: center
    });
    
  } catch (error) {
    console.error('Reactivate center error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reactivate center'
    });
  }
});

// Delete center (SuperAdmin only)
router.delete('/:id', auth(['superadmin']), async (req, res) => {
  try {
    const centerId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(centerId)) {
      return res.status(400).json({
        error: 'Invalid center ID'
      });
    }
    
    const center = await Center.findById(centerId);
    
    if (!center) {
      return res.status(404).json({
        error: 'Center not found'
      });
    }
    
    // Check if center has assigned admin
    if (center.admin) {
      // Remove center assignment from admin
      await User.findByIdAndUpdate(
        center.admin,
        {
          $unset: { 'assignments.center': 1 }
        }
      );
    }
    
    // Delete the center
    await Center.findByIdAndDelete(centerId);
    
    res.json({
      success: true,
      message: 'Center deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete center error:', error);
    res.status(500).json({
      error: 'Failed to delete center'
    });
  }
});

// Get available admins (admins without center assignment)
router.get('/admins/available', auth(['superadmin']), async (req, res) => {
  try {
    const availableAdmins = await User.find({
      role: 'admin',
      isActive: true,
      'assignments.center': { $exists: false }
    }).select('firstName lastName email username fullName');
    
    res.json({
      success: true,
      data: availableAdmins
    });
    
  } catch (error) {
    console.error('Get available admins error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available admins'
    });
  }
});

// Get center statistics (SuperAdmin only)
router.get('/:id/statistics', auth(['superadmin']), async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }
    
    // Update statistics before returning
    await center.updateStatistics();
    
    res.json({
      success: true,
      data: {
        statistics: center.statistics,
        utilizationRate: center.utilizationRate,
        capacity: center.capacity
      }
    });
    
  } catch (error) {
    console.error('Get center statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch center statistics'
    });
  }
});

module.exports = router;
