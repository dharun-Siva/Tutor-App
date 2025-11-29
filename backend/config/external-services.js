/**
 * External Services Configuration for Production
 * This file centralizes all external service configurations
 */

const { logger } = require('../utils/logger');

class ExternalServicesConfig {
  constructor() {
    this.services = {
      agora: {
        appId: process.env.AGORA_APP_ID,
        appCertificate: process.env.AGORA_APP_CERTIFICATE,
        chatAppKey: process.env.AGORA_CHAT_APP_KEY,
        enabled: !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE)
      },
      
      whiteboard: {
        appId: process.env.WHITEBOARD_APP_ID,
        appKey: process.env.WHITEBOARD_APP_KEY,
        appSecret: process.env.WHITEBOARD_APP_SECRET,
        apiUrl: process.env.NETLESS_API_URL || 'https://api.netless.link/v5/rooms',
        enabled: !!(process.env.WHITEBOARD_APP_ID && process.env.WHITEBOARD_APP_KEY)
      },
      
      email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        enabled: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS)
      },
      
      storage: {
        provider: process.env.STORAGE_PROVIDER || 'local', // 'local', 's3', 'gcs'
        s3: {
          accessKey: process.env.AWS_ACCESS_KEY_ID,
          secretKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION,
          bucket: process.env.AWS_S3_BUCKET,
          enabled: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
        },
        gcs: {
          projectId: process.env.GCS_PROJECT_ID,
          keyFile: process.env.GCS_KEY_FILE,
          bucket: process.env.GCS_BUCKET,
          enabled: !!(process.env.GCS_PROJECT_ID && process.env.GCS_KEY_FILE)
        }
      },
      
      monitoring: {
        sentry: {
          dsn: process.env.SENTRY_DSN,
          enabled: !!process.env.SENTRY_DSN
        },
        analytics: {
          googleAnalytics: process.env.GA_TRACKING_ID,
          enabled: !!process.env.GA_TRACKING_ID
        }
      },
      
      payment: {
        stripe: {
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
          secretKey: process.env.STRIPE_SECRET_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
          enabled: !!(process.env.STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY)
        },
        paypal: {
          clientId: process.env.PAYPAL_CLIENT_ID,
          clientSecret: process.env.PAYPAL_CLIENT_SECRET,
          mode: process.env.PAYPAL_MODE || 'sandbox', // 'sandbox' or 'live'
          enabled: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
        }
      },
      
      notifications: {
        fcm: {
          serverKey: process.env.FCM_SERVER_KEY,
          enabled: !!process.env.FCM_SERVER_KEY
        },
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          phoneNumber: process.env.TWILIO_PHONE_NUMBER,
          enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        }
      }
    };
    
    this.validateConfiguration();
  }

  validateConfiguration() {
    logger.info('🔧 Validating external services configuration...');
    
    const criticalServices = ['agora', 'email'];
    const missingCritical = [];
    
    criticalServices.forEach(serviceName => {
      const service = this.services[serviceName];
      if (!service.enabled) {
        missingCritical.push(serviceName);
        logger.warn(`⚠️  Critical service ${serviceName} is not properly configured`);
      } else {
        logger.info(`✅ ${serviceName} service configured successfully`);
      }
    });
    
    if (missingCritical.length > 0) {
      logger.error(`❌ Missing configuration for critical services: ${missingCritical.join(', ')}`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Critical services not configured: ${missingCritical.join(', ')}`);
      }
    }
    
    // Log optional services status
    const optionalServices = ['whiteboard', 'storage', 'monitoring', 'payment', 'notifications'];
    optionalServices.forEach(serviceName => {
      const service = this.services[serviceName];
      if (service.enabled !== undefined) {
        logger.info(`${service.enabled ? '✅' : '⚠️'} Optional service ${serviceName}: ${service.enabled ? 'enabled' : 'disabled'}`);
      }
    });
  }

  getService(serviceName) {
    return this.services[serviceName];
  }

  isServiceEnabled(serviceName) {
    return this.services[serviceName]?.enabled || false;
  }

  // Rate limiting configuration
  getRateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Different limits for different endpoints
      endpoints: {
        auth: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 5, // 5 login attempts per 15 minutes
          skipSuccessfulRequests: true
        },
        api: {
          windowMs: 15 * 60 * 1000,
          max: 1000, // 1000 API requests per 15 minutes
          skipSuccessfulRequests: false
        },
        upload: {
          windowMs: 60 * 60 * 1000, // 1 hour
          max: 50, // 50 uploads per hour
          skipSuccessfulRequests: false
        }
      }
    };
  }

  // CORS configuration
  getCORSConfig() {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN_1,
      process.env.CORS_ORIGIN_2,
      process.env.CORS_ORIGIN_3
    ].filter(Boolean);

    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // In development, allow localhost origins
        if (process.env.NODE_ENV === 'development' && 
            (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
          return callback(null, true);
        }
        
        logger.warn('CORS origin rejected:', { origin, allowedOrigins });
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-HTTP-Method-Override'
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400 // 24 hours
    };
  }

  // Security headers configuration
  getSecurityConfig() {
    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for Agora SDK
            "https://unpkg.com",
            "https://download.agora.io",
            "https://cdn.agora.io"
          ],
          connectSrc: [
            "'self'",
            "https://api.agora.io",
            "https://webrtc2-ap-web-2.agora.io",
            "https://api.netless.link",
            "wss:"
          ],
          mediaSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: {
        action: 'deny'
      },
      xssFilter: true,
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin"
      }
    };
  }

  // Database connection configuration
  getDatabaseConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      uri: process.env.MONGO_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: isProduction ? 10 : 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
        bufferMaxEntries: 0,
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary',
        // SSL/TLS settings for production
        ssl: isProduction && process.env.MONGO_SSL === 'true',
        sslValidate: isProduction,
        sslCA: process.env.MONGO_SSL_CA,
        authSource: process.env.MONGO_AUTH_SOURCE || 'admin'
      }
    };
  }

  // Generate configuration summary for logging
  getConfigSummary() {
    const summary = {
      environment: process.env.NODE_ENV || 'development',
      services: {},
      security: {
        jwtConfigured: !!process.env.JWT_SECRET,
        corsOrigins: [
          process.env.FRONTEND_URL,
          process.env.CORS_ORIGIN_1,
          process.env.CORS_ORIGIN_2
        ].filter(Boolean).length,
        rateLimitEnabled: true
      }
    };

    Object.keys(this.services).forEach(serviceName => {
      const service = this.services[serviceName];
      summary.services[serviceName] = service.enabled || false;
    });

    return summary;
  }
}

// Create singleton instance
const externalServicesConfig = new ExternalServicesConfig();

module.exports = externalServicesConfig;