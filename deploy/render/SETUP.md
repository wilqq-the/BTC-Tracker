# Deploy BTC Tracker on Render

Render deploys BTC Tracker using the included `render.yaml` blueprint. It handles building from `Dockerfile` and configuring most environment variables automatically.

## One-click deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/wilqq-the/BTC-Tracker)

## Important: free plan limitation

> **The free plan does NOT support persistent disks.** SQLite data is stored in ephemeral storage and will be **wiped on every restart or redeploy**.
>
> For production use with real data, use the **Starter plan** ($7/month) or higher, which includes disk support.

## Manual steps

### 1. Click "Deploy to Render"

Click the button above. Render reads `render.yaml` from the repo and pre-fills most settings.

### 2. Review the blueprint

Render shows a summary of what will be created:
- **Web Service**: `btc-tracker` (built from Dockerfile)
- **Disk**: `btc-tracker-data` mounted at `/app/data` (1 GB)
- **Environment variables**: pre-configured, with `NEXTAUTH_SECRET` auto-generated

### 3. Set NEXTAUTH_URL

`render.yaml` marks `NEXTAUTH_URL` as `sync: false`, so Render will prompt you to enter it.

You won't know the URL until after the first deploy. For now, enter a placeholder:
```
https://btc-tracker.onrender.com
```
You'll update this after the first deploy.

### 4. Deploy

Click **Apply** — Render builds and starts your service. This typically takes 3–5 minutes for the first build.

### 5. Update NEXTAUTH_URL

1. Once deployed, copy your actual Render URL from the service dashboard
   (e.g. `https://btc-tracker-xxxx.onrender.com`)
2. Go to **Environment** → edit `NEXTAUTH_URL` with the real URL
3. Click **Save Changes** — Render triggers a redeploy automatically

### 6. Register your account

Open your Render URL. The first user to register becomes the admin automatically.

## Upgrading plan for disk

If you started on the free plan and want to add persistent storage:

1. Go to your service → **Settings → Instance Type** → upgrade to Starter or above
2. Then go to **Disks** → **Add Disk**, mount at `/app/data`, 1 GB minimum
3. Set `DATABASE_URL` to `file:/app/data/bitcoin-tracker.db` if not already set

## Updating

Render auto-deploys when you push to the branch configured in **Settings → Branch**. Set this to `main` for stable releases.

## Troubleshooting

**App won't start**: Check that `NEXTAUTH_SECRET` is set (should be auto-generated, but verify in Environment).

**Data missing after restart (free plan)**: This is expected — upgrade to Starter for persistent disk.

**Authentication errors**: Ensure `NEXTAUTH_URL` exactly matches your Render service URL (no trailing slash, correct protocol).

**Slow cold starts**: Free plan services spin down after inactivity. Upgrading to Starter keeps the service always on.
