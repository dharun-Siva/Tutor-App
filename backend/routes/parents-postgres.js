const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const User = require('../models/User.postgres');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');

// Create a new parent
router.post('/', auth(['admin', 'superadmin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { 
      first_name, 
      last_name, 
      email, 
      username, 
      password,
      phone_number,
      address,
      is_active = true,
      account_status = 'pending'
    } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !username || !password) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if email or username already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      },
      transaction: t
    });

    if (existingUser) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Email or username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create parent
    const parent = await User.create({
      first_name,
      last_name,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password: hashedPassword,
      phone_number,
      address,
      role: 'parent',
      is_active,
      account_status,
      center_id: req.user.role === 'admin' ? req.user.center_id : null,
      assignments: { children: [] }
    }, { transaction: t });

      await t.commit();

    // Remove password from response
    const parentData = parent.toJSON();
    delete parentData.password;

    res.status(201).json({
      success: true,
      message: 'Parent created successfully',
      data: parentData
    });
  } catch (error) {
    await t.rollback();
    console.error('Create parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create parent',
      error: error.message
    });
  }
});

// Update a parent
router.put('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const parentId = req.params.id;
    const { 
      first_name, 
      firstName,
      last_name, 
      lastName,
      email, 
      username, 
      password,
      phone_number,
      phoneNumber,
      address,
      is_active,
      isActive,
      account_status
    } = req.body;

    // Extract and convert isActive status
    const activeStatus = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true);

    // Get the parent to verify existence and access
    const parent = await User.findByPk(parentId, { transaction: t });
    
    if (!parent || parent.role !== 'parent') {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check center access for admin users
    if (req.user.role === 'admin') {
      if (!req.user.center_id || parent.center_id !== req.user.center_id) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          message: 'Access denied: Parent does not belong to your center'
        });
      }
    }

    // Check if email/username is being changed and if it's already taken
    if (email && email.toLowerCase() !== parent.email) {
      const existingEmail = await User.findOne({
        where: { email: email.toLowerCase() },
        transaction: t
      });
      if (existingEmail) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    if (username && username.toLowerCase() !== parent.username) {
      const existingUsername = await User.findOne({
        where: { username: username.toLowerCase() },
        transaction: t
      });
      if (existingUsername) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Username already in use'
        });
      }
    }

    // Update data object
    const updateData = {
      ...(first_name || firstName) && { first_name: first_name || firstName },
      ...(last_name || lastName) && { last_name: last_name || lastName },
      ...(email && { email: email.toLowerCase() }),
      ...(username && { username: username.toLowerCase() }),
      ...(phone_number !== undefined || phoneNumber !== undefined) && { phone_number: phone_number !== undefined ? phone_number : phoneNumber },
      ...(address !== undefined && { address }),
      is_active: activeStatus,  // Update is_active status
      account_status: activeStatus ? 'active' : 'inactive'  // Update account_status based on is_active
    };

    // Update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await parent.update(updateData, { transaction: t });
    await t.commit();

    // Get updated parent data
    const updatedParent = await User.findByPk(parentId);
    const parentData = updatedParent.toJSON();
    delete parentData.password;

    res.json({
      success: true,
      message: 'Parent updated successfully',
      data: parentData
    });
  } catch (error) {
    await t.rollback();
    console.error('Update parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update parent',
      error: error.message
    });
  }
});// Get all parents with pagination
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 1000,
      search,
      status
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const whereClause = {
      role: 'parent'
    };
    
    // Filter by center_id for admin users
    if (req.user.role === 'admin' && req.user.center_id) {
      whereClause.center_id = req.user.center_id;
      console.log('Filtering parents by center_id:', req.user.center_id);
    }

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add status filter
    if (status === 'active') {
      whereClause.is_active = true;
    } else if (status === 'inactive') {
      whereClause.is_active = false;
    }

    const result = await User.findAndCountAll({
      where: whereClause,
      attributes: [
        'id',
        'username',
        'email',
        'first_name',
        'last_name',
        'phone_number',
        'role',
        'is_active',
        'account_status',
        'center_id',
        'assignments',
        'created_at',
        'updated_at'
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Map parents for frontend compatibility
    const parents = result.rows.map(parent => {
      const plain = parent.get ? parent.get({ plain: true }) : parent;
      return {
        ...plain,
        isActive: plain.is_active !== undefined ? plain.is_active : true,
        accountStatus: plain.account_status || 'pending',
        firstName: plain.first_name || '',
        lastName: plain.last_name || '',
        phoneNumber: plain.phone_number || null,
        fullName: `${plain.first_name || ''} ${plain.last_name || ''}`.trim(),
        createdAt: plain.created_at || ''
      };
    });

    res.json({
      success: true,
      data: {
        parents,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(result.count / limit),
          count: parents.length,
          totalRecords: result.count
        }
      }
    });
  } catch (error) {
    console.error('Get parents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parents',
      message: error.message
    });
  }
});

// Delete a parent
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const parentId = req.params.id;
    
    // Get the parent to verify role and center access
    const parent = await User.findByPk(parentId, { transaction: t });
    
    if (!parent || parent.role !== 'parent') {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id;
      if (!adminCenter || String(parent.center_id) !== String(adminCenter)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          error: 'Access denied: Parent does not belong to your center'
        });
      }
    }

    // Delete the parent
    await parent.destroy({ transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: 'Parent deleted successfully'
    });

  } catch (error) {
    await t.rollback();
    console.error('Delete parent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete parent',
      message: error.message
    });
  }
});

module.exports = router;