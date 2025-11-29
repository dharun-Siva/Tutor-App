const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-postgres');
const { pgClient } = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Function to generate MongoDB-style ObjectId (24 characters)
function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const machineId = crypto.randomBytes(3).toString('hex');
    const processId = process.pid.toString(16).slice(0, 4).padStart(4, '0');
    const increment = crypto.randomBytes(3).toString('hex');
    return timestamp + machineId + processId + increment;
}

// Create a new user/parent (Admin and SuperAdmin)
router.post('/', auth(['superadmin', 'admin']), async (req, res) => {
    try {
        console.log('Creating new user with data:', req.body);
        
        const { 
            first_name, 
            last_name, 
            email, 
            phone_number, 
            role = 'parent',
            password,
            username: providedUsername,
            is_active = true,
            account_status = 'pending'
        } = req.body;

        // Get the admin's center_id from the authenticated user
        console.log('Authenticated user:', req.user);
        let adminCenterId = null;

        // For admin users, get their center_id
        if (req.user.role === 'admin') {
            console.log('Admin detected, checking center_id...');
            const { rows } = await pgClient.query(
                'SELECT center_id FROM users WHERE id = $1',
                [req.user.id]
            );
            
            if (rows.length > 0 && rows[0].center_id) {
                adminCenterId = rows[0].center_id;
                console.log('Found admin center_id in database:', adminCenterId);
            } else {
                console.log('No center_id found in database for admin');
                return res.status(400).json({
                    success: false,
                    message: 'Admin must be assigned to a center before creating parents'
                });
            }
        } else {
            console.log('User is not an admin, no center_id will be assigned');
        }

        // Validate required fields
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, email, and password are required'
            });
        }

        // For admin users, ensure they have a center assigned
        if (req.user.role === 'admin' && !adminCenterId) {
            return res.status(400).json({
                success: false,
                message: 'Admin must be assigned to a center before creating parents'
            });
        }

        // Generate username if not provided
        let finalUsername = providedUsername;
        if (!finalUsername) {
            const emailPrefix = email.split('@')[0];
            finalUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_');
            
            if (finalUsername.length < 3) {
                finalUsername = `${first_name.toLowerCase()}${last_name.toLowerCase()}`.replace(/[^a-zA-Z0-9_]/g, '_');
            }
            
            if (finalUsername.length > 30) {
                finalUsername = finalUsername.substring(0, 30);
            }
        }

        // Check if user already exists
        const checkUserQuery = `
            SELECT email, username 
            FROM users 
            WHERE email = $1 OR username = $2
        `;
        const { rows: existingUsers } = await pgClient.query(checkUserQuery, [email.toLowerCase(), finalUsername]);
        
        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: 'A user with this email already exists'
                });
            } else {
                // Username conflict, append a number
                let counter = 1;
                let newUsername = finalUsername;
                while (true) {
                    const { rows } = await pgClient.query(
                        'SELECT username FROM users WHERE username = $1',
                        [newUsername]
                    );
                    if (rows.length === 0) break;
                    
                    newUsername = `${finalUsername}${counter}`;
                    counter++;
                    if (newUsername.length > 30) {
                        newUsername = `${finalUsername.substring(0, 28)}${counter}`;
                    }
                }
                finalUsername = newUsername;
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate MongoDB-like ObjectId
        const objectId = generateObjectId();

        // Create new user
        const createUserQuery = `
            INSERT INTO users (
                id,
                first_name,
                last_name,
                email,
                username,
                phone_number,
                password,
                role,
                is_active,
                account_status,
                login_attempts,
                data,
                center_id,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            RETURNING id, first_name, last_name, email, username, phone_number, role, is_active, account_status, center_id
        `;

        const values = [
            objectId,
            first_name,
            last_name,
            email.toLowerCase(),
            finalUsername,
            phone_number || null,
            hashedPassword,
            role,
            is_active,
            account_status,
            0,  // login_attempts
            '{}', // empty JSON data
            adminCenterId // center_id (null for superadmin-created users)
        ];

        console.log('Executing query with values:', values);
        const { rows: [newUser] } = await pgClient.query(createUserQuery, values);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: newUser
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: error.message
        });
    }
});

// Get all users or filter by role
router.get('/', auth(['superadmin', 'admin']), async (req, res) => {
    try {
        const { role } = req.query;
        // Query users with their center assignments and handle admin active status
        let query = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.email, 
                u.username, 
                u.phone_number, 
                u.role,
                u.account_status,
                u.center_id,
                u.assignments,
                u.student_profile,
                u.data,
                u.is_active,
                c.name as center_name,
                CASE
                    WHEN u.role = 'admin' AND u.center_id IS NOT NULL THEN 'Active'
                    WHEN u.role = 'admin' THEN 'Inactive'
                    WHEN u.is_active THEN 'Active'
                    ELSE 'Inactive'
                END as status
            FROM users u
            LEFT JOIN centers c ON u.center_id = c.id
            WHERE 1=1
        `;
        const values = [];

        if (role) {
            query += ' AND u.role = $1';
            values.push(role);
        }
        
        // Filter by center_id for admin users
        if (req.user.role === 'admin' && req.user.center_id) {
            query += ` AND u.center_id = $${values.length + 1}`;
            values.push(req.user.center_id);
            console.log('Filtering users by center_id:', req.user.center_id);
        }

        query += ' ORDER BY u.created_at DESC';

        const { rows: users } = await pgClient.query(query, values);

        // Transform the data to include center assignment information
        const transformedUsers = users.map(user => ({
            ...user,
            assignment: user.center_id ? {
                center: {
                    id: user.center_id,
                    name: user.center_name
                }
            } : null,
            assignments: user.assignments || {},
            student_profile: user.student_profile || {},
            data: user.data || {}
        }));

        res.json({
            success: true,
            data: transformedUsers
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message
        });
    }
});

module.exports = router;