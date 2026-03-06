# Deploy BTC Tracker on Railway

Railway is the easiest way to deploy BTC Tracker to the cloud. It builds directly from the GitHub repo using the included `Dockerfile` and `railway.toml`.

## One-click deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/wilqq-the/BTC-Tracker)

## Manual steps

### 1. Create a new project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `wilqq-the/BTC-Tracker`
4. Railway detects `railway.toml` and `Dockerfile` automatically

### 2. Add a volume (required for data persistence)

Railway uses volumes to persist SQLite data across deploys and restarts.

1. In your service dashboard, go to **Volumes**
2. Click **Add Volume**
3. Set mount path to: `/app/data`
4. Save — Railway attaches the volume automatically

Without this step, all data is lost on every redeploy.

### 3. Configure environment variables

In your service settings, go to **Variables** and add:

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` and paste the output |
| `NEXTAUTH_URL` | Leave blank for now — set after first deploy (step 4) |
| `DATABASE_URL` | `file:/app/data/bitcoin-tracker.db` |
| `NODE_ENV` | `production` |

### 4. Deploy and get your URL

1. Click **Deploy** — Railway builds and starts the container
2. Once running, copy your public URL from the **Settings → Domains** section
   (e.g. `https://btc-tracker-production.up.railway.app`)
3. Go back to **Variables**, set `NEXTAUTH_URL` to that URL
4. Click **Deploy** again — this is the last redeploy needed

### 5. Register your account

Open your Railway URL in a browser. The first user to register becomes the admin automatically.

## Pricing

Railway offers trial credits for new accounts. After that, a basic deployment costs roughly $5–10/month depending on usage. Check [railway.app/pricing](https://railway.app/pricing) for current rates.

## Updating

To update BTC Tracker to a new release:

1. Railway watches the `dev` branch by default. You can change this to `main` in **Settings → Source**
2. Push or merge to the tracked branch — Railway redeploys automatically

## Troubleshooting

**App won't start**: Check that `NEXTAUTH_SECRET` is set. Without it, NextAuth refuses to run.

**Data missing after redeploy**: Confirm the volume is attached at `/app/data` (see step 2).

**Authentication errors**: Make sure `NEXTAUTH_URL` matches your actual public URL exactly (no trailing slash).
