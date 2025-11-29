# Docker Compose Deployment Scripts
# Collection of helper commands for different deployment scenarios

## Full Stack Deployment (All Services)
```bash
# Start all services (databases + backend + frontend)
docker-compose -f docker-compose.yml up -d

# Build and start all services
docker-compose -f docker-compose.yml up --build -d

# Stop all services
docker-compose -f docker-compose.yml down

# Stop and remove volumes
docker-compose -f docker-compose.yml down -v

# View logs
docker-compose -f docker-compose.yml logs -f
```

## Backend Only Deployment
```bash
# Start only backend (assumes external databases)
docker-compose -f docker-compose.backend.yml up -d

# Build and start backend
docker-compose -f docker-compose.backend.yml up --build -d

# Stop backend
docker-compose -f docker-compose.backend.yml down

# View backend logs
docker-compose -f docker-compose.backend.yml logs -f backend
```

## Frontend Only Deployment
```bash
# Start only frontend (assumes backend is running elsewhere)
docker-compose -f docker-compose.frontend.yml up -d

# Build and start frontend
docker-compose -f docker-compose.frontend.yml up --build -d

# Stop frontend
docker-compose -f docker-compose.frontend.yml down

# View frontend logs
docker-compose -f docker-compose.frontend.yml logs -f frontend
```

## Databases Only Deployment
```bash
# Start only databases (MongoDB, PostgreSQL, Redis)
docker-compose -f docker-compose.databases.yml up -d

# Stop databases
docker-compose -f docker-compose.databases.yml down

# View database logs
docker-compose -f docker-compose.databases.yml logs -f
```

## Combined Deployment Scenarios

### Databases + Backend
```bash
# Start databases and backend together
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml up -d

# Stop databases and backend
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml down
```

### Databases + Frontend
```bash
# Start databases and frontend together
docker-compose -f docker-compose.databases.yml -f docker-compose.frontend.yml up -d

# Stop databases and frontend
docker-compose -f docker-compose.databases.yml -f docker-compose.frontend.yml down
```

### Backend + Frontend (External Databases)
```bash
# Start both applications (assumes databases are external or already running)
docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml up -d

# Stop both applications
docker-compose -f docker-compose.backend.yml -f docker-compose.frontend.yml down
```

### Full Custom Deployment
```bash
# Start all services using separate files
docker-compose \
  -f docker-compose.databases.yml \
  -f docker-compose.backend.yml \
  -f docker-compose.frontend.yml \
  up -d

# Stop all services
docker-compose \
  -f docker-compose.databases.yml \
  -f docker-compose.backend.yml \
  -f docker-compose.frontend.yml \
  down
```

## Production Deployment

### Using Production Compose File
```bash
# Start production services
docker-compose -f docker-compose.production.yml up -d

# Build and start
docker-compose -f docker-compose.production.yml up --build -d

# Stop production services
docker-compose -f docker-compose.production.yml down
```

## Scaling Services

### Scale Backend
```bash
# Scale backend to 3 instances
docker-compose -f docker-compose.backend.yml up -d --scale backend=3

# Scale with databases
docker-compose -f docker-compose.databases.yml -f docker-compose.backend.yml up -d --scale backend=3
```

### Scale Frontend
```bash
# Scale frontend to 2 instances (different ports required)
docker-compose -f docker-compose.frontend.yml up -d --scale frontend=2
```

## Development Mode

### Backend Development
```bash
# Run backend in development mode with volume mounts
docker-compose -f docker-compose.backend.yml \
  -f docker-compose.backend.dev.yml up -d
```

### Frontend Development
```bash
# Run frontend in development mode
docker-compose -f docker-compose.frontend.yml \
  -f docker-compose.frontend.dev.yml up -d
```

## Health Checks

### Check Service Status
```bash
# Check all services
docker-compose -f docker-compose.yml ps

# Check backend only
docker-compose -f docker-compose.backend.yml ps

# Check frontend only
docker-compose -f docker-compose.frontend.yml ps

# Check databases only
docker-compose -f docker-compose.databases.yml ps
```

### Manual Health Check
```bash
# Backend health
curl http://localhost:5000/api/health

# Frontend health
curl http://localhost/health

# MongoDB health
docker-compose -f docker-compose.databases.yml exec mongodb mongosh --eval "db.adminCommand('ping')"

# PostgreSQL health
docker-compose -f docker-compose.databases.yml exec postgres pg_isready

# Redis health
docker-compose -f docker-compose.databases.yml exec redis redis-cli ping
```

## Logs and Debugging

