# Frontend Dockerfile - Multi-stage build
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Fix dependency issues and install
RUN npm cache clean --force && \
    npm install ajv@^8.0.0 --legacy-peer-deps --save-dev && \
    npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application with increased memory
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy environment variables script for runtime
COPY env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
