# BTC Tracker Docker Deployment Guide

## 🐳 Quick Start

### Using Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd <project-directory>

# 2. Create environment file
cp docker.env.example .env
# Edit .env with your production values

# 3. Build and start the application
docker-compose up -d

# 4. Check if it's running
docker-compose ps
```

Your BTC Tracker application will be available at `http://localhost:3000`

## 🔄 Application Initialization

BTC Tracker uses **application-level initialization** (industry best practice) instead of external init scripts. When the container starts:

1. **Database Auto-Setup**: Automatically detects if database exists
   - If missing: Creates database, runs migrations, seeds initial data
   - If exists: Runs pending migrations only
2. **Service Initialization**: Starts background services (price scheduler, data fetching)
3. **Health Checks**: Application becomes ready when all services are initialized

### Initialization Status

Check initialization progress:
```bash
# Check system status
curl http://localhost:3000/api/system/status

# Check application health
curl http://localhost:3000/api/health
```

### First Startup Logs

Watch for these initialization messages:
```
🚀 Starting BTC Tracker application initialization...
🗄️ Initializing database...
🔍 Testing database connection...
✅ Database initialized
📋 Loading application settings...
💱 Initializing exchange rates...
📈 Initializing historical data service...
⏰ Starting Bitcoin price scheduler...
✅ BTC Tracker application initialized successfully
```

### Using Docker CLI

```bash
# Build the image
docker build -t BTC Tracker .

# Run the container
docker run -d \
  --name BTC Tracker-app \
  -p 3000:3000 \
  -v BTC Tracker_data:/app \
  -e NEXTAUTH_SECRET="your-secure-secret" \
  BTC Tracker
```

---

## 📋 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `production` | Application environment |
| `PORT` | No | `3000` | Port to run the application |
| `DATABASE_URL` | Yes | `file:../BTC Tracker.db` | SQLite database path |
| `NEXTAUTH_SECRET` | Yes | - | JWT secret for authentication |
| `NEXTAUTH_URL` | Yes | - | Full URL of your application |
| `YAHOO_FINANCE_API_KEY` | No | - | Optional API key for Yahoo Finance |

### Production Environment Setup

```bash
# Generate secure secret
export NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Set production URL
export NEXTAUTH_URL="https://yourdomain.com"

# Or create .env file
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=file:../BTC Tracker.db
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXTAUTH_URL=https://yourdomain.com
YAHOO_FINANCE_API_KEY=your-api-key-if-needed
EOF
```

---

## 🔧 Docker Compose Services

### Main Application Service

- **Container**: `BTC Tracker-app`
- **Port**: `3000:3000`
- **Volumes**: 
  - `BTC Tracker_data:/app` (Database and uploads persistence)
- **Health Check**: Monitors `/api/health` endpoint
- **Restart Policy**: `unless-stopped`

---

## 🚀 Deployment Commands

### Development/Testing

```bash
# Build and start in development mode
docker-compose up --build

# View logs
docker-compose logs -f bitcoin-tracker

# Stop services
docker-compose down
```

### Multi-Architecture Builds (for GitHub Actions)

```bash
# Setup buildx (one-time setup)
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t bitcoin-tracker:latest .

# Build and push (for CI/CD)
docker buildx build --platform linux/amd64,linux/arm64 -t your-registry/bitcoin-tracker:latest --push .

# Using docker-compose with buildx
docker buildx bake -f docker-buildx.yml
```

### Production Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f bitcoin-tracker
```

### Database Operations

```bash
# Access database directly
docker-compose exec bitcoin-tracker sqlite3 /app/data/bitcoin-tracker.db

# Backup database
docker-compose exec bitcoin-tracker cp /app/data/bitcoin-tracker.db /app/data/backup-$(date +%Y%m%d).db

# Run migrations manually
docker-compose exec bitcoin-tracker npx prisma migrate deploy

# Check database status
docker-compose exec bitcoin-tracker npx prisma migrate status
```

---

## 📊 Monitoring & Health Checks

### Health Check Endpoints

- **Application**: `http://localhost:3000/api/health`
- **Database**: `http://localhost:3000/api/health/db`
- **System Status**: `http://localhost:3000/api/system/status` (detailed initialization status)

### Docker Health Checks

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect bitcoin-tracker-app | grep -A 10 Health

