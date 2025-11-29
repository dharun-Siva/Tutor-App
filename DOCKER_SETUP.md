# Docker Setup Guide

This guide explains how to run the Tutor Application using Docker with separate containers for frontend and backend.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Make sure ports 80, 5000, 5432, 27017, and 6379 are available

## Project Structure

```
Tutor-Application/
├── backend/
│   ├── Dockerfile          # Backend container configuration
│   ├── .dockerignore       # Files to exclude from backend image
│   ├── .env               # Backend environment variables (create from .env.example)
│   └── .env.example       # Backend environment template
├── frontend/
│   ├── Dockerfile          # Frontend container configuration
│   ├── nginx.conf         # Nginx configuration for serving React app
│   ├── env.sh            # Runtime environment injection script
│   ├── .dockerignore      # Files to exclude from frontend image
│   ├── .env              # Frontend environment variables (create from .env.example)
│   └── .env.example      # Frontend environment template
└── docker-compose.yml     # Orchestrates all services
```

## Quick Start

### 1. Setup Environment Files

**Backend (.env):**
```bash
cd backend
cp .env.example .env
# Edit backend/.env with your actual values
```

**Frontend (.env):**
```bash
cd frontend
cp .env.example .env
# Edit frontend/.env with your actual values
```

### 2. Configure Environment Variables

**Backend Environment Variables** (`backend/.env`):
- `MONGO_URI` - MongoDB connection string
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - PostgreSQL configuration
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - JWT secrets (generate strong secrets for production)
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` - Agora credentials
- `WHITEBOARD_APP_ID`, `WHITEBOARD_APP_SECRET` - Whiteboard credentials
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` - Email configuration

**Frontend Environment Variables** (`frontend/.env`):
- `REACT_APP_API_URL` - Backend API URL (e.g., http://localhost:5000/api)
- `REACT_APP_BACKEND_URL` - Backend base URL (e.g., http://localhost:5000)
- `REACT_APP_AGORA_APP_ID` - Agora App ID
- `REACT_APP_WHITEBOARD_APP_ID` - Whiteboard App ID

### 3. Build and Run

**Start all services:**
```bash
docker-compose up -d
```

**Build and start (if you made code changes):**
```bash
docker-compose up --build -d
```

**View logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Stop services:**
```bash
docker-compose down
```

**Stop and remove volumes (WARNING: deletes all data):**
```bash
docker-compose down -v
```

## Service URLs

After starting the services:

- **Frontend:** http://localhost
- **Backend API:** http://localhost:5000/api
- **MongoDB:** localhost:27017
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

## Individual Container Commands

### Build Backend Only
```bash
cd backend
docker build -t tutor-backend .
```

### Run Backend Container
```bash
docker run -d \
  --name tutor-backend \
  --env-file .env \
  -p 5000:5000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/logs:/app/logs \
  tutor-backend
```

### Build Frontend Only
```bash
cd frontend
docker build -t tutor-frontend .
```

### Run Frontend Container
```bash
docker run -d \
  --name tutor-frontend \
  --env-file .env \
  -p 80:80 \
  tutor-frontend
```

## Docker Compose Services

The `docker-compose.yml` includes the following services:

1. **mongodb** - MongoDB database (port 27017)
2. **postgres** - PostgreSQL database (port 5432)
3. **redis** - Redis cache (port 6379)
4. **backend** - Node.js backend API (port 5000)
5. **frontend** - React frontend with Nginx (port 80)

## Health Checks

All services include health checks:

**Check service health:**
```bash
docker-compose ps
```

**Backend health endpoint:**
```bash
curl http://localhost:5000/api/health
```

**Frontend health endpoint:**
```bash
curl http://localhost/health
```

## Troubleshooting

### View Container Logs
```bash
# All services
docker-compose logs

# Specific service with timestamps
docker-compose logs -t backend

# Follow logs in real-time
docker-compose logs -f frontend
```

### Restart a Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Rebuild After Code Changes
```bash
docker-compose up --build -d
```

### Access Container Shell
```bash
# Backend
docker-compose exec backend sh

# Frontend
docker-compose exec frontend sh
```

### Check Network Connectivity
```bash
# From backend to mongodb
docker-compose exec backend ping mongodb

# From backend to postgres
docker-compose exec backend ping postgres
```

### Permission Issues
If you encounter permission issues with volumes:
```bash
# Linux/Mac
sudo chown -R $USER:$USER backend/uploads backend/logs

# Windows - run PowerShell as Administrator
icacls "backend\uploads" /grant Users:F /T
icacls "backend\logs" /grant Users:F /T
```

### Port Already in Use
If ports are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"    # Frontend on port 8080 instead of 80
  - "5001:5000"  # Backend on port 5001 instead of 5000
```

## Production Deployment

For production deployment:

1. **Use production environment files**
   ```bash
   cp backend/.env.production backend/.env
   cp frontend/.env.production frontend/.env
   ```

2. **Generate secure secrets**
   ```bash
   node scripts/generate-jwt-secrets.js
   ```

3. **Update docker-compose.yml**
   - Set `NODE_ENV=production`
   - Configure proper database credentials
   - Set up SSL certificates
   - Configure domain names

4. **Use production compose file**
   ```bash
   docker-compose -f docker-compose.production.yml up -d
   ```

5. **Enable SSL** (recommended)
   - Add SSL certificates to `nginx/ssl/`
   - Update `frontend/nginx.conf` to use HTTPS

## Volume Management

**List volumes:**
```bash
docker volume ls
```

**Inspect a volume:**
```bash
docker volume inspect tutor-application_mongodb_data
```

**Backup database volumes:**
```bash
# MongoDB backup
docker-compose exec mongodb mongodump --out=/data/backup

# PostgreSQL backup
docker-compose exec postgres pg_dump -U postgres Tutor_db > backup.sql
```

## Development Mode

For development with hot-reload:

1. **Backend with nodemon:**
   ```yaml
   # In docker-compose.yml, update backend service
   command: npm run dev
   volumes:
     - ./backend:/app
     - /app/node_modules
   ```

2. **Frontend with dev server:**
   ```yaml
   # In docker-compose.yml, update frontend service
   command: npm start
   ports:
     - "3000:3000"
   volumes:
     - ./frontend:/app
     - /app/node_modules
   ```

## Cleanup

**Remove all containers, networks, and volumes:**
```bash
docker-compose down -v
```

**Remove all unused Docker resources:**
```bash
docker system prune -a --volumes
```

## Support

For issues or questions:
- Check the logs: `docker-compose logs -f`
- Ensure all environment variables are set correctly
- Verify all required ports are available
- Check Docker and Docker Compose versions

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique secrets for production
- Keep Docker and base images updated
- Use non-root users in containers (already configured)
- Implement proper firewall rules for production
- Enable SSL/TLS for production deployments
