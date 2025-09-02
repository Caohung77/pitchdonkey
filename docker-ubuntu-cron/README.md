# Ubuntu Docker Cron Setup for Pitchdonkey

This setup creates a simple Docker container that calls your Vercel API every 5 minutes to process scheduled campaigns.

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
```

## Files Needed on Your Server

- `docker-compose.yml`
- `.env` (copy from `.env.example` and fill in your values)

## What It Does

- Runs a lightweight Alpine Linux container
- Sets up a cron job that runs every 5 minutes
- Calls your Vercel API: `GET /api/cron/process-campaigns`
- Automatically restarts if it crashes
- Keeps running even after server reboots