# Manual health check
curl -f http://localhost:3000/api/health
```

### Log Monitoring

```bash
# Follow all logs
docker-compose logs -f

# Follow specific service logs
docker-compose logs -f bitcoin-tracker

# View last 100 lines
docker-compose logs --tail=100 bitcoin-tracker
```

---

## 💾 Data Persistence

### Volumes

- **`bitcoin_data`**: Contains SQLite database file
- **`bitcoin_uploads`**: Contains user uploaded files (avatars, etc.)

### Backup Strategy

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database volume
docker run --rm -v bitcoin_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine \
  tar czf /backup/bitcoin_data_$DATE.tar.gz -C /data .

# Backup uploads volume
docker run --rm -v bitcoin_uploads:/data -v $(pwd)/$BACKUP_DIR:/backup alpine \
  tar czf /backup/bitcoin_uploads_$DATE.tar.gz -C /data .

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x backup.sh
./backup.sh
```

### Restore from Backup

```bash
# Stop services
docker-compose down

# Restore database
docker run --rm -v bitcoin_data:/data -v $(pwd)/backups:/backup alpine \
  tar xzf /backup/bitcoin_data_YYYYMMDD_HHMMSS.tar.gz -C /data

# Restore uploads
docker run --rm -v bitcoin_uploads:/data -v $(pwd)/backups:/backup alpine \
  tar xzf /backup/bitcoin_uploads_YYYYMMDD_HHMMSS.tar.gz -C /data

# Start services
docker-compose up -d
```

---

## 🔒 Security Considerations

### Production Security Checklist

- [ ] **Strong NEXTAUTH_SECRET**: Use `openssl rand -hex 32`
- [ ] **HTTPS Only**: Set `NEXTAUTH_URL` to HTTPS in production
- [ ] **Environment Variables**: Never commit secrets to git
- [ ] **Container Updates**: Regularly update base images
- [ ] **Volume Permissions**: Ensure proper file permissions
- [ ] **Network Security**: Use Docker networks for service isolation
- [ ] **Resource Limits**: Set memory/CPU limits in production

### Docker Security Best Practices

```yaml
# Add to docker-compose.yml for production
services:
  bitcoin-tracker:
    # ... existing config ...
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache
```

---

## 🐛 Troubleshooting

### Common Issues

1. **Container Won't Start**
   ```bash
   # Check logs
   docker-compose logs bitcoin-tracker
   
   # Check environment variables
   docker-compose exec bitcoin-tracker env | grep -E "(DATABASE_URL|NEXTAUTH)"
   ```

2. **Database Issues**
   ```bash
   # Check database file exists
   docker-compose exec bitcoin-tracker ls -la /app/data/
   
   # Test database connection
   docker-compose exec bitcoin-tracker npx prisma db push --accept-data-loss
   ```

3. **Permission Issues**
   ```bash
   # Fix volume permissions
   docker-compose exec bitcoin-tracker chown -R nextjs:nodejs /app/data /app/public/uploads
   ```

4. **Port Already in Use**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "3001:3000"  # Use port 3001 instead
   ```

### Debug Mode

```bash
# Run with debug output
docker-compose up --build

# Access container shell
docker-compose exec bitcoin-tracker sh

# Check Next.js build
docker-compose exec bitcoin-tracker ls -la .next/
```

---

## 📈 Performance Optimization

### Multi-stage Build Benefits

- ✅ **Smaller Image Size**: Production image excludes dev dependencies
- ✅ **Security**: No source code or build tools in final image
- ✅ **Speed**: Cached layers improve rebuild times
- ✅ **Optimization**: Next.js standalone output reduces bundle size

### Resource Monitoring

```bash
# Monitor resource usage
docker stats bitcoin-tracker-app

# Check image size
docker images bitcoin-tracker

# Analyze image layers
docker history bitcoin-tracker
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and Deploy
        run: |
          docker-compose build
          docker-compose up -d
          
      - name: Health Check
        run: |
          sleep 30
          curl -f http://localhost:3000/api/health
```

---

## 📞 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f bitcoin-tracker`
2. Verify environment variables are set correctly
3. Ensure volumes have proper permissions
4. Check that ports are not already in use
5. Review the health check endpoint: `/api/health`

For more help, check the main application documentation or create an issue in the repository. 