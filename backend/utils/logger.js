const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
  format: customFormat,
  defaultMeta: {
    service: 'tutor-application',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Audit logs for security events
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Security audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: {
    service: 'tutor-application-audit',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'security-audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  ]
});

// Performance logger
const performanceLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: {
    service: 'tutor-application-performance',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'performance.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Helper functions for structured logging
const logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    timestamp: new Date().toISOString()
  };
  
  if (req.user) {
    logData.userId = req.user.id;
    logData.userRole = req.user.role;
  }
  
  logger.info('HTTP Request', logData);
};

const logError = (error, req = null, additionalInfo = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (req) {
    errorData.request = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    if (req.user) {
      errorData.user = {
        id: req.user.id,
        role: req.user.role
      };
    }
  }
  
  logger.error('Application Error', errorData);
};

const logSecurityEvent = (event, details, req = null) => {
  const securityData = {
    event,
    details,
    timestamp: new Date().toISOString(),
    severity: details.severity || 'medium'
  };
  
  if (req) {
    securityData.request = {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    if (req.user) {
      securityData.user = {
        id: req.user.id,
        role: req.user.role,
        email: req.user.email
      };
    }
  }
  
  auditLogger.warn('Security Event', securityData);
};

const logPerformance = (operation, duration, details = {}) => {
  const performanceData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  performanceLogger.info('Performance Metric', performanceData);
};

// Database query logger
const logDatabaseQuery = (model, operation, duration, query = {}) => {
  const queryData = {
    model,
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  };
  
  // Only log query details in development
  if (process.env.NODE_ENV !== 'production') {
    queryData.query = query;
  }
  
  if (duration > 1000) { // Log slow queries
    logger.warn('Slow Database Query', queryData);
  } else {
    logger.debug('Database Query', queryData);
  }
};

module.exports = {
  logger,
  auditLogger,
  performanceLogger,
  logRequest,
  logError,
  logSecurityEvent,
  logPerformance,
  logDatabaseQuery
};