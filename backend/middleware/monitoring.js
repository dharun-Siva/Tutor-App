const express = require('express');
const { logger, logRequest, logError, logSecurityEvent, logPerformance } = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request start
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Override res.end to calculate response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
    
    // Log slow requests
    if (responseTime > 5000) {
      logPerformance('slow_request', responseTime, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode
      });
    }
    
    originalEnd.apply(res, args);
  };
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  // Log the error
  logError(err, req, {
    statusCode: err.statusCode || 500,
    errorType: err.constructor.name
  });
  
  // Security-related errors
  if (err.statusCode === 401 || err.statusCode === 403) {
    logSecurityEvent('authentication_error', {
      message: err.message,
      statusCode: err.statusCode,
      severity: 'high'
    }, req);
  }
  
  // Rate limiting errors
  if (err.statusCode === 429) {
    logSecurityEvent('rate_limit_exceeded', {
      message: 'Too many requests',
      severity: 'medium'
    }, req);
  }
  
  next(err);
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  // Memory usage before request
  const memBefore = process.memoryUsage();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const memAfter = process.memoryUsage();
    
    // Calculate memory delta
    const memDelta = {
      rss: memAfter.rss - memBefore.rss,
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal
    };
    
    // Log performance metrics
    logPerformance('request_performance', duration, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      memoryDelta: memDelta,
      cpuUsage: process.cpuUsage()
    });
  });
  
  next();
};

// Security audit middleware
const securityAudit = (req, res, next) => {
  // Log authentication events
  if (req.path.includes('/auth/')) {
    const originalSend = res.send;
    res.send = function(body) {
      if (req.method === 'POST') {
        if (res.statusCode === 200 || res.statusCode === 201) {
          logSecurityEvent('authentication_success', {
            path: req.path,
            method: req.method,
            severity: 'low'
          }, req);
        } else {
          logSecurityEvent('authentication_failure', {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            severity: 'high'
          }, req);
        }
      }
      originalSend.call(this, body);
    };
  }
  
  // Log admin operations
  if (req.user && req.user.role === 'superAdmin' && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    logSecurityEvent('admin_operation', {
      operation: `${req.method} ${req.path}`,
      adminId: req.user.id,
      severity: 'medium'
    }, req);
  }
  
  // Log sensitive data access
  if (req.path.includes('/api/users') && req.method === 'GET') {
    logSecurityEvent('user_data_access', {
      path: req.path,
      severity: 'low'
    }, req);
  }
  
  next();
};

// Database query performance middleware
const databaseMonitor = () => {
  // This will be used to wrap database queries
  return {
    wrapQuery: (model, operation, queryFn) => {
      return async (...args) => {
        const start = Date.now();
        try {
          const result = await queryFn.apply(null, args);
          const duration = Date.now() - start;
          
          require('../utils/logger').logDatabaseQuery(model, operation, duration, args[0]);
          
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          require('../utils/logger').logDatabaseQuery(model, operation, duration, args[0]);
          throw error;
        }
      };
    }
  };
};

// Health check endpoint with detailed metrics
const healthCheck = (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version
  };
  
  // Check database connection
  const mongoose = require('mongoose');
  healthData.database = {
    connected: mongoose.connection.readyState === 1,
    state: mongoose.connection.readyState
  };
  
  // Check if all critical services are working
  const isHealthy = mongoose.connection.readyState === 1;
  
  const statusCode = isHealthy ? 200 : 503;
  healthData.status = isHealthy ? 'healthy' : 'unhealthy';
  
  logger.info('Health check performed', healthData);
  
  res.status(statusCode).json(healthData);
};

// System metrics endpoint (protected)
const systemMetrics = (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    system: {
      loadavg: require('os').loadavg(),
      totalmem: require('os').totalmem(),
      freemem: require('os').freemem(),
      cpus: require('os').cpus().length
    }
  };
  
  res.json(metrics);
};

module.exports = {
  requestLogger,
  errorLogger,
  performanceMonitor,
  securityAudit,
  databaseMonitor,
  healthCheck,
  systemMetrics
};