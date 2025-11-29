
const bcrypt = require('bcrypt');
const { pgClient } = require('../db'); // your Postgres connection
//const bcrypt = require('bcrypt');  
//const bcrypt = require('bcrypt');
    // for password comparison



const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');



const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_this_in_production';

// Rate limiting for login attempts - More lenient for development
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 100 attempts in dev, 5 in production
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: Math.ceil(15 * 60 / 60) // minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for development or if bypass header is present
    return process.env.NODE_ENV !== 'production' || req.headers['x-dev-bypass'] === 'true';
  }
});

// Login endpoint (auto-detect role)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    console.log('🔍 Login attempt received:', { identifier: req.body.identifier });
    const { identifier, password } = req.body;

    // Validate input
    if (!identifier || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        error: 'Identifier and password are required' 
      });
    }

    console.log('🔍 Searching for user with identifier:', identifier);
    
    // Find user by identifier (email or username) without specifying role
    // const user = await User.findOne({
    //   $or: [
    //     { email: identifier.toLowerCase() },
    //     { username: identifier }
    //   ],
    //   isActive: true
    // }).select('+password');


// Fetch user from PostgreSQL by email or username


// Fetch user from PostgreSQL by email or username, including the password
const result = await pgClient.query(
  `SELECT id, email, username, password, role, first_name, last_name, is_active 
   FROM users 
   WHERE email = $1 OR username = $2`,
  [identifier.toLowerCase(), identifier]
);

const user = result.rows[0];

if (!user || !user.is_active) {
  return res.status(401).json({ error: 'Invalid credentials or inactive user' });
}

// Compare passwords
if (!user.password) {
  return res.status(500).json({ error: 'User password not set' });
}

const PasswordValid = await bcrypt.compare(password, user.password);

if (!PasswordValid) {
  return res.status(401).json({ error: 'Invalid credentials' });
}




    // console.log('🔍 User found:', !!user);
    // if (user) {
    //   console.log('🔍 User details:', {
    //     id: user._id,
    //     email: user.email,
    //     username: user.username,
    //     role: user.role,
    //     isActive: user.isActive
    //   });
    // }

    // if (!user) {
    //   console.log('❌ User not found');
    //   return res.status(401).json({ 
    //     error: 'Invalid credentials' 
    //   });
    // }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      console.log('❌ Account is locked');
      return res.status(423).json({ 
        error: 'Account temporarily locked due to multiple failed attempts',
        lockDuration: Math.ceil((user.lockUntil - Date.now()) / (1000 * 60)) + ' minutes'
      });
    }

    console.log('🔍 Verifying password...');
    // Verify password
    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
      console.log('🔍 Password valid:', isPasswordValid);
    } catch (passwordError) {
      console.log('❌ Password comparison error:', passwordError.message);
      if (passwordError.message.includes('locked')) {
        return res.status(423).json({ 
          error: 'Account temporarily locked due to multiple failed attempts'
        });
      }
      // If it's some other error, treat as invalid password
      isPasswordValid = false;
    }
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      // Increment failed login attempts
      await user.incrementLoginAttempts();
      return res.status(401).json({ 
        error: 'Invalid credentials' 
      });
    }

    console.log('✅ Login successful, generating tokens...');

    // Reset failed login attempts on successful login
    if (user.loginAttempts > 0) {
      await User.updateOne(
        { _id: user._id },
        { $unset: { loginAttempts: 1, lockUntil: 1 } }
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = jwt.sign(
      { 
        id: user._id.toString(), 
        role: user.role,
        username: user.username,
        permissions: user.role === 'superadmin' ? ['*'] : []
      }, 
      JWT_SECRET, 
      { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Longer-lived refresh token
    );

    // Fetch assigned centers for admin users
    let assignedCenters = [];
    if (user.role === 'admin') {
      const centersResult = await pgClient.query(
        `SELECT c.id, c.name FROM admin_center_assignments aca
         JOIN centers c ON aca.centerid = c.id
         WHERE aca.adminid = $1`,
        [user.id || user._id]
      );
      assignedCenters = centersResult.rows.map(row => ({ id: row.id, name: row.name }));
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user._id?.toString() || user.id?.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        assignments: user.assignments,
        lastLogin: user.lastLogin,
        assignedCenters
      },
      token: accessToken, // For backward compatibility
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    
    // Return generic error message for security
    res.status(401).json({ 
      error: 'Invalid credentials or account not found' 
    });
  }
});

