const express = require('express');
const router = express.Router();
const { setCenterIdFromAdmin } = require('../middleware/set-center-id');
const auth = require('../middleware/auth');
const User = require('../models/User.postgres.js');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');

// Middleware to validate required fields
const validateUserFields = (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'First name, last name, email, and password are required'
        });
    }
    next();
};

// Create a new user (Admin, Tutor, Student, Parent)
router.post('/', 
    auth(['superadmin', 'admin']), 
    validateUserFields,
    setCenterIdFromAdmin,  // This will set center_id based on admin
    async (req, res) => {
        const t = await sequelize.transaction();
        try {
            const { 
                firstName, 
                lastName, 
                email, 
                phoneNumber, 
                role = 'parent',
                password,
                username,
                isActive = true,
                center_id // This will come from setCenterIdFromAdmin middleware
            } = req.body;

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Prepare user data based on role
            // Ensure center_id is available
            if (!center_id && req.user && req.user.center_id) {
                center_id = req.user.center_id;
            }

            let userData = {
                first_name: firstName,
                last_name: lastName,
                email: email.toLowerCase(),
                phone_number: phoneNumber,
                role,
                password: hashedPassword,
                username,
                is_active: isActive,
                center_id, // This will be set by our middleware for non-admin users
                assignments: {
                    center: center_id,  // Using the validated center_id
                    classes: [],
                    children: [] // Initialize empty children array for parents
                }
            };

            // Add role-specific profile data
            if (role === 'parent') {
                userData.assignments.children = [];
                userData.parentProfile = {
                    address: req.body.address || {},
                    emergency_contacts: [],
                    children: [],
                    preferences: {
                        currency: req.body.currency || 'USD',
                        notification_settings: {
                            email: true,
                            sms: phoneNumber ? true : false
                        }
                    },
                    verificationStatus: 'pending'
                };
            } else if (role === 'student') {
                const parentId = req.body.parentId;
                userData.studentProfile = {
                    parentId: parentId,
                    parent: parentId,
                    grade: req.body.grade || '',
                    school: req.body.school || '',
                    subjects: req.body.subjects || [],
                    documents: [],
                    education: [],
                    medicalInfo: req.body.medicalInfo || {
                        allergies: '',
                        conditions: '',
                        medications: '',
                        doctorContact: '',
                        emergencyInfo: ''
                    },
                    parentContact: req.body.parentContact || {
                        name: '',
                        phone: '',
                        email: ''
                    },
                    availability: {
                        monday: { available: false, timeSlots: [], timeSlotsZones: [] },
                        tuesday: { available: false, timeSlots: [], timeSlotsZones: [] },
                        wednesday: { available: false, timeSlots: [], timeSlotsZones: [] },
                        thursday: { available: false, timeSlots: [], timeSlotsZones: [] },
                        friday: { available: false, timeSlots: [], timeSlotsZones: [] },
                        saturday: { available: false, timeSlots: [], timeSlotsZones: [] },
                        sunday: { available: false, timeSlots: [], timeSlotsZones: [] }
                    },
                    learningGoals: req.body.learningGoals || '',
                    additionalNotes: req.body.additionalNotes || ''
                };

                // If parentId is provided, update parent's assignments
                if (parentId) {
                    await User.update(
                        {
                            assignments: sequelize.literal(`
                                jsonb_set(
                                    CASE 
                                        WHEN assignments IS NULL THEN '{}'::jsonb 
                                        ELSE assignments 
                                    END,
                                    '{children}',
                                    CASE 
                                        WHEN assignments->'children' IS NULL THEN '[]'::jsonb
                                        ELSE assignments->'children'
                                    END || '"${userData.id}"'::jsonb
                                )
                            `)
                        },
                        {
                            where: { id: parentId },
                            transaction: t
                        }
                    );
                }
            }
            console.log('DEBUG: Admin payload to be saved:', JSON.stringify(adminPayload, null, 2));
            // Create the user
            const user = await User.create(userData, { transaction: t });

            await t.commit();

            // Remove password from response
            const userResponse = user.toJSON();
            delete userResponse.password;

            res.status(201).json({
                success: true,
                data: userResponse
            });

        } catch (error) {
            await t.rollback();
            console.error('Error creating user:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating user',
                error: error.message
            });
        }
    }
);

// Delete user and clean up references
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const userId = req.params.id;
        
        // Get the user to check their role
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // If deleting a student, clean up parent references
        if (user.role === 'student') {
            // Find all parents that have this student in their children array
            const parents = await User.findAll({
                where: {
                    role: 'parent',
                    assignments: {
                        [Sequelize.Op.not]: null
                    }
                },
                transaction: t
            });

            // Update each parent's children array
            for (const parent of parents) {
                if (parent.assignments && Array.isArray(parent.assignments.children)) {
                    const updatedChildren = parent.assignments.children.filter(
                        childId => childId.toString() !== userId.toString()
                    );
                    
                    await parent.update({
                        assignments: {
                            ...parent.assignments,
                            children: updatedChildren
                        }
                    }, { transaction: t });
                }
            }
        }

        // Delete the user
        await user.destroy({ transaction: t });

        await t.commit();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        await t.rollback();
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
});

module.exports = router;