### View Logs
```bash
# All services
docker-compose -f docker-compose.yml logs -f

# Backend logs
docker-compose -f docker-compose.backend.yml logs -f backend

# Frontend logs
docker-compose -f docker-compose.frontend.yml logs -f frontend

# Database logs
docker-compose -f docker-compose.databases.yml logs -f mongodb
docker-compose -f docker-compose.databases.yml logs -f postgres
docker-compose -f docker-compose.databases.yml logs -f redis

# Last 100 lines
docker-compose -f docker-compose.backend.yml logs --tail=100 backend
```

### Access Container Shell
```bash
# Backend shell
docker-compose -f docker-compose.backend.yml exec backend sh

# Frontend shell
docker-compose -f docker-compose.frontend.yml exec frontend sh

# MongoDB shell
docker-compose -f docker-compose.databases.yml exec mongodb mongosh

# PostgreSQL shell
docker-compose -f docker-compose.databases.yml exec postgres psql -U postgres -d Tutor_db

# Redis shell
docker-compose -f docker-compose.databases.yml exec redis redis-cli
```

## Backup and Restore

### Backup Databases
```bash
# MongoDB backup
docker-compose -f docker-compose.databases.yml exec mongodb mongodump --out=/data/backup
docker cp $(docker-compose -f docker-compose.databases.yml ps -q mongodb):/data/backup ./mongodb-backup

# PostgreSQL backup
docker-compose -f docker-compose.databases.yml exec postgres pg_dump -U postgres Tutor_db > backup.sql

# Redis backup
docker-compose -f docker-compose.databases.yml exec redis redis-cli --rdb /data/dump.rdb SAVE
```

### Restore Databases
```bash
# MongoDB restore
docker cp ./mongodb-backup $(docker-compose -f docker-compose.databases.yml ps -q mongodb):/data/restore
docker-compose -f docker-compose.databases.yml exec mongodb mongorestore /data/restore

# PostgreSQL restore
cat backup.sql | docker-compose -f docker-compose.databases.yml exec -T postgres psql -U postgres -d Tutor_db
```

## Network Management

### Inspect Network
```bash
# List networks
docker network ls

# Inspect tutor-network
docker network inspect tutor-application_tutor-network
```

### Connect External Container
```bash
# Connect an external container to the network
docker network connect tutor-application_tutor-network <container_name>
```

## Volume Management

### List Volumes
```bash
docker volume ls | grep tutor
```

### Inspect Volumes
```bash
# MongoDB volume
docker volume inspect tutor-application_mongodb_data

# PostgreSQL volume
docker volume inspect tutor-application_postgres_data

# Redis volume
docker volume inspect tutor-application_redis_data
```

### Cleanup
```bash
# Remove all stopped containers
docker-compose -f docker-compose.yml rm -f

# Remove all volumes (WARNING: DATA LOSS)
docker-compose -f docker-compose.yml down -v

# Prune unused volumes
docker volume prune

# Complete cleanup
docker-compose -f docker-compose.yml down -v --remove-orphans
docker system prune -a --volumes
```

## Environment-Specific Deployments

### Development
```bash
docker-compose -f docker-compose.yml up -d
```

### Staging
```bash
# Use staging env files
docker-compose --env-file .env.staging -f docker-compose.yml up -d
```

### Production
```bash
# Use production env files
docker-compose --env-file .env.production -f docker-compose.production.yml up -d
```

## CI/CD Integration

### Build Images
```bash
# Build backend image
docker-compose -f docker-compose.backend.yml build

# Build frontend image
docker-compose -f docker-compose.frontend.yml build

# Build all images
docker-compose -f docker-compose.yml build
```

### Push to Registry
```bash
# Tag images
docker tag tutor-application_backend:latest your-registry/tutor-backend:latest
docker tag tutor-application_frontend:latest your-registry/tutor-frontend:latest

# Push images
docker push your-registry/tutor-backend:latest
docker push your-registry/tutor-frontend:latest
```

### Pull and Deploy
```bash
# Pull images
docker pull your-registry/tutor-backend:latest
docker pull your-registry/tutor-frontend:latest

# Deploy
docker-compose -f docker-compose.yml up -d
```

## Monitoring

### Resource Usage
```bash
# Monitor all containers
docker stats

# Monitor specific service
docker stats $(docker-compose -f docker-compose.backend.yml ps -q backend)
```

### Restart Policies
```bash
# Restart a service
docker-compose -f docker-compose.backend.yml restart backend

# Restart all services
docker-compose -f docker-compose.yml restart
```
