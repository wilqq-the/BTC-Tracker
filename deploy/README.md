# BTC Tracker — Cloud Deployment Options

Deploy BTC Tracker to the cloud with one click. All options below support persistent storage for SQLite so your data survives restarts and redeploys.

## Options at a glance

| Platform | Difficulty | Free tier | Persistent storage | Best for |
|---|---|---|---|---|
| [Railway](railway/) | Easiest | Limited (trial credits) | Yes (volumes) | Beginners |
| [Render](render/) | Easy | Yes (ephemeral only) | Paid plans only | Budget-conscious |
| [Coolify](coolify/) | Moderate | Self-hosted | Yes (host volume) | Privacy-first / homelab |

## Common environment variables

All platforms require these environment variables:

| Variable | Description | Example |
|---|---|---|
| `NEXTAUTH_SECRET` | Random secret for session signing | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public URL of your deployment | `https://btc-tracker.up.railway.app` |
| `DATABASE_URL` | SQLite path inside container | `file:/app/data/bitcoin-tracker.db` |
| `NODE_ENV` | Must be `production` | `production` |

> **NEXTAUTH_URL gotcha**: You won't know the URL until after the first deploy. Set it, redeploy once, and everything works. See each platform's guide for details.

## Data persistence

BTC Tracker uses SQLite stored at `/app/data/bitcoin-tracker.db` inside the container. Without a persistent volume, data is lost on every restart. Each platform guide below explains how to configure this.

## Backup

Once deployed, you can download your database at any time:

```bash
# Railway / Render: use their volume download tools or CLI
# Or export via the app: Profile → Export Transactions
```

## Detailed guides

- [Railway setup](railway/SETUP.md)
- [Render setup](render/SETUP.md)
- [Coolify setup](coolify/SETUP.md)
