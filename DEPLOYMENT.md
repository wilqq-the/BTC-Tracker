# BTC Tracker Deployment Guide

## 🚀 Quick Start (Docker Volumes)

**Simplest setup using Docker managed volumes:**

```bash
# Clone and setup
git clone https://github.com/your-username/BTC-Tracker.git
cd BTC-Tracker
cp docker.env.example .env

# Edit .env and set NEXTAUTH_SECRET
nano .env

# Start the application
docker-compose up -d
```

**Database location:** Managed by Docker (use `docker volume inspect btc_tracker_data`)

---

## 📁 Host Directory Mounting

**Use host directories for easier access to your data:**

### Option 1: Current Directory
```bash
# Use the included host-volumes compose file
docker-compose -f docker-compose.host-volumes.yml up -d

# Your data will be in:
# ./btc-tracker-data/btc-tracker.db  (database)
# ./btc-tracker-uploads/             (avatar images)
```

### Option 2: Custom Host Directories
```yaml
# Create custom docker-compose.yml
version: '3.8'
services:
  btc-tracker:
    image: thewilqq/btc-tracker:latest
    ports:
      - "3000:3000"
    environment:
      - NEXTAUTH_SECRET=your-secret-here
      - NEXTAUTH_URL=http://localhost:3000
    volumes:
      # Mount any host directory you want
      - /path/to/your/data:/app/data
      - /path/to/your/uploads:/app/public/uploads
    restart: unless-stopped
```

### Option 3: NAS/Network Storage
```yaml
volumes:
  # Mount network storage
  - /mnt/nas/btc-tracker:/app/data
  - /mnt/nas/btc-tracker/uploads:/app/public/uploads
```

---

## 🔧 Configuration Examples

### Home Server Setup
```yaml
# docker-compose.yml for home server
services:
  btc-tracker:
    image: thewilqq/btc-tracker:latest
    ports:
      - "3000:3000"
    environment:
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=http://192.168.1.100:3000  # Your server IP
    volumes:
      - /home/user/btc-tracker:/app/data
      - /home/user/btc-tracker/uploads:/app/public/uploads
    restart: unless-stopped
```

### VPS/Cloud Setup
```yaml
# docker-compose.yml for VPS
services:
  btc-tracker:
    image: thewilqq/btc-tracker:latest
    ports:
      - "3000:3000"
    environment:
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=https://btc-tracker.yourdomain.com
    volumes:
      - /opt/btc-tracker/data:/app/data
      - /opt/btc-tracker/uploads:/app/public/uploads
    restart: unless-stopped
```

### Development Setup
```yaml
# docker-compose.dev.yml for development
services:
  btc-tracker:
    image: thewilqq/btc-tracker:dev  # Use dev tag
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - NEXTAUTH_SECRET=dev-secret-not-secure
      - NEXTAUTH_URL=http://localhost:3000
    volumes:
      - ./dev-data:/app/data
    restart: unless-stopped
```

---

## 📋 Directory Structure

After deployment, your directory structure will be:

```
your-chosen-directory/
├── btc-tracker.db          # SQLite database file
└── uploads/                # Avatar images (if using host volumes)
    └── avatars/
        ├── user1.jpg
        └── user2.png
```

---

## 🛠️ Management Commands

### Backup Database
```bash
# Copy database from Docker volume
docker cp btc-tracker-app:/app/data/btc-tracker.db ./backup-$(date +%Y%m%d).db

# Or if using host volumes
cp ./btc-tracker-data/btc-tracker.db ./backup-$(date +%Y%m%d).db
```

### Restore Database
```bash
# Copy database to Docker volume
docker cp ./backup.db btc-tracker-app:/app/data/btc-tracker.db
docker restart btc-tracker-app

# Or if using host volumes
cp ./backup.db ./btc-tracker-data/btc-tracker.db
docker restart btc-tracker-app
```

### View Logs
```bash
docker logs btc-tracker-app
docker logs -f btc-tracker-app  # Follow logs
```

### Update Application
```bash
# Pull latest image
docker pull thewilqq/btc-tracker:latest

# Restart with new image
docker-compose down
docker-compose up -d
```

---

## 🔒 Security Considerations

1. **NEXTAUTH_SECRET**: Use a strong, random secret
   ```bash
   # Generate secure secret
   openssl rand -base64 32
   ```

2. **File Permissions**: Ensure proper permissions on host directories
   ```bash
   chmod 755 ./btc-tracker-data
   chmod 644 ./btc-tracker-data/btc-tracker.db
   ```

3. **Reverse Proxy**: Use nginx/traefik for HTTPS in production

4. **Firewall**: Only expose port 3000 to trusted networks

---

## 🐛 Troubleshooting

### Database Issues
- **Permission denied**: Check host directory permissions
- **Database locked**: Ensure only one container is running
- **Corruption**: Restore from backup

### Connection Issues
- **Can't connect**: Check port mapping and firewall
- **403/401 errors**: Verify NEXTAUTH_SECRET and NEXTAUTH_URL

### Performance Issues
- **Slow startup**: Normal on first run (database initialization)
- **High memory**: Consider resource limits in docker-compose

---

## 📊 Monitoring

Add monitoring to your docker-compose:

```yaml
# Add to your docker-compose.yml
services:
  btc-tracker:
    # ... existing config
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```
