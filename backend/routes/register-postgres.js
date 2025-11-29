const express = require('express');
const router = express.Router();
const { pgClient } = require('../db');
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const { setCenterIdFromAdmin } = require('../middleware/set-center-id');

// Create a new user
router.post('/register', 
    auth(['superadmin', 'admin']), // Only admin and superadmin can create users
    setCenterIdFromAdmin, // This will set center_id for non-admin users
    async (req, res) => {
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
                center_id // This will be set by middleware for non-admin users
            } = req.body;

            // Validate required fields
            if (!firstName || !lastName || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'First name, last name, email, and password are required'
                });
            }

            // Generate username if not provided
            let finalUsername = username;
            if (!finalUsername) {
                const emailPrefix = email.split('@')[0];
                finalUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_');
                
                if (finalUsername.length < 3) {
                    finalUsername = `${firstName.toLowerCase()}${lastName.toLowerCase()}`.replace(/[^a-zA-Z0-9_]/g, '_');
                }
                
                if (finalUsername.length > 30) {
                    finalUsername = finalUsername.substring(0, 30);
                }
            }

            // Check if user already exists
            const checkUserQuery = `
                SELECT id FROM users 
                WHERE email = $1 OR username = $2
            `;
            const { rows: existingUsers } = await pgClient.query(checkUserQuery, [email.toLowerCase(), finalUsername]);

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'User with this email or username already exists'
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new user
            const insertUserQuery = `
                INSERT INTO users (
                    first_name,
                    last_name,
                    email,
                    phone_number,
                    role,
                    password,
                    username,
                    is_active,
                    center_id,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING id, first_name, last_name, email, phone_number, role, username, is_active, center_id
            `;

            const values = [
                firstName,
                lastName,
                email.toLowerCase(),
                phoneNumber,
                role,
                hashedPassword,
                finalUsername,
                isActive,
                center_id
            ];

            const { rows: [newUser] } = await pgClient.query(insertUserQuery, values);

            console.log(`✅ Created new ${role} user:`, { 
                id: newUser.id, 
                email: newUser.email, 
                center_id: newUser.center_id 
            });

            res.status(201).json({
                success: true,
                data: newUser
            });

        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating user',
                error: error.message
            });
        }
    }
);

module.exports = router;