# BTC Tracker 💪

**Self-hosted Bitcoin portfolio tracker for true HODLers**

Track your Bitcoin investments completely privately on your own server. No wallet connections needed - just manually enter your holdings and get real-time prices from Yahoo Finance. No third parties, no data sharing, complete control. 

This project is built on fundation of https://github.com/wilqq-the/BTC-Tracker

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- 5 minutes of your time

### 1. Download & Setup
```bash
# Download docker-compose.yml and environment file
wget https://raw.githubusercontent.com/wilqq-the/BTC Tracker/main/docker-compose.yml
wget https://raw.githubusercontent.com/wilqq-the/BTC Tracker/main/docker.env.example -O .env
```

Or clone the repository:
```bash
git clone https://github.com/wilqq-the/BTC Tracker.git
cd BTC Tracker
cp docker.env.example .env
```

### 2. Configure Environment
Edit `.env` file:
```env
# Generate a secure secret (required)
NEXTAUTH_SECRET=your-super-secure-secret-key-here

# Database will be created automatically
DATABASE_URL=file:../BTC Tracker.db
```

### 3. Start BTC Tracker
```bash
docker-compose up -d
```

### 4. Access Your Tracker
Open `http://localhost:3000` in your browser.

That's it! 🎉

## 🔧 Management

### View Logs
```bash
docker-compose logs -f BTC Tracker
```

### Stop/Start
```bash
docker-compose down
docker-compose up -d
```

### Backup Your Data
```bash
# Your Bitcoin data is in the BTC Tracker_data volume
docker run --rm -v BTC Tracker_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/BTC Tracker-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 🛡️ Security

- **Self-hosted**: Your data never leaves your server
- **Private**: No external API calls for sensitive data
- **Open Source**: Audit the code yourself

## 📊 Features

- Bitcoin transaction tracking
- Real-time price updates
- Portfolio performance analytics
- Import/export transactions
- Multi-currency support

## 🆘 Need Help?

- Check logs: `docker-compose logs -f BTC Tracker`
- Health check: `curl http://localhost:3000/api/health`
- System status: `curl http://localhost:3000/api/system/status`

## 🔄 CI/CD Pipeline

This project uses GitHub Actions for automated building and testing:

### Docker Images
- **Main branch**: Creates `latest` and `main-{sha}` tags
- **Dev branch**: Creates `dev` and `dev-{sha}` tags
- **Pull Requests**: Builds test images (not pushed)

### Available Images
```bash
# Latest stable release
docker pull thewilqq/BTC Tracker:latest

# Development version
docker pull thewilqq/BTC Tracker:dev
```

### Automated Checks
- Code linting and type checking
- Next.js build verification
- Docker build verification
- Runs on all PRs and pushes

## 📚 Documentation

- **[Database Schema](docs/DATABASE.md)** - Complete SQL structure, tables, and query examples
- [Docker Deployment Guide](DOCKER.md) - Detailed Docker setup and configuration

---

**Happy HODLing!** 🚀 