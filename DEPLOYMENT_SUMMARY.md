# Docker Deployment - Quick Start Guide

## ✅ What Was Created

### Separate Docker Configuration Files

1. **Backend Dockerfile** (`backend/Dockerfile`)
   - Standalone backend container
   - Includes all backend dependencies
   - Uses Node.js 18 Alpine
   - Runs on port 5000

2. **Frontend Dockerfile** (`frontend/Dockerfile`)  
   - Multi-stage build (build + nginx)
   - Builds React app
   - Serves via Nginx
   - Runs on port 80

3. **Docker Compose Files**
   - `docker-compose.yml` - Full stack (all services)
   - `docker-compose.backend.yml` - Backend only
   - `docker-compose.frontend.yml` - Frontend only
   - `docker-compose.databases.yml` - All databases

### Environment Files

- `backend/.env` - Backend environment variables
- `backend/.env.docker` - Backend Docker template
- `frontend/.env` - Frontend environment variables
- `frontend/.env.docker` - Frontend Docker template

## 🚀 How to Deploy

### Option 1: Deploy Everything Together
```bash
docker-compose up -d
```

### Option 2: Deploy Services Separately
```bash
# Databases only
docker-compose -f docker-compose.databases.yml up -d

# Backend only
docker-compose -f docker-compose.backend.yml up -d

# Frontend only
docker-compose -f docker-compose.frontend.yml up -d
```

### Option 3: Deploy Multiple Services
```bash
# Databases + Backend + Frontend
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml -f docker-compose.frontend.yml up -d
```

## 🔧 Issues Fixed

### 1. Frontend Build Issues
**Problem:** `npm ci` failed because package-lock.json was missing
**Solution:** Changed to `npm install --legacy-peer-deps` in Dockerfile

### 2. ajv Module Error
**Problem:** `Error: Cannot find module 'ajv/dist/compile/codegen'`
**Solution:** Added explicit ajv@^8.0.0 installation before other dependencies

### 3. Material-UI Missing
**Problem:** `Module not found: @mui/icons-material/NavigateNext`
**Solution:** Added Material-UI dependencies to package.json:
- @mui/icons-material
- @mui/material
- @emotion/react
- @emotion/styled

### 4. Backend Module Case Sensitivity
**Problem:** `Error: Cannot find module './User'` (file is user.js)
**Solution:** Fixed require in associations.js to use lowercase `'./user'`

## 📦 Current Status

All services are running:
- ✅ MongoDB (port 27017) - Healthy
- ✅ PostgreSQL (port 5432) - Healthy
- ✅ Redis (port 6379) - Healthy
- ✅ Backend (port 5000) - Running
- ✅ Frontend (port 80) - Running

## 🌐 Access URLs

- **Frontend:** http://localhost
- **Backend API:** http://localhost:5000/api
- **Backend Health:** http://localhost:5000/api/health
- **Frontend Health:** http://localhost/health

## 📝 Next Steps

1. **Configure Environment Variables**
   ```bash
   # Copy and edit backend .env
   cd backend
   cp .env.example .env
   # Edit .env with your values
   
   # Copy and edit frontend .env
   cd ../frontend
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Rebuild with New Config**
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

3. **Check Logs**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

4. **Access the Application**
   - Open browser to http://localhost
   - Backend API at http://localhost:5000/api

## 🛠️ Useful Commands

```bash
# View running containers
docker ps

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Rebuild specific service
docker-compose -f docker-compose.backend.yml up --build -d

# View logs
docker-compose logs -f backend

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# Check service health
docker-compose ps
```

## 📚 Documentation

See these files for detailed information:
- `DEPLOYMENT_GUIDE.md` - Comprehensive deployment scenarios
- `DOCKER_COMMANDS.md` - Command reference
- `DOCKER_SETUP.md` - Setup and configuration guide

## ✨ Benefits of Separate Dockerfiles

1. **Independent Deployment** - Deploy frontend and backend on different servers
2. **Easier Scaling** - Scale services independently
3. **Better CI/CD** - Build and deploy services separately
4. **Flexibility** - Mix local and containerized services
5. **Cleaner Organization** - Each service has its own configuration
6. **Faster Builds** - Only rebuild what changed

## 🎯 Production Deployment

For production, use:
```bash
# Copy production env files
cp backend/.env.production backend/.env
cp frontend/.env.production frontend/.env

# Deploy with production compose file
docker-compose -f docker-compose.production.yml up -d
```

---

**Created:** November 10, 2025
**Status:** ✅ All services running successfully
