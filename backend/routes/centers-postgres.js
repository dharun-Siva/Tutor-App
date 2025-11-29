const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-postgres');
const Center = require('../models/sequelize/Center');
const Subject = require('../models/sequelize/Subject');
const User = require('../models/sequelize/user'); // Now uses explicit tableName: 'Users'
const { Op } = require('sequelize');
const { uploadLogoToS3 } = require('../config/s3-config');

// Get all centers
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  console.log('🏢 GET /centers - Fetching all centers...');
  try {
    console.log('👤 User role:', req.user?.role);
    
    // If admin, only show their assigned center
    // If superadmin, show all centers
    let query = {
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'email', 'username', 'firstName', 'lastName', 'phone_number']
      }]
    };
    if (req.user.role === 'admin') {
      query.where = {
        adminId: req.user.id
      };
    } else if (req.user.role !== 'superadmin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only admins and superadmins can view centers' 
      });
    }
    const centers = await Center.findAll(query);
    
    console.log('📊 Found centers:', centers.length);
    console.log('First center:', centers[0] || 'No centers found');
    
    res.json(centers);
  } catch (error) {
    console.error('❌ Error fetching centers:', error);
    res.status(500).json({ error: 'Failed to fetch centers', details: error.message });
  }
});

// Get center by ID
router.get('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const center = await Center.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'email', 'username', 'firstName', 'lastName', 'phone_number']
      }]
    });

    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    res.json(center);
  } catch (error) {
    console.error('Error fetching center:', error);
    res.status(500).json({ error: 'Failed to fetch center' });
  }
});

// Create new center
router.post('/', auth(['superadmin']), async (req, res) => {
  try {
  const { name, address, city, state, country, zipCode, email, phone, adminId } = req.body;

    // Check if center with email already exists
    const existingCenter = await Center.findOne({ where: { email } });
    if (existingCenter) {
      return res.status(400).json({ error: 'Center with this email already exists' });
    }

    // Generate ObjectId for new center
  const { generateObjectId } = require('../models/sequelize/user');
  const centerId = generateObjectId();
    
    // Start a transaction
    const transaction = await Center.sequelize.transaction();
    
  try {
    // Create the center without admin initially
    const center = await Center.create({
        id: centerId,
        name,
        address,
        city,
        state,
        country: country || 'US', // Default to US if not provided
        zipCode,
        email,
        phone,
        status: 'inactive', // Start as inactive until admin is assigned
        adminId: null // Start with no admin
    }, { transaction });

    // Only update admin if one is provided
    if (adminId) {
        // Update the admin user's center_id
        await User.update(
            { center_id: centerId },
            { 
                where: { id: adminId },
                transaction 
            }
        );
        
        // Update center with admin and set to active
        await center.update({ 
            adminId,
            status: 'active' 
        }, { transaction });
    }

        // Commit the transaction
        await transaction.commit();

        const createdCenter = await Center.findByPk(centerId, {
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'email', 'username', 'firstName', 'lastName', 'phone_number']
      }]
        });

        console.log(`✅ Created center ${centerId}${adminId ? ` and updated admin ${adminId} with center_id` : ''}`);
        res.status(201).json(createdCenter);
    } catch (error) {
        // Rollback transaction if there's an error
        await transaction.rollback();
        console.error('Error in transaction:', error);
        throw error;
    }
  } catch (error) {
    console.error('Error creating center:', error);
    res.status(500).json({ error: 'Failed to create center' });
  }
});