// Legacy login endpoint (with role parameter - for backward compatibility)
router.post('/login-with-role', loginLimiter, async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    // Validate input
    if (!identifier || !password || !role) {
      return res.status(400).json({ 
        error: 'Identifier, password, and role are required' 
      });
    }

    // Authenticate user
    const user = await User.findByCredentials(identifier, password, role);

    // Generate tokens
    const accessToken = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        username: user.username,
        permissions: user.role === 'superadmin' ? ['*'] : []
      }, 
      JWT_SECRET, 
      { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Longer-lived refresh token
    );

    // Fetch assigned centers for admin users
    let assignedCenters = [];
    if (user.role === 'admin') {
      const centersResult = await pgClient.query(
        `SELECT c.id, c.name FROM admin_center_assignments aca
         JOIN centers c ON aca.centerid = c.id
         WHERE aca.adminid = $1`,
        [user._id || user.id]
      );
      assignedCenters = centersResult.rows.map(row => ({ id: row.id, name: row.name }));
    }

    // Return user info and tokens (password already filtered out by toJSON)
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        assignments: user.assignments,
        lastLogin: user.lastLogin,
        assignedCenters
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    
    // Return generic error message for security
    if (error.message.includes('locked')) {
      return res.status(423).json({ 
        error: 'Account temporarily locked due to multiple failed attempts',
        lockDuration: '2 hours'
      });
    }
    
    res.status(401).json({ 
      error: 'Invalid credentials or account not found' 
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        username: user.username,
        permissions: user.role === 'superadmin' ? ['*'] : []
      }, 
      JWT_SECRET, 
      { expiresIn: '15m' }
    );

    res.json({
      accessToken,
      expiresIn: 15 * 60
    });

  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Register endpoint (for admin use)
router.post('/register', async (req, res) => {
  try {
    const userData = req.body;

    // Validate required fields
    const requiredFields = ['email', 'username', 'password', 'role', 'firstName', 'lastName'];
    const missingFields = requiredFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Create user
    const user = await User.createUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        ...user.data
      }
    });

  } catch (error) {
    console.error('Registration error:', error.message);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors 
      });
    }

    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Change password endpoint
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id; // From auth middleware

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.changePassword(currentPassword, newPassword);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error.message);
    
    if (error.message.includes('incorrect')) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    if (error.message.includes('Password must contain')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Server error during password change' });
  }
});

// Logout endpoint (client-side token removal, server-side could implement token blacklisting)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful. Please remove tokens from client storage.' });
});

// Development-only endpoint to reset rate limits
router.post('/dev-reset-limits', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    // Reset all user login attempts
    const User = require('../models/User');
    await User.updateMany(
      {},
      { $unset: { loginAttempts: 1, lockUntil: 1 } }
    );
    
    res.json({ 
      message: 'Rate limits and login attempts reset for development',
      note: 'This endpoint is only available in development mode'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset limits' });
  }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Fetch assigned centers for admin users
    let assignedCenters = [];
    if (user.role === 'admin') {
      const centersResult = await pgClient.query(
        `SELECT c.id, c.name FROM admin_center_assignments aca
         JOIN centers c ON aca.centerid = c.id
         WHERE aca.adminid = $1`,
        [user.id || user._id]
      );
      assignedCenters = centersResult.rows.map(row => ({ id: row.id, name: row.name }));
    }
    res.json({
      _id: user._id,
      id: user._id, // Include both for compatibility
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      assignments: user.assignments,
      isActive: user.isActive,
      centerName: user.centerName,
      assignedCenters
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
