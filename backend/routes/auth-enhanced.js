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
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // 50 attempts in dev, 5 in production
  message: {
    error: 'Too many login attempts, please try again later',
    retryAfter: Math.ceil(15 * 60 / 60) // minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // Skip rate limiting for certain development scenarios
    return process.env.NODE_ENV === 'development' && req.headers['x-dev-bypass'] === 'true';
  }
});

// Enhanced login endpoint with better error handling and tutor-specific features
router.post('/login', loginLimiter, async (req, res) => {
  try {
    console.log('🔍 Login attempt received:', { 
      identifier: req.body.identifier,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    const { identifier, password } = req.body;

    // Validate input
    if (!identifier || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        error: 'Email/username and password are required' 
      });
    }

    console.log('🔍 Attempting to find user with identifier:', identifier);

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'No account found with this email or username'
      });
    }

    console.log('✅ User found:', { 
      id: user._id, 
      role: user.role, 
      isActive: user.isActive,
      loginAttempts: user.loginAttempts || 0
    });

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ Account deactivated');
      return res.status(401).json({ 
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Check for account lockout
    if (user.lockUntil && user.lockUntil > Date.now()) {
      console.log('❌ Account temporarily locked');
      const lockTimeRemaining = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      return res.status(423).json({ 
        error: 'Account temporarily locked',
        message: `Account is locked due to too many failed login attempts. Try again in ${lockTimeRemaining} minutes.`,
        lockUntil: user.lockUntil
      });
    }

    // Verify password
    console.log('🔍 Verifying password...');
    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
    } catch (passwordError) {
      console.error('Password comparison error:', passwordError);
      isPasswordValid = false;
    }
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      // Increment failed login attempts
      await user.incrementLoginAttempts();
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Incorrect password'
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
      { expiresIn: '7d' } // Long-lived refresh token
    );

    // Return user info without password
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      assignments: user.assignments,
      // Add tutor-specific information
      ...(user.role === 'tutor' && {
        tutorProfile: user.tutorProfile,
        specializations: user.tutorProfile?.specializations || [],
        subjects: user.tutorProfile?.subjects || []
      })
    };

    console.log('✅ Login successful for:', user.role, user.username);

    // Enhanced response with tutor-specific features
    const response = {
      message: 'Login successful',
      user: userResponse,
      token: accessToken,
      refreshToken: refreshToken,
      tokens: {
        accessToken,
        refreshToken
      },
      // Add role-specific dashboard routes
      dashboardRoute: {
        superadmin: '/superadmin/dashboard',
        admin: '/admin/dashboard',
        tutor: '/tutor/dashboard',
        parent: '/parent/dashboard',
        student: '/student/dashboard'
      }[user.role],
      // Add tutor-specific session info
      ...(user.role === 'tutor' && {
        sessionManagement: {
          canCreateSessions: true,
          canManageClasses: true,
          canViewStudentProgress: true,
          defaultMeetingPlatform: 'zoom' // or from user preferences
        }
      })
    };

    res.json(response);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An internal server error occurred. Please try again later.'
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
      { expiresIn: '7d' } // Long-lived refresh token
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Return user info without password
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      assignments: user.assignments
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token: accessToken,
      refreshToken: refreshToken,
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Legacy login error:', error);
    if (error.message.includes('Invalid credentials') || 
        error.message.includes('locked') ||
        error.message.includes('deactivated')) {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An internal server error occurred'
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
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
      accessToken: newAccessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Enhanced logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just return success
    res.json({ 
      message: 'Logged out successfully',
      instruction: 'Please remove tokens from client storage'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Password change endpoint
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    const user = await User.findById(decoded.id).select('+password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password using the model method
    await user.changePassword(currentPassword, newPassword);

    res.json({ 
      message: 'Password changed successfully',
      note: 'Please log in again with your new password'
    });

  } catch (error) {
    console.error('Password change error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(500).json({ 
      error: 'Password change failed',
      message: error.message
    });
  }
});

// Development-only endpoint to bypass rate limiting
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-reset-limits', async (req, res) => {
    try {
      // Reset all user login attempts
      await User.updateMany(
        {},
        { $unset: { loginAttempts: 1, lockUntil: 1 } }
      );
      
      res.json({ 
        message: 'Rate limits reset for development',
        note: 'This endpoint is only available in development mode'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset limits' });
    }
  });
}

module.exports = router;