// Update center
router.put('/:id', auth(['superadmin']), async (req, res) => {
    try {
        // Start a transaction
        const transaction = await Center.sequelize.transaction();

        try {
            const center = await Center.findByPk(req.params.id);
            if (!center) {
                return res.status(404).json({ error: 'Center not found' });
            }

            const {
                name,
                address,
                city,
                state,
                country,
                zipCode,
                email,
                phone,
                status,
                adminId
            } = req.body;

            // If admin is being changed
            if (adminId && adminId !== center.adminId) {
                // Remove center_id from old admin if exists
                if (center.adminId) {
                    await User.update(
                        { center_id: null },
                        { 
                            where: { id: center.adminId },
                            transaction
                        }
                    );
                }

                // Set center_id for new admin
                await User.update(
                    { center_id: center.id },
                    { 
                        where: { id: adminId },
                        transaction
                    }
                );
            }

            // Update center
            await center.update({
                name,
                address,
                city,
                state,
                country,
                zipCode,
                email,
                phone,
                status,
                adminId
            }, { transaction });

            // Commit transaction
            await transaction.commit();

            res.json(center);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error updating center:', error);
        res.status(500).json({ error: 'Failed to update center' });
    }

    // Check if email is being changed and if it's already taken
    if (email !== center.email) {
      const existingCenter = await Center.findOne({ where: { email } });
      if (existingCenter) {
        return res.status(400).json({ error: 'Center with this email already exists' });
      }
    }

    // Start a transaction
    const transaction = await Center.sequelize.transaction();
    
    try {
        // If admin is being changed
        if (adminId !== center.adminId) {
            // Clear center_id from old admin if exists
            if (center.adminId) {
                await User.update(
                    { center_id: null },
                    { 
                        where: { id: center.adminId },
                        transaction 
                    }
                );
            }
            
            // Set center_id for new admin
            if (adminId) {
                await User.update(
                    { center_id: center.id },
                    { 
                        where: { id: adminId },
                        transaction 
                    }
                );
            }
        }

        // Update center
        await center.update({
            name,
            address,
            city,
            state,
            country,
            zipCode,
            email,
            phone,
            status,
            adminId
        }, { transaction });

        // Commit the transaction
        await transaction.commit();

        console.log(`✅ Updated center ${center.id} and updated admin relationships`);
        res.json(center);
    } catch (error) {
        // Rollback transaction if there's an error
        if (transaction) {
            await transaction.rollback();
        }
        console.error('Error updating center:', error);
        res.status(500).json({ error: 'Failed to update center' });
    }
});

// Delete center
router.delete('/:id', auth(['superadmin']), async (req, res) => {
  const centerId = req.params.id;
  console.log('🔄 DELETE request for center with ID:', centerId);
  
  // Start a transaction
  const transaction = await Center.sequelize.transaction();

  try {
    // First get all centers to debug
    const allCenters = await Center.findAll({
      attributes: ['id', 'name']
    });
    console.log('📋 Available centers:', allCenters.map(c => ({ id: c.id, name: c.name })));

    // Try to find the specific center
    const center = await Center.findOne({
      where: { id: centerId },
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'email']
      }]
    });

    console.log('🔍 Search result for center:', centerId, center ? `Found: ${center.name}` : 'Not found');

    console.log('🔍 Search result:', center ? 'Center found' : 'Center not found');
    
    if (!center) {
      console.log('❌ Center not found with ID:', centerId);
      // Rollback the transaction since we're returning early
      await transaction.rollback();
      return res.status(404).json({ 
        success: false,
        error: 'Center not found',
        requestedId: centerId,
        debug: {
          availableCenterIds: allCenters.map(c => c.id)
        }
      });
    }

    console.log('✅ Found center:', {
      id: center.id,
      name: center.name,
      adminId: center.adminId,
      admin: center.admin ? center.admin.email : 'No admin'
    });

    try {
      // If center has an admin, clear their center_id first
      if (center.adminId) {
        console.log('👤 Starting admin unlink for:', center.adminId);
        
        // Find the admin user first
        const admin = await User.findOne({
          where: { id: center.adminId }
        });
        
        if (admin) {
          console.log('Found admin:', {
            id: admin.id,
            email: admin.email,
            currentCenterId: admin.center_id
          });

          // Update the admin's center_id to null
          await admin.update(
            { center_id: null },
            { transaction }
          );

          // Verify the update
          const verifyAdmin = await User.findOne({
            where: { id: center.adminId }
          });
          
          console.log('Admin update verification:', {
            id: verifyAdmin.id,
            email: verifyAdmin.email,
            newCenterId: verifyAdmin.center_id
          });
        } else {
          console.log('⚠️ Warning: Admin not found:', center.adminId);
        }
      }

      // Delete the center
      await center.destroy({ transaction });

      // Commit the transaction
      await transaction.commit();
      console.log('✨ Successfully deleted center and unlinked admin');

      res.json({
        success: true,
        message: 'Center deleted successfully and admin unlinked',
        center: {
          id: center.id,
          name: center.name
        }
      });
    } catch (error) {
      console.error('❌ Error during center deletion:', error);
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    // Rollback transaction if error occurs
    await transaction.rollback();
    console.error('Error deleting center:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete center',
      details: error.message
    });
  }
});

// Create and assign admin to center
router.post('/:id/admin', auth(['superadmin']), async (req, res) => {
  try {
    const centerId = req.params.id;
    const { firstName, lastName, email, username, password, phoneNumber } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, email, username, and password are required'
      });
    }

    // Find the center
    const center = await Center.findByPk(centerId);
    if (!center) {
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }

    // Check if center already has an admin
    if (center.adminId) {
      return res.status(400).json({
        success: false,
        error: 'Center already has an assigned admin'
      });
    }

    // Check if email or username already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email or username already exists'
      });
    }

    // Create the admin user and assign center_id
  const { generateObjectId } = require('../models/sequelize/user');
  const adminId = generateObjectId();
    // Hash password before saving
    const { hashPassword } = User;
    let hashedPassword = password;
    if (typeof hashPassword === 'function') {
      hashedPassword = await hashPassword(password);
    }
    const admin = await User.create({
      id: adminId,
      center_id: center.id,
      email: email.toLowerCase().trim(),
      role: 'admin',
      username: username.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password: hashedPassword,
      phoneNumber: phoneNumber?.trim(), // Store in phone_number column
      data: {} // Optionally keep data empty or add other fields if needed
    });

        // Assign admin to center and set status to active
    await center.update({ 
      adminId: admin.id,
      status: 'active'  // Set center to active when admin is assigned
    });

    // Return admin data without password
    const adminData = admin.toJSON();
    delete adminData.password;

    res.status(201).json({
      success: true,
      message: 'Admin created and assigned to center successfully',
      data: {
        admin: adminData,
        center: center
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create admin',
      details: error.message
    });
  }
});

