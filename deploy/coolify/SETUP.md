# Deploy BTC Tracker on Coolify

[Coolify](https://coolify.io) is an open-source, self-hosted PaaS (like Heroku, but on your own server). It's a great choice for Bitcoin users who want full control and privacy — your data stays on your hardware.

## Prerequisites

- A VPS or home server (2 GB RAM minimum recommended)
- Coolify installed ([coolify.io/docs/installation](https://coolify.io/docs/installation))
- A domain name pointed at your server (optional but recommended for HTTPS)

## Deploy from Docker Compose

BTC Tracker ships with a ready-to-use `docker-compose.yml`. Coolify can deploy it directly.

### 1. Create a new resource

1. In Coolify, go to **Projects** → your project → **+ New Resource**
2. Choose **Docker Compose**
3. Select **From a Git Repository** (or **From a Public Repository**)
4. Enter the repo URL: `https://github.com/wilqq-the/BTC-Tracker`
5. Set the branch to `main`
6. Coolify detects `docker-compose.yml` automatically

### 2. Configure environment variables

In Coolify's **Environment Variables** section, add:

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` on your server and paste the output |
| `NEXTAUTH_URL` | Your public URL, e.g. `https://btc.yourdomain.com` |
| `DATABASE_URL` | `file:/app/data/bitcoin-tracker.db` |
| `NODE_ENV` | `production` |

### 3. Configure persistent storage

The `docker-compose.yml` already defines a named volume (`btc_data`) that mounts to `/app/data`. Coolify respects Docker Compose volume definitions, so data persists automatically.

If you want to map to a specific host directory instead:

1. In Coolify, find the volume configuration for the service
2. Change the volume from named (`btc_data`) to a bind mount pointing to a directory on your host, e.g. `/opt/btc-tracker/data`

### 4. Set up a domain and HTTPS

1. In Coolify, go to your service → **Domains**
2. Add your domain (e.g. `btc.yourdomain.com`)
3. Enable **HTTPS** — Coolify handles Let's Encrypt certificates automatically
4. Update `NEXTAUTH_URL` to match your domain

### 5. Deploy

Click **Deploy**. Coolify pulls the image (or builds from Dockerfile if configured), starts the container, and applies your domain/SSL config.

### 6. Register your account

Open your domain in a browser. The first user to register becomes the admin automatically.

## Updating

1. In Coolify, go to your service → **Deployments**
2. Click **Redeploy** to pull the latest image from Docker Hub (`thewilqq/btc-tracker:latest`)
3. Or enable **Auto-deploy** to redeploy automatically when the repo's `main` branch updates

## Using the pre-built Docker Hub image (faster)

Instead of building from source, you can deploy the pre-built image directly:

1. In Coolify, create a **Docker Image** resource instead of Docker Compose
2. Enter the image: `thewilqq/btc-tracker:latest`
3. Set the port to `3000`
4. Add environment variables (same as above)
5. Add a volume mount: container path `/app/data` → host path `/opt/btc-tracker/data`

This skips the build step entirely and is faster to get running.

## Backup

Your database lives at the host path you configured (e.g. `/opt/btc-tracker/data/bitcoin-tracker.db`). Back it up like any file:

```bash
cp /opt/btc-tracker/data/bitcoin-tracker.db /backups/btc-tracker-$(date +%F).db
```
