# Backend Dockerfile
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install for flexibility)
RUN npm install --only=production --legacy-peer-deps

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app/logs /app/uploads

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
