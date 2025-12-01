const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { RtcTokenBuilder, RtcRole, ChatTokenBuilder, RtmTokenBuilder } = require('agora-token');
const { roomToken, TokenRole, sdkToken } = require('netless-token');
const sequelize = require('./config/database/config');
require('dotenv').config();

// Import models and associations
require('./models/sequelize/associations');

// Enable logging
const logger = morgan('dev');


const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const dashboardEnhancedRoutes = require('./routes/dashboard-enhanced');
const centersRoutes = require('./routes/centers');
const usersRoutes = require('./routes/users');
const tutorsRoutes = require('./routes/tutors');
const studentsRoutes = require('./routes/students-postgres');
const parentsRoutes = require('./routes/parents-postgres');
const classesRoutes = require('./routes/classes-postgres');
const gradesRoutes = require('./routes/grades-postgres');
const subjectsRoutes = require('./routes/subjects-postgres');
const topicsRoutes = require('./routes/topics-postgres');
const subtopicsRoutes = require('./routes/subtopics-postgres');
const sessionsRoutes = require('./routes/sessions');

const sessionsParentRoutes = require('./routes/sessions-parent');
const sessionsParentClassesRoutes = require('./routes/sessions-parent-classes');
const billingRoutes = require('./routes/billing');
const parentBillingRoutes = require('./routes/parent-billing');
const adminBillingRoutes = require('./routes/admin-billing');
const classBillingTransactionRoutes = require('./routes/class-billing-transactions');
const homeworkRoutes = require('./routes/homework');
const homeworkAssignmentRoutes = require('./routes/homework-assignments-postgres');
const homeworkFormRoutes = require('./routes/homework-form-postgres');
const studentAnswersRoutes = require('./routes/student-answers');
const studentAnswersPostgresRoutes = require('./routes/student-answers-postgres');
const whiteboardRoutes = require('./routes/whiteboard');
const messagesRoutes = require('./routes/messages-postgres');  // Updated to PostgreSQL version
const sessionParticipantsRoutes = require('./routes/session-participants');
const bulkUploadsRoutes = require('./routes/bulk-uploads-postgres');
const stripePaymentRoutes = require('./routes/payments-stripe');
const { title } = require('process');

const app = express();

const PORT = process.env.PORT || 5000;

// Trust proxy configuration for rate limiting
app.set('trust proxy', 1);

// CORS middleware: allow frontend (localhost:3000) to access backend
// Place this BEFORE any routes
const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));

// Body parsing middleware MUST be registered before routes so req.body is populated
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount session participants route (needs body parsing for POST requests)
app.use('/api/session-participants', sessionParticipantsRoutes);

app.use('/api/sessions', require('./routes/sessions'));


// Agora configuration
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const CHAT_APP_KEY = process.env.AGORA_CHAT_APP_KEY;

// Whiteboard configuration
const WHITEBOARD_APP_ID = process.env.WHITEBOARD_APP_ID;
const WHITEBOARD_APP_SECRET = process.env.WHITEBOARD_APP_SECRET;

// In-memory store to track channel-to-whiteboard room mappings
const channelWhiteboardRooms = new Map();



// Security middleware
app.use(helmet()); // Set security headers
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN_1 || 'http://localhost:3000',
    process.env.CORS_ORIGIN_2 || 'http://localhost:3001', 
    process.env.CORS_ORIGIN_3 || 'http://localhost:3002',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting
// Rate limiting - Exclude whiteboard API from strict rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (increased for development)
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  // Skip rate limiting for whiteboard API
  skip: (req) => req.path.startsWith('/api/whiteboard')
});

const whiteboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // Allow more requests for whiteboard real-time sync
  message: {
    error: 'Too many whiteboard requests, please slow down.'
  }
});

app.use('/api/', generalLimiter);
app.use('/api/whiteboard', whiteboardLimiter);

// Logging
app.use(morgan('combined'));

