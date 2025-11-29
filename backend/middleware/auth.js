const jwt = require('jsonwebtoken');
// const User = require('../models/User');
const User = require('../models/sequelize/user');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this_in_production';

function authMiddleware(roles = []) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Access token required',
          message: 'Please provide a valid authorization header with Bearer token'
        });
      }

      const token = authHeader.split(' ')[1];
      
      console.log('=== AUTH MIDDLEWARE DEBUG ===');
      console.log('Auth header:', authHeader);
      console.log('Extracted token:', token ? `${token.substring(0, 20)}...` : 'No token');
      console.log('Request path:', req.path);
      console.log('Request method:', req.method);
      
      if (!token) {
        return res.status(401).json({ 
          error: 'No token provided',
          message: 'Authorization header must contain a token'
        });
      }

      // Verify the JWT token
      console.log('🔐 Verifying JWT token...');
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ JWT verified. User ID:', decoded.id);
      

      // Check if user still exists and is active (Sequelize)
      console.log('🔍 Looking up user in database (Sequelize)...');
      const user = await User.findByPk(decoded.id);
      console.log('👤 User found:', user ? 'YES' : 'NO');

      if (!user) {
        return res.status(401).json({ 
          error: 'User not found',
          message: 'The user belonging to this token no longer exists'
        });
      }

      if (user.isActive === false) {
        return res.status(401).json({ 
          error: 'Account deactivated',
          message: 'Your account has been deactivated. Please contact support.'
        });
      }

      // Check if user's password was changed after the token was issued
      if (user.passwordChangedAt) {
        const changedTimestamp = parseInt(new Date(user.passwordChangedAt).getTime() / 1000, 10);
        if (decoded.iat < changedTimestamp) {
          return res.status(401).json({ 
            error: 'Token expired',
            message: 'Password was changed. Please log in again.'
          });
        }
      }

      // Check if the user's role matches the required roles
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${decoded.role}`
        });
      }

      // Additional role validation against database (in case role changed)
      if (user.role !== decoded.role) {
        return res.status(403).json({ 
          error: 'Role mismatch',
          message: 'Your role has been changed. Please log in again.'
        });
      }

      // Attach user info to request object
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        permissions: decoded.permissions || [],
        assignments: user.assignments,
        center_id: decoded.center_id || user.center_id || null // Ensure center_id is mapped from JWT or DB
      };

      console.log('✅ Auth middleware complete, calling next()');
      next();

    } catch (error) {
      console.error('Auth middleware error:', error.message);
      console.error('Token verification failed for:', req.method, req.path);
      console.error('Error type:', error.name);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token',
          message: 'The provided token is malformed'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
          expiredAt: error.expiredAt
        });
      }
      
      res.status(500).json({ 
        error: 'Authentication failed',
        message: 'An error occurred during authentication'
      });
    }
  };
}

// Middleware to check specific permissions
function requirePermission(permission) {
  return authMiddleware().concat(async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      // TODO: Implement hasPermission logic for Sequelize model if needed
      // if (!user.hasPermission(permission)) {
      //   return res.status(403).json({ 
      //     error: 'Permission denied',
      //     message: `You don't have the required permission: ${permission}`,
      //     requiredPermission: permission,
      //     userRole: user.role
      //   });
      // }
      next();
    } catch (error) {
      console.error('Permission check error:', error.message);
      res.status(500).json({ error: 'Failed to verify permissions' });
    }
  });
}

// Middleware to check resource access
function requireResourceAccess(resourceType) {
  return authMiddleware().concat(async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id);
      const resourceId = req.params.resourceId || req.params.id;

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!resourceId) {
        return res.status(400).json({ error: 'Resource ID required' });
      }

      // TODO: Implement canAccessResource logic for Sequelize model if needed
      // if (!user.canAccessResource(resourceType, resourceId)) {
      //   return res.status(403).json({ 
      //     error: 'Access denied',
      //     message: `You don't have permission to access this ${resourceType}`,
      //     resourceType,
      //     resourceId,
      //     userRole: user.role
      //   });
      // }
      next();
    } catch (error) {
      console.error('Resource access check error:', error.message);
      res.status(500).json({ error: 'Failed to verify resource access' });
    }
  });
}

// Optional authentication middleware (doesn't fail if no token provided)
function optionalAuth() {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without authentication
      }

      const token = authHeader.split(' ')[1];
      
      if (!token) {
        return next(); // Continue without authentication
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (user && user.isActive !== false) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
          assignments: user.assignments
        };
      }

      next();
    } catch (error) {
      // Ignore auth errors in optional auth
      next();
    }
  };
}

module.exports = authMiddleware;
module.exports.requirePermission = requirePermission;
module.exports.requireResourceAccess = requireResourceAccess;
module.exports.optionalAuth = optionalAuth;
