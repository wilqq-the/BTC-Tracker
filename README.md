# BTC Tracker

![Docker Pulls](https://img.shields.io/docker/pulls/thewilqq/btc-tracker?style=flat-square&logo=docker&label=Docker%20Pulls)
![Docker Image Size](https://img.shields.io/docker/image-size/thewilqq/btc-tracker/stable?style=flat-square&logo=docker&label=Image%20Size)
![GitHub Stars](https://img.shields.io/github/stars/wilqq-the/BTC-Tracker?style=flat-square&logo=github&label=Stars)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

**Self-hosted Bitcoin portfolio tracker - that's it.**

Track your Bitcoin investments privately on your own PC. Import transactions from exchanges or add them manually. Multi-user support with admin controls. Your data never leaves your server, period.

## Install on Umbrel

[![Available on Umbrel App Store](public/umbrel.svg)](https://apps.umbrel.com/app/btctracker)

**Special thanks to [@dennysubke](https://github.com/dennysubke) for helping bring BTC Tracker to Umbrel!**


*Install BTC Tracker with one click on your Umbrel home server*

## What it does

- **Multi-user setup** - First user becomes admin, can create accounts for others
- **Import from exchanges** - Kraken, Binance, Coinbase, Strike (auto-detects CSV format)
- **Real-time tracking** - Live Bitcoin prices and portfolio value
- **Charts and analytics** - Interactive price charts with your transaction history
- **Complete privacy** - Everything runs on your server, no external data sharing
- **Multi-currency** - Track in USD, EUR, GBP, PLN, or add custom currencies

## Screenshots

![Dashboard](screenshots/dashboard.png)
*Main portfolio dashboard with real-time Bitcoin tracking*

<details>
<summary>Transactions - Import and management</summary>

![Transactions](screenshots/transactions.png)
*Transaction management and CSV import from exchanges*
</details>

<details>
<summary>Analytics - Charts and performance</summary>

![Analytics](screenshots/analytics.png)
*Advanced portfolio analytics and performance charts*
</details>

<details>
<summary>Admin Panel - Multi-user management</summary>

![Admin Panel](screenshots/admin.png)
*Multi-user management interface (admin only)*
</details>

<details>
<summary>Currencies - Multi-currency support</summary>

![Currencies](screenshots/currencies.png)
*Multi-currency support and custom currency management*
</details>

## Quick Start

**With Docker (recommended):**
```bash
git clone https://github.com/wilqq-the/BTC-Tracker.git
cd BTC-Tracker
cp docker.env.example .env
# Edit .env and add NEXTAUTH_SECRET
docker-compose up -d
```

**Local development:**
```bash
npm install
cp .env.example .env
# Add NEXTAUTH_SECRET to .env
npm exec prisma db push
npm run dev
```

Open `http://localhost:3000` and register the first user (becomes admin automatically).

## How multi-user works

- **First user** = automatic admin
- **Admin panel** in Settings tab (admin users only)
- **Create users** with email/password
- **Each user** sees only their own transactions and portfolio
- **No data mixing** between users

## Admin features

- Create/delete user accounts
- Activate/deactivate users
- View system stats (user count, total transactions)
- Cannot see other users' financial data (privacy protection)

## Importing transactions

1. Export CSV from your exchange (Kraken, Binance, Coinbase, Strike)
2. Go to Transactions tab > Import
3. Drop the CSV file - format detected automatically
4. Review and import

Supports most major exchanges. If yours isn't supported, open an issue with example file.

## Tech stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: SQLite (single file, easy backups)
- **Charts**: TradingView Lightweight Charts
- **Deployment**: Docker

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm test         # Run tests
npm exec prisma studio # Database GUI
```

## Why I built this?

Existing portfolio trackers either:
- Send your data to third parties
- Don't support multiple users
- Have terrible import systems
- Cost money for basic features
- Require xpub or zpub wallet address

This gives you complete control over your Bitcoin tracking data.

## Contributing

Found a bug? Want a feature? Open an issue.

Want to add support for another exchange? Check `PARSER_DEVELOPMENT_GUIDE.md`.

## License

MIT - do what you want with it.

---

**Your Bitcoin data belongs to you, not someone else's.**