// Note: body parsing middleware was moved earlier so routes receive parsed req.body

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve meeting frontend files
// Support both /meeting and /meeting/<slug> URLs by redirecting slug paths
// to the query-based dynamic route so window.MEETING_CONFIG will be injected.
app.get('/meeting/:meetingSlug', (req, res) => {
  try {
    const meetingSlug = req.params.meetingSlug || '';
    // Preserve any existing query string
    const originalQuery = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
    const redirectUrl = `/meeting?meetingId=${encodeURIComponent(meetingSlug)}${originalQuery ? `&${originalQuery}` : ''}`;
    console.log('🔀 Redirecting /meeting/:slug to dynamic /meeting with query:', redirectUrl);
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('❌ Error handling /meeting/:meetingSlug redirect:', err);
    return res.redirect('/meeting');
  }
});

app.use('/meeting', express.static(path.join(__dirname, '../frontend/src/components/meeting')));

// Initialize PostgreSQL connection
sequelize.authenticate()
  .then(() => {
    console.log('🔌 Connected to PostgreSQL database');
  })
  .catch(err => {
    console.error('❌ Unable to connect to PostgreSQL database:', err);
    process.exit(1);
  });

// ====================
// AGORA MEETING ROUTES
// ====================

// Generate Agora token
app.post('/api/token', (req, res) => {
  try {
    const { channelName, uid = 0, role = 'publisher' } = req.body;

    if (!channelName) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      console.warn('⚠️ Agora credentials not configured. Returning mock token for development/testing.');
      return res.json({
        token: 'mock_agora_token_for_development_testing',
        appId: 'mock_app_id',
        channelName,
        uid: uid || Math.floor(Math.random() * 10000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600 * 24,
        isMock: true
      });
    }

    // Set token expiration time (24 hours)
    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Build token
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      role === 'audience' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    res.json({
      token,
      appId: APP_ID,
      channelName,
      uid,
      expiresAt: privilegeExpiredTs
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Generate Agora RTM token for real-time messaging
app.post('/api/rtm-token', (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required for RTM token' });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      return res.status(500).json({
        error: 'Agora credentials not configured. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env file'
      });
    }

    // Set token expiration time (24 hours)
    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Generate RTM token using proper RtmTokenBuilder
    const token = RtmTokenBuilder.buildToken(
      APP_ID,
      APP_CERTIFICATE,
      uid,
      privilegeExpiredTs
    );

    console.log('RTM token generated for user:', uid);

    res.json({
      token,
      appId: APP_ID,
      uid,
      expiresAt: privilegeExpiredTs
    });
  } catch (error) {
    console.error('RTM token generation error:', error);
    res.status(500).json({ error: 'Failed to generate RTM token' });
  }
});

// GET endpoint for RTM token (for frontend fetch requests)
app.get('/api/rtm-token', (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required for RTM token' });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      return res.status(500).json({
        error: 'Agora credentials not configured. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE in .env file'
      });
    }

    // Set token expiration time (24 hours)
    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Generate RTM token using proper RtmTokenBuilder
    const token = RtmTokenBuilder.buildToken(
      APP_ID,
      APP_CERTIFICATE,
      uid,
      privilegeExpiredTs
    );

    console.log('RTM token generated for user:', uid);

    res.json({
      token,
      appId: APP_ID,
      uid,
      expiresAt: privilegeExpiredTs
    });
  } catch (error) {
    console.error('RTM token generation error:', error);
    res.status(500).json({ error: 'Failed to generate RTM token' });
  }
});

