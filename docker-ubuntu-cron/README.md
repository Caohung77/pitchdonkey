# Ubuntu Docker Cron Setup for Pitchdonkey

This setup creates a simple Docker container that calls your Vercel API every 5 minutes to process scheduled campaigns.

**✅ FIXED: Now processes both 'scheduled' AND 'sending' campaigns!**

## Quick Setup

1. Copy files to your Ubuntu server
2. Create `.env` file with your settings
3. Run `docker-compose up -d`
4. Done! Campaigns process every 5 minutes

## Commands

```bash
# Start the cron job
docker-compose up -d

# Check if it's running
docker ps

# View logs to see cron executions
docker logs pitchdonkey-cron

# Stop the cron job
docker-compose down

# Restart (if you change settings)
docker-compose restart

# Test the Docker cron functionality
curl -X GET "https://your-app.vercel.app/api/cron/docker-test" \
  -H "Authorization: Bearer your_cron_secret"
```

## Files Needed on Your Server

- `docker-compose.yml`
- `.env` (copy from `.env.example` and fill in your values)

## What It Does

- Runs a lightweight Alpine Linux container
- Sets up a cron job that runs every 5 minutes
- Calls your Vercel API: `GET /api/cron/process-campaigns`
- **NEW:** Processes both 'scheduled' AND 'sending' campaigns
- **FIXED:** No more stuck campaigns in 'sending' status
- Automatically restarts if it crashes
- Keeps running even after server reboots

## How The Fix Works

**Before:** Docker cron only processed 'scheduled' campaigns → campaigns got stuck in 'sending' status

**After:** Docker cron now processes:
1. **'scheduled' campaigns** → Updates them to 'sending' when ready
2. **'sending' campaigns** → Processes stuck campaigns directly

This ensures Gmail scheduled campaigns work properly with Docker Ubuntu cron.