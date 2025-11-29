# Production Environment Configuration Files

## 📁 Frontend Production Environment (.env.production)

```env
# Production Environment Configuration
NODE_ENV=production

# API Configuration - Update these with your production domains
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_BACKEND_URL=https://yourdomain.com
REACT_APP_MEETING_SERVER_URL=https://yourdomain.com

# Agora Configuration - Use production credentials
REACT_APP_AGORA_APP_ID=your_production_agora_app_id
REACT_APP_WHITEBOARD_APP_ID=your_production_whiteboard_app_id

# Vite-specific Configuration (if using Vite builds)
VITE_AGORA_APP_ID=your_production_agora_app_id
VITE_AGORA_CHAT_APP_KEY=your_production_chat_app_key
VITE_WHITEBOARD_APP_ID=your_production_whiteboard_identifier

# External Services
REACT_APP_UI_AVATARS_BASE_URL=https://ui-avatars.com/api

# Build Configuration
GENERATE_SOURCEMAP=false
```

## 📁 Backend Production Environment (.env.production)

```env
# Production Environment Configuration
NODE_ENV=production
PORT=5000

# Database Configuration - Use production MongoDB
MONGO_URI=mongodb://your-production-mongodb-url/tutor_production

# JWT Configuration - Use strong secrets (generate new ones)
JWT_SECRET=your_super_secure_production_jwt_secret_here_make_it_long_and_complex
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_here_make_it_long_and_complex

# Frontend Configuration
FRONTEND_URL=https://yourdomain.com

# CORS Configuration
CORS_ORIGIN_1=https://yourdomain.com
CORS_ORIGIN_2=https://www.yourdomain.com
CORS_ORIGIN_3=https://api.yourdomain.com

# Production Domain
PRODUCTION_DOMAIN=https://yourdomain.com

# Agora Production Credentials
AGORA_APP_ID=your_production_agora_app_id
AGORA_APP_CERTIFICATE=your_production_agora_certificate
AGORA_CHAT_APP_KEY=your_production_chat_app_key

# Whiteboard Configuration
WHITEBOARD_APP_ID=your_production_whiteboard_app_id
WHITEBOARD_APP_KEY=your_production_whiteboard_key
WHITEBOARD_APP_SECRET=your_production_whiteboard_secret

# Email Configuration (Production)
EMAIL_HOST=smtp.yourmailprovider.com
EMAIL_PORT=587
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASS=your_secure_email_password

# Security Configuration
BCRYPT_SALT_ROUNDS=12
ACCOUNT_LOCK_TIME=7200000
MAX_LOGIN_ATTEMPTS=5

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=warn
LOG_FILE=logs/production.log
```

## 🔧 Critical Security Issues to Address:

### 1. JWT Secrets
- Current JWT secrets are weak
- Generate strong secrets using: `openssl rand -base64 64`

### 2. Database Security
- Use MongoDB Atlas or secure self-hosted MongoDB
- Enable authentication and SSL
- Regular backups

### 3. API Keys Management
- Move all sensitive keys to environment variables
- Use different keys for production vs development
- Rotate keys regularly

### 4. HTTPS/SSL
- Use SSL certificates (Let's Encrypt is free)
- Force HTTPS redirects
- Secure cookies and headers

## 📋 Production Readiness Checklist:

### Security ✅
- [ ] Strong JWT secrets
- [ ] Environment variables for all credentials
- [ ] HTTPS/SSL certificates
- [ ] Secure database connection
- [ ] Rate limiting enabled
- [ ] CORS properly configured

### Performance ✅
- [ ] Bundle optimization
- [ ] Image compression
- [ ] CDN for static assets
- [ ] Database indexing
- [ ] Caching strategy

### Monitoring ✅
- [ ] Error logging (Sentry/Winston)
- [ ] Performance monitoring
- [ ] Health check endpoints
- [ ] Database monitoring
- [ ] Uptime monitoring

### Deployment ✅
- [ ] CI/CD pipeline
- [ ] Docker containers
- [ ] Database migrations
- [ ] Backup strategies
- [ ] Rollback procedures

## 🚀 Immediate Action Items:

1. **Replace hardcoded URLs** (In Progress)
2. **Generate secure JWT secrets**
3. **Set up production database**
4. **Configure SSL certificates**
5. **Set up monitoring and logging**
6. **Create deployment pipeline**