# Docker Deployment Guide - Separate Services

This guide explains how to deploy frontend, backend, and databases separately using individual Docker Compose files.

## 📁 File Structure

```
Tutor-Application/
├── docker-compose.yml                  # Master file - all services together
├── docker-compose.backend.yml          # Backend service only
├── docker-compose.frontend.yml         # Frontend service only
├── docker-compose.databases.yml        # All databases (MongoDB, PostgreSQL, Redis)
├── docker-compose.production.yml       # Production configuration
├── DOCKER_COMMANDS.md                  # Quick reference commands
├── backend/
│   ├── Dockerfile
│   ├── .env                           # Backend environment variables
│   └── .env.docker                    # Backend Docker-specific environment
└── frontend/
    ├── Dockerfile
    ├── .env                           # Frontend environment variables
    └── .env.docker                    # Frontend Docker-specific environment
```

## 🎯 Deployment Scenarios

### Scenario 1: Full Stack Deployment (Recommended for Development)

Deploy everything together on a single machine:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Services Started:**
- MongoDB (port 27017)
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend (port 5000)
- Frontend (port 80)

---

### Scenario 2: Backend Only Deployment

Deploy only the backend service (useful when databases are hosted elsewhere):

```bash
# Start backend only
docker-compose -f docker-compose.backend.yml up -d

# View backend logs
docker-compose -f docker-compose.backend.yml logs -f backend

# Stop backend
docker-compose -f docker-compose.backend.yml down
```

**Before deploying backend only:**
- Ensure databases (MongoDB, PostgreSQL, Redis) are accessible
- Update `backend/.env` with correct database connection strings
- Set proper CORS origins for frontend

---

### Scenario 3: Frontend Only Deployment

Deploy only the frontend service (useful when backend is hosted elsewhere):

```bash
# Start frontend only
docker-compose -f docker-compose.frontend.yml up -d

# View frontend logs
docker-compose -f docker-compose.frontend.yml logs -f frontend

# Stop frontend
docker-compose -f docker-compose.frontend.yml down
```

**Before deploying frontend only:**
- Ensure backend API is accessible
- Update `frontend/.env` with correct backend URLs
- Configure REACT_APP_API_URL and REACT_APP_BACKEND_URL

---

### Scenario 4: Databases Only Deployment

Deploy only the database services:

```bash
# Start databases
docker-compose -f docker-compose.databases.yml up -d

# View database logs
docker-compose -f docker-compose.databases.yml logs -f

# Stop databases
docker-compose -f docker-compose.databases.yml down
```

**Services Started:**
- MongoDB (port 27017)
- PostgreSQL (port 5432)
- Redis (port 6379)

---

### Scenario 5: Databases + Backend

Deploy databases and backend together (frontend served separately):

```bash
# Start databases and backend
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml up -d

# View logs
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml logs -f

# Stop services
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml down
```

---

### Scenario 6: Backend + Frontend (External Databases)

Deploy backend and frontend together (databases hosted elsewhere):

```bash
# Start backend and frontend
docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml up -d

# View logs
docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml logs -f

# Stop services
docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml down
```

---

## 🔧 Configuration

### Backend Environment Variables (`backend/.env`)

For standalone backend deployment:

```env
# Database connections (use external IPs or hostnames)
MONGO_URI=mongodb://your-mongo-host:27017/tutor1
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
REDIS_URL=redis://:password@your-redis-host:6379

# Other configs...
JWT_SECRET=your_secret
AGORA_APP_ID=your_app_id
```

### Frontend Environment Variables (`frontend/.env`)

For standalone frontend deployment:

```env
# Backend API URL (use actual backend URL)
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_BACKEND_URL=https://api.yourdomain.com

# Other configs...
REACT_APP_AGORA_APP_ID=your_app_id
```

---

## 🌐 Network Configuration

All services use the `tutor-network` Docker network. Services in different compose files can communicate if they share the same network.

### Check Network
```bash
docker network ls | grep tutor
docker network inspect tutor-application_tutor-network
```

### Connect External Container
```bash
docker network connect tutor-application_tutor-network my-external-container
```

---

## 🚀 Production Deployment Examples

### Example 1: Separate Servers

**Server 1 (Database Server):**
```bash
# Deploy databases only
docker-compose -f docker-compose.databases.yml up -d
```

**Server 2 (Backend Server):**
```bash
# Configure backend/.env with database server IPs
# Then deploy backend
docker-compose -f docker-compose.backend.yml up -d
```

**Server 3 (Frontend Server):**
```bash
# Configure frontend/.env with backend server IP
# Then deploy frontend
docker-compose -f docker-compose.frontend.yml up -d
```

---

### Example 2: Backend and Frontend on Same Server

```bash
# Deploy databases on separate server first
# Then on application server:

# Configure environment files
cp backend/.env.docker backend/.env
cp frontend/.env.docker frontend/.env

# Edit .env files with production values
nano backend/.env
nano frontend/.env

# Deploy backend and frontend
docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml up -d
```

