# ₿ BTC Tracker v0.6.0

**100% Private, Self-Hosted Bitcoin Portfolio Tracker**

A completely private Bitcoin portfolio tracker that runs on your own server. Import transactions from major exchanges (Kraken, Binance, Coinbase, Strike) with automatic format detection, or add them manually. Real-time price data fetched from Yahoo Finance. Your data never leaves your server - no third parties, no tracking, no analytics.

## 🔑 Key Features

- **🔒 Complete Privacy**: All data stays on your server - no external services, no tracking
- **📥 Exchange Import**: Automatic format detection for Kraken, Binance, Coinbase, Strike CSV exports
- **📊 Real-time Prices**: Live Bitcoin prices and historical data from Yahoo Finance
- **📈 Advanced Charts**: Interactive price charts with transaction markers and P&L visualization
- **💰 Portfolio Analytics**: Track ROI, average buy price, total holdings, and performance metrics
- **🌍 Multi-currency**: Full support for USD, EUR, PLN, GBP, and custom currencies

## 🚀 Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/wilqq-the/BTC-Tracker.git
cd BTC-Tracker

# 2. Set up environment
cp docker.env.example .env

# 3. Generate a secure secret
openssl rand -base64 32
# Add to .env file as NEXTAUTH_SECRET=your-generated-secret

# 4. Start the application
docker-compose up -d
```

Access at `http://localhost:3000`

## 💻 Development Setup (Without Docker)

```bash
# 1. Clone and install
git clone https://github.com/wilqq-the/BTC-Tracker.git
cd BTC-Tracker
npm install

# 2. Set up environment
cp .env.example .env
# Generate secret: openssl rand -base64 32
# Add to .env as NEXTAUTH_SECRET=your-secret

# 3. Initialize database
npx prisma db push
npm run db:seed  # Optional: sample data

# 4. Start development server
npm run dev
```

Access at `http://localhost:3000`

### Development Commands

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm start           # Run production build
npm test            # Run tests
npm run db:studio   # Open database GUI
npm run db:reset    # Reset database
```

## ✨ Complete Feature Set

### Portfolio Management
- **Transaction Tracking**: Record all Bitcoin buys and sells
- **Import/Export**: 
  - Import CSV from exchanges (auto-detects format)
  - Export your data anytime
  - Supported: Kraken, Binance, Coinbase, Strike
- **Manual Entry**: Add transactions manually with custom notes
- **Multi-currency Support**: Track transactions in any currency

### Analytics & Visualization
- **Interactive Charts**: 
  - Candlestick, line, and area charts
  - Transaction markers with P&L coloring
  - Zoom and pan functionality
- **Performance Metrics**:
  - Total portfolio value
  - Unrealized P&L
  - Average buy price
  - ROI percentage
- **Historical Data**: Full price history with hourly updates

### Privacy & Security
- **100% Self-hosted**: No external dependencies for sensitive data
- **No Wallet Connection**: Manual/import only for maximum security
- **PIN Protection**: Optional quick-access PIN
- **Local Authentication**: Built-in auth system, no third parties
- **Data Ownership**: Export your data anytime

### User Experience
- **Dark/Light Mode**: Automatic theme switching
- **Real-time Updates**: Live price updates every 30 seconds
- **Custom Currencies**: Add any currency pair
- **Transaction Notes**: Add context to your trades

## 📁 Project Structure

```
BTC-Tracker/
├── src/              # Next.js application source
│   ├── app/          # App router pages and API routes
│   ├── components/   # React components
│   └── lib/          # Business logic and services
├── prisma/           # Database schema and migrations
├── public/           # Static assets
├── scripts/          # Utility scripts
├── docker-compose.yml # Docker configuration
└── Dockerfile        # Container build instructions
```

## ⚙️ Configuration

### Environment Variables

- `NEXTAUTH_SECRET`: Required. Authentication secret key
- `DATABASE_URL`: SQLite database location (default: `file:../btc-tracker.db`)
- `NEXTAUTH_URL`: Application URL (default: `http://localhost:3000`)
- `NODE_ENV`: Environment (development/production)

### Default Setup

- First user registered becomes the admin
- No default accounts for security
- Sample data available via seed script

## 🗺️ Roadmap

### Currently Working
- [x] Core portfolio tracking
- [x] Exchange CSV import
- [x] Real-time price updates
- [x] Interactive charts
- [x] Multi-currency support
- [x] Docker deployment

### Coming Soon
- [ ] Mobile responsive design (in progress)
- [ ] API for external integrations

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (portable, no setup required)
- **Charts**: TradingView Lightweight Charts
- **Auth**: NextAuth.js
- **Deployment**: Docker, Node.js

> **Note**: Desktop app (Electron) support was removed to focus on web performance and faster development cycles.

## 🔐 Security

- All data encrypted at rest
- No external API calls for user data
- Price data only from Yahoo Finance
- No tracking or analytics
- Regular security updates

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/wilqq-the/BTC-Tracker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/wilqq-the/BTC-Tracker/discussions)
- **Updates**: Watch the repo for new releases

## 📄 License

MIT License - feel free to use for your personal Bitcoin tracking needs!

## 🙏 Credits

Built on the foundation of [https://github.com/wilqq-the/BTC-Tracker](https://github.com/wilqq-the/BTC-Tracker) (Legacy)

---

**⚠️ Note**: This is a personal finance tool. Not financial advice. Always do your own research.

**🛡️ Privacy First**: Your data, your server, your control. We believe in true digital sovereignty.