// Change center admin
router.put('/:id/admin', auth(['superadmin']), async (req, res) => {
  const transaction = await Center.sequelize.transaction();
  
  try {
    const centerId = req.params.id;
    const { adminId } = req.body;

    if (!adminId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Admin ID is required'
      });
    }

    // Find center and new admin
    const [center, newAdmin] = await Promise.all([
      Center.findByPk(centerId),
      User.findByPk(adminId)
    ]);

    if (!center) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Center not found'
      });
    }

    if (!newAdmin || newAdmin.role !== 'admin') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Invalid admin user - user not found or not an admin role'
      });
    }

    // Update old center's admin (if exists) to null
    if (newAdmin.center_id) {
      await Center.update(
        { 
          adminId: null,
          status: 'inactive'  // Set old center to inactive
        },
        { 
          where: { id: newAdmin.center_id },
          transaction
        }
      );
    }

    // Update new admin's center_id
    await User.update(
      { center_id: centerId },
      { 
        where: { id: adminId },
        transaction
      }
    );

    // Update center with new admin and set to active
    await center.update(
      { 
        adminId: adminId,
        status: 'active'  // Set to active when admin is assigned
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch updated center data
    const updatedCenter = await Center.findByPk(centerId, {
      include: [{
        model: User,
        as: 'admin',
        attributes: ['id', 'email', 'username', 'firstName', 'lastName']
      }]
    });

    // Send single response
    return res.json({
      success: true,
      message: 'Admin assigned successfully',
      data: updatedCenter
    });

  } catch (error) {
    // Ensure transaction is rolled back on error
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Change admin error:', error);
    
    // Send single error response
    return res.status(500).json({
      success: false,
      error: 'Failed to assign admin',
      details: error.message
    });
  }
});

// Get available admins (admins without center assignment)
router.get('/admins/available', auth(['superadmin']), async (req, res) => {
  try {
    console.log('🔍 Fetching available admins...');
    // Find all admin users who are not assigned to any center
    const availableAdmins = await User.findAll({
      where: {
        role: 'admin',

        center_id: null


      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'username']
    });

    console.log('✅ Found available admins:', availableAdmins.length);
    console.log('Available admins:', availableAdmins.map(admin => ({
      id: admin.id,
      email: admin.email,
      center_id: admin.center_id
    })));

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

// Upload center logo file to S3 (Superadmin only)
router.post('/:id/logo-upload', auth(['superadmin']), uploadLogoToS3.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Get the S3 URL from the multer-s3 response
    const logoUrl = req.file.location;

    // Find the center
    const center = await Center.findByPk(id);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Update the logo URL in database
    center.logoUrl = logoUrl;
    await center.save();

    console.log(`✅ Logo uploaded and saved for center ${id}: ${logoUrl}`);

    res.json({
      success: true,
      message: 'Center logo uploaded successfully',
      data: {
        centerId: center.id,
        centerName: center.name,
        logoUrl: center.logoUrl,
        fileName: req.file.key
      }
    });
  } catch (error) {
    console.error('Error uploading center logo:', error);
    res.status(500).json({ error: 'Failed to upload center logo', details: error.message });
  }
});

// Update center logo (Superadmin only) - Keep for backward compatibility
router.put('/:id/logo', auth(['superadmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { logoUrl } = req.body;

    // Validate logoUrl
    if (!logoUrl) {
      return res.status(400).json({ error: 'Logo URL is required' });
    }

    // Find the center
    const center = await Center.findByPk(id);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Update the logo URL
    center.logoUrl = logoUrl;
    await center.save();

    console.log(`✅ Logo updated for center ${id}`);

    res.json({
      success: true,
      message: 'Center logo updated successfully',
      data: center
    });
  } catch (error) {
    console.error('Error updating center logo:', error);
    res.status(500).json({ error: 'Failed to update center logo', details: error.message });
  }
});

// Get center logo
// Public endpoint: Get subjects for a specific center (no auth required)
router.get('/:id/subjects', async (req, res) => {
  try {
    const { id } = req.params;

    const center = await Center.findByPk(id);

    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const subjects = await Subject.findAll({
      where: { centerId: id },
      attributes: ['id', 'subjectCode', 'subjectName', 'gradeId', 'centerId'],
      order: [['subjectName', 'ASC']]
    });

    res.json({
      success: true,
      subjects: subjects || [],
      data: subjects || []
    });
  } catch (error) {
    console.error('Error fetching center subjects:', error);
    res.status(500).json({ error: 'Failed to fetch center subjects', details: error.message });
  }
});

router.get('/:id/logo', async (req, res) => {
  try {
    const { id } = req.params;

    const center = await Center.findByPk(id, {
      attributes: ['id', 'name', 'logoUrl']
    });

    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    res.json({
      success: true,
      data: {
        centerId: center.id,
        centerName: center.name,
        logoUrl: center.logoUrl
      }
    });
  } catch (error) {
    console.error('Error fetching center logo:', error);
    res.status(500).json({ error: 'Failed to fetch center logo', details: error.message });
  }
});

module.exports = router;