---

### Example 3: Everything on One Server

```bash
# Use the master compose file
docker-compose up -d

# Or use production compose file
docker-compose -f docker-compose.production.yml up -d
```

---

## 📊 Monitoring and Health Checks

### Check Service Status
```bash
# All services
docker-compose ps

# Backend only
docker-compose -f docker-compose.backend.yml ps

# Frontend only
docker-compose -f docker-compose.frontend.yml ps

# Databases only
docker-compose -f docker-compose.databases.yml ps
```

### Health Check Endpoints
```bash
# Backend
curl http://localhost:5000/api/health

# Frontend
curl http://localhost/health
```

---

## 🔄 Updating Services

### Update Backend
```bash
# Pull latest code
git pull

# Rebuild and restart backend
docker-compose -f docker-compose.backend.yml up --build -d

# Check logs
docker-compose -f docker-compose.backend.yml logs -f backend
```

### Update Frontend
```bash
# Pull latest code
git pull

# Rebuild and restart frontend
docker-compose -f docker-compose.frontend.yml up --build -d

# Check logs
docker-compose -f docker-compose.frontend.yml logs -f frontend
```

---

## 🛠️ Troubleshooting

### Backend Can't Connect to Databases

1. **Check network connectivity:**
   ```bash
   docker-compose -f docker-compose.backend.yml exec backend ping mongodb
   docker-compose -f docker-compose.backend.yml exec backend ping postgres
   ```

2. **Verify environment variables:**
   ```bash
   docker-compose -f docker-compose.backend.yml exec backend env | grep MONGO
   docker-compose -f docker-compose.backend.yml exec backend env | grep POSTGRES
   ```

3. **Check database health:**
   ```bash
   docker-compose -f docker-compose.databases.yml ps
   ```

### Frontend Can't Connect to Backend

1. **Check backend health:**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Verify frontend environment:**
   ```bash
   docker-compose -f docker-compose.frontend.yml exec frontend cat /usr/share/nginx/html/env-config.js
   ```

3. **Check Nginx logs:**
   ```bash
   docker-compose -f docker-compose.frontend.yml logs frontend
   ```

### Port Already in Use

Modify port mappings in respective compose files:

```yaml
# docker-compose.backend.yml
services:
  backend:
    ports:
      - "5001:5000"  # Use port 5001 instead of 5000

# docker-compose.frontend.yml
services:
  frontend:
    ports:
      - "8080:80"  # Use port 8080 instead of 80
```

---

## 💾 Backup and Restore

### Backup Individual Databases
```bash
# MongoDB
docker-compose -f docker-compose.databases.yml exec mongodb mongodump --out=/data/backup
docker cp $(docker-compose -f docker-compose.databases.yml ps -q mongodb):/data/backup ./mongodb-backup

# PostgreSQL
docker-compose -f docker-compose.databases.yml exec postgres pg_dump -U postgres Tutor_db > backup.sql
```

### Restore Databases
```bash
# MongoDB
docker cp ./mongodb-backup $(docker-compose -f docker-compose.databases.yml ps -q mongodb):/data/restore
docker-compose -f docker-compose.databases.yml exec mongodb mongorestore /data/restore

# PostgreSQL
cat backup.sql | docker-compose -f docker-compose.databases.yml exec -T postgres psql -U postgres -d Tutor_db
```

---

## 🧹 Cleanup

### Stop and Remove Services
```bash
# Stop specific service
docker-compose -f docker-compose.backend.yml down
docker-compose -f docker-compose.frontend.yml down
docker-compose -f docker-compose.databases.yml down

# Stop all services with volumes (WARNING: DATA LOSS)
docker-compose down -v
```

### Remove Unused Resources
```bash
# Remove stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Complete cleanup
docker system prune -a --volumes
```

---

## 📝 Quick Reference

| Scenario | Command |
|----------|---------|
| Full stack | `docker-compose up -d` |
| Backend only | `docker-compose -f docker-compose.backend.yml up -d` |
| Frontend only | `docker-compose -f docker-compose.frontend.yml up -d` |
| Databases only | `docker-compose -f docker-compose.databases.yml up -d` |
| DB + Backend | `docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml up -d` |
| Backend + Frontend | `docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml up -d` |
| Stop all | `docker-compose down` |
| View logs | `docker-compose logs -f` |

For more detailed commands, see `DOCKER_COMMANDS.md`.

---

## 🔐 Security Best Practices

1. **Change default passwords** in production
2. **Use environment-specific .env files** (.env.production, .env.staging)
3. **Enable SSL/TLS** for production deployments
4. **Restrict port access** using firewall rules
5. **Use secrets management** for sensitive data
6. **Regular security updates** of base images
7. **Implement proper logging** and monitoring

---

## 📞 Support

For issues or questions:
- Check logs: `docker-compose -f <file> logs -f`
- Verify environment variables
- Ensure proper network connectivity
- Check service health endpoints

Happy Deploying! 🚀
