const jwt = require('jsonwebtoken');
const User = require('../models/sequelize/user');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';

function authMiddleware(roles = []) {
  return async (req, res, next) => {
    try {
      // 1. Check Authorization Header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Access token required',
          message: 'Please provide a valid authorization header with Bearer token'
        });
      }

      // 2. Extract and validate token
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          error: 'No token provided',
          message: 'Authorization header must contain a token'
        });
      }

      // 3. Debug logging
      console.log('=== AUTH MIDDLEWARE DEBUG ===');
      console.log('Path:', req.path);
      console.log('Method:', req.method);
      console.log('Required roles:', roles);
      console.log('Token:', token.substring(0, 20) + '...');

      // 4. Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ JWT verified. User ID:', decoded.id);

      // 5. Find user in database using pg client
      const { pgClient } = require('../db');
      const { rows } = await pgClient.query(
        'SELECT id, email, role, center_id FROM users WHERE id = $1',
        [decoded.id]
      );
      const user = rows[0];
      console.log('=== Auth User Debug ===');
      console.log('👤 User found:', user ? 'YES' : 'NO');
      console.log('👤 Full user data:', user);
      console.log('👤 User role:', user?.role);
      console.log('👤 User center_id:', user?.center_id);

      if (!user) {
        return res.status(401).json({ 
          error: 'User not found',
          message: 'The user belonging to this token no longer exists'
        });
      }

      // 6. Check role authorization
      if (roles.length && !roles.includes(user.role)) {
        console.log('❌ Role check failed. User role:', user.role, 'Required roles:', roles);
        return res.status(403).json({
          error: 'Access denied',
          message: `You don't have permission to access this resource. Required roles: ${roles.join(', ')}`
        });
      }

      // 7. Add user info to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        center_id: user.center_id // Add center_id to the request user object
      };

      console.log('✅ Access granted to:', req.user.email);
      next();

    } catch (error) {
      console.error('Auth middleware error:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'The provided token is invalid'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again'
        });
      }

      res.status(401).json({
        error: 'Authentication failed',
        message: error.message || 'Please log in again'
      });
    }
  };
}

module.exports = authMiddleware;