// Generate Chat token for Agora Chat SDK
app.post('/api/chat-token', (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required for Chat token' });
    }

    if (!APP_ID || !APP_CERTIFICATE || !CHAT_APP_KEY) {
      return res.status(500).json({
        error: 'Agora Chat credentials not configured. Please set AGORA_APP_ID, AGORA_APP_CERTIFICATE, and AGORA_CHAT_APP_KEY in .env file'
      });
    }

    // Set token expiration time (24 hours)
    const expirationTimeInSeconds = 3600 * 24;

    // Generate Chat user token
    const token = ChatTokenBuilder.buildUserToken(
      APP_ID,
      APP_CERTIFICATE,
      userId,
      expirationTimeInSeconds
    );

    console.log('Chat token generated for user:', userId);

    res.json({
      token,
      appKey: CHAT_APP_KEY,
      userId,
      expiresIn: expirationTimeInSeconds
    });
  } catch (error) {
    console.error('Chat token generation error:', error);
    res.status(500).json({ error: 'Failed to generate Chat token' });
  }
});

// Generate Whiteboard room token
app.post('/api/whiteboard-token', (req, res) => {
  console.log('Received whiteboard token request:', req.body);
  try {
    const { roomUuid, role = 'writer', uid } = req.body;

    if (!roomUuid) {
      console.log('Missing room UUID');
      return res.status(400).json({ error: 'Room UUID is required' });
    }

    // Generate a uid if not provided
    const userId = uid || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!WHITEBOARD_APP_ID || !WHITEBOARD_APP_SECRET) {
      console.log('Missing whiteboard credentials');
      return res.status(500).json({
        error: 'Whiteboard credentials not configured. Please set WHITEBOARD_APP_ID and WHITEBOARD_APP_SECRET in .env file'
      });
    }

    // Set token expiration time (24 hours)
    const lifespan = 3600 * 24 * 1000; // 24 hours in milliseconds

    // Generate whiteboard token with room permissions
    const whiteboardToken = roomToken(
      WHITEBOARD_APP_ID,
      WHITEBOARD_APP_SECRET,
      lifespan,
      {
        role: role === 'admin' ? TokenRole.Admin :
              role === 'reader' ? TokenRole.Reader :
              TokenRole.Writer, // Default to Writer
        uuid: roomUuid
      }
    );

    console.log('Whiteboard token generated for room:', roomUuid);
    res.json({
      token: whiteboardToken,
      roomUuid,
      appId: WHITEBOARD_APP_ID,
      uid: userId
    });
  } catch (error) {
    console.error('Whiteboard token generation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate whiteboard token' });
  }
});

// Create or get existing whiteboard room for channel
app.post('/api/whiteboard-room', async (req, res) => {
  try {
    if (!WHITEBOARD_APP_ID || !WHITEBOARD_APP_SECRET) {
      return res.status(500).json({
        error: 'Whiteboard credentials not configured'
      });
    }

    const { name } = req.body;
    const channelName = name ? name.replace('-whiteboard', '') : 'default';

    console.log('Checking for existing whiteboard room for channel:', channelName);

    // Check if we already have a room for this channel
    if (channelWhiteboardRooms.has(channelName)) {
      const existingRoom = channelWhiteboardRooms.get(channelName);
      console.log('✅ Found existing whiteboard room for channel:', channelName, '-> Room:', existingRoom.uuid);

      return res.json({
        uuid: existingRoom.uuid,
        name: existingRoom.name,
        teamUUID: existingRoom.teamUUID,
        appUUID: existingRoom.appUUID,
        isBoard: true,
        isRecord: existingRoom.isRecord,
        createdAt: existingRoom.createdAt,
        limit: existingRoom.limit,
        appId: WHITEBOARD_APP_ID,
        isExisting: true
      });
    }

    // Create an SDK token for room creation (admin role required)
    const sdkTokenValue = sdkToken(
      WHITEBOARD_APP_ID,
      WHITEBOARD_APP_SECRET,
      3600 * 24 * 1000, // 24 hours
      {
        role: TokenRole.Admin
      }
    );

    console.log('Creating new whiteboard room for channel:', channelName);

    try {
      // Try to call Agora Whiteboard API to create room
      const createRoomResponse = await axios.post(
        process.env.NETLESS_API_URL || 'https://api.netless.link/v5/rooms',
        {
          // Note: 'name' field is disabled for some accounts
          limit: 10, // Maximum number of users
          isRecord: false // Disable recording for basic usage
        },
        {
          headers: {
            'token': sdkTokenValue, // Use 'token' header, not 'Authorization'
            'Content-Type': 'application/json',
            'region': 'us-sv' // US Silicon Valley region
          }
        }
      );

      const roomData = createRoomResponse.data;
      console.log('✅ New whiteboard room created via Agora API:', roomData);

      // Store the channel -> room mapping
      const roomInfo = {
        uuid: roomData.uuid,
        name: name || `${channelName} Whiteboard`,
        teamUUID: roomData.teamUUID,
        appUUID: roomData.appUUID,
        isBoard: true,
        isRecord: roomData.isRecord,
        createdAt: roomData.createdAt || new Date().toISOString(),
        limit: roomData.limit,
        channelName: channelName
      };

      channelWhiteboardRooms.set(channelName, roomInfo);
      console.log('📋 Stored room mapping:', channelName, '-> Room:', roomData.uuid);

      res.json({
        uuid: roomData.uuid,
        name: roomInfo.name,
        teamUUID: roomData.teamUUID,
        appUUID: roomData.appUUID,
        isBoard: true,
        isRecord: roomData.isRecord,
        createdAt: roomInfo.createdAt,
        limit: roomData.limit,
        appId: WHITEBOARD_APP_ID,
        isExisting: false
      });
    } catch (apiError) {
      console.error('❌ Agora API room creation failed:', apiError.response?.data || apiError.message);

      // Return proper error instead of mock room
      res.status(500).json({
        error: 'Failed to create whiteboard room with Agora API',
        details: apiError.response?.data || apiError.message,
        appId: WHITEBOARD_APP_ID
      });
    }
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({
      error: 'Failed to create whiteboard room',
      details: error.message
    });
  }
});

