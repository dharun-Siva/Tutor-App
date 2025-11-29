# Multi-stage build for production optimization
FROM node:18-alpine AS frontend-build

# Set working directory
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY frontend/ ./

# Build the application
RUN npm run build

# Backend build stage
FROM node:18-alpine AS backend-build

# Set working directory
WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY backend/ ./

# Remove dev dependencies for production
RUN npm prune --production

# Final production image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy backend files from backend-build stage
COPY --from=backend-build --chown=nodejs:nodejs /app/backend ./backend

# Copy frontend build from frontend-build stage
COPY --from=frontend-build --chown=nodejs:nodejs /app/frontend/build ./frontend/build

# Create necessary directories
RUN mkdir -p /app/backend/logs /app/backend/uploads && \
    chown -R nodejs:nodejs /app/backend/logs /app/backend/uploads

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node backend/scripts/health-check.js

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/server.js"]