// Get existing whiteboard rooms for a channel
app.get('/api/whiteboard-rooms/:channelName', (req, res) => {
  try {
    const { channelName } = req.params;
    console.log('Looking up whiteboard room for channel:', channelName);

    if (channelWhiteboardRooms.has(channelName)) {
      const roomInfo = channelWhiteboardRooms.get(channelName);
      console.log('✅ Found existing room for channel:', channelName, '-> Room:', roomInfo.uuid);

      res.json([{
        uuid: roomInfo.uuid,
        name: roomInfo.name,
        channelName: roomInfo.channelName,
        createdAt: roomInfo.createdAt,
        teamUUID: roomInfo.teamUUID,
        appUUID: roomInfo.appUUID
      }]);
    } else {
      console.log('❌ No existing room found for channel:', channelName);
      res.json([]);
    }
  } catch (error) {
    console.error('Error looking up whiteboard rooms:', error);
    res.status(500).json({ error: 'Failed to lookup whiteboard rooms' });
  }
});

// Meeting room entry point
app.get('/meeting', (req, res) => {
  const { meetingId, userName, userRole, classId, sessionId } = req.query;

  // Generate HTML with embedded parameters
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Room - ${meetingId || 'Loading...'}</title>
    <link rel="stylesheet" href="/meeting/index.css">
    <link rel="stylesheet" href="/meeting/MathClass.css">
    <style>
        body { margin: 0; padding: 0; background: #1a1a1a; }
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">
            <div>Loading Meeting Room...</div>
        </div>
    </div>

    <script>
        // Inject meeting parameters into window object
        window.MEETING_CONFIG = {
            meetingId: "${meetingId || ''}",
            userName: "${userName || ''}",
            userRole: "${userRole || ''}",
            classId: "${classId || ''}",
            sessionId: "${sessionId || ''}",
            "${title || ''}",
            "${startTime || ''}"
            serverUrl: "${process.env.NODE_ENV === 'production' ? (process.env.PRODUCTION_DOMAIN || 'https://your-domain.com') : 'http://localhost:5000'}"
        };

        console.log('Meeting Config:', window.MEETING_CONFIG);
    </script>

    <!-- React and dependencies -->
    <script crossorigin src="${process.env.UNPKG_REACT_URL || 'https://unpkg.com/react@18/umd/react.development.js'}"></script>
    <script crossorigin src="${process.env.UNPKG_REACT_DOM_URL || 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'}"></script>
    <script src="${process.env.BABEL_STANDALONE_URL || 'https://unpkg.com/@babel/standalone/babel.min.js'}"></script>

    <!-- Agora SDK -->
    <script src="${process.env.AGORA_RTC_SDK_URL || 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js'}"></script>

    <!-- Load meeting app components -->
    <script type="text/babel" src="/meeting/App.jsx"></script>
    <script type="text/babel" src="/meeting/main-entry.jsx"></script>
</body>
</html>`;

  res.send(html);
});

// Routes
app.use('/api/auth', require('./routes/auth-postgres')); // Using PostgreSQL auth routes
app.use('/api/dashboard', require('./routes/dashboard-postgres')); // Using PostgreSQL dashboard routes
app.use('/api/dashboard-enhanced', dashboardEnhancedRoutes); // Enhanced dashboard routes
app.use('/api/centers', require('./routes/centers-postgres')); // Using PostgreSQL centers routes
app.use('/api', require('./routes/center-admin-assignment')); // Route for assigning admins to centers
app.use('/api/messages', require('./routes/messages-postgres')); // Using PostgreSQL messages routes
app.use('/api/users', usersRoutes);
app.use('/api/tutors', tutorsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/parents', require('./routes/parents-postgres')); // Using PostgreSQL parents routes
app.use('/api/dashboard/admin/subjects', subjectsRoutes); // Using PostgreSQL subjects routes
app.use('/api/dashboard/admin/topics', topicsRoutes); // Using PostgreSQL topics routes
app.use('/api/dashboard/admin/subtopics', subtopicsRoutes); // Using PostgreSQL subtopics routes
app.use('/api/classes', classesRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/sessions', sessionsParentRoutes);
app.use('/api/sessions', sessionsParentClassesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/parent-billing', parentBillingRoutes);
app.use('/api/admin-billing', adminBillingRoutes);
app.use('/api/class-billing-transactions', classBillingTransactionRoutes);
app.use('/api/bulk-uploads', bulkUploadsRoutes); // PostgreSQL bulk upload routes
app.use('/api/dashboard/admin/homeworks', require('./routes/homework-postgres')); // Using PostgreSQL homework routes
app.use('/api/homework-assignments', homeworkAssignmentRoutes);
app.use('/api/homework-form', homeworkFormRoutes);
app.use('/api/student-answers', studentAnswersPostgresRoutes); // Using PostgreSQL student answers routes
app.use('/api/whiteboard', whiteboardRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/session', sessionParticipantsRoutes);
app.use('/api/grades', gradesRoutes); // PostgreSQL grades routes
app.use('/api/payments', stripePaymentRoutes); // Stripe payment routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Tutor Platform API',
    version: '1.0.0',
    documentation: '/api-docs',
    health: '/health'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      error: 'Duplicate Entry',
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'The provided token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token Expired',
      message: 'The provided token has expired'
    });
  }

  // Default error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
  });
});

// Handle frontend asset requests that might hit the backend
app.get('/favicon.ico', (req, res) => {
  res.status(204).send(); // No content for favicon
});

app.get('/logo192.png', (req, res) => {
  res.status(204).send(); // No content for logo
});

app.get('/manifest.json', (req, res) => {
  res.status(204).send(); // No content for manifest
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: {
      auth: '/api/auth',
      dashboard: '/api/dashboard',
      centers: '/api/centers',
      health: '/health'
    }
  });
});

// Export app for testing
module.exports = app;


// Initialize cron jobs for billing
const { initializeCronJobs } = require('./services/cronJobs');

// Only start server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    
    // Initialize scheduled jobs (cron jobs)
    try {
      initializeCronJobs();
    } catch (error) {
      console.error('Failed to initialize cron jobs:', error);
    }
  });
}
