# Vercel Cron Jobs Implementation

This document explains the Vercel Cron Jobs implementation for automated campaign processing.

## Overview

The application uses Vercel Cron Jobs to automatically process scheduled campaigns every 5 minutes. This ensures that campaigns scheduled for future delivery are sent at the correct time, even when users are not logged in.

## Architecture

### 1. Configuration (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/process-campaigns",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### 2. Cron Endpoint (`/api/cron/process-campaigns`)
- **Frequency**: Every 5 minutes
- **Purpose**: Find and trigger scheduled campaigns that are ready to send
- **Authentication**: Uses service role key (bypasses user authentication)
- **Security**: Verifies requests using `CRON_SECRET` environment variable

## How It Works

### Campaign Lifecycle
1. **User creates campaign** → Status: `draft`
2. **User schedules campaign** → Status: `scheduled` + `scheduled_date` set
3. **Cron job runs** (every 5 minutes)
4. **Cron finds ready campaigns** → `scheduled_date <= now`
5. **Cron updates status** → `scheduled` → `sending`
6. **Cron triggers processor** → Campaign processing begins
7. **Processor sends emails** → Status: `sending` → `completed`

### Security Model
```typescript
// Request verification
const authHeader = request.headers.get('authorization')
const userAgent = request.headers.get('user-agent')

// Check CRON_SECRET or Vercel cron user agent
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  if (!userAgent?.includes('vercel-cron')) {
    return new Response('Unauthorized', { status: 401 })
  }
}
```

## Environment Variables Required

### Production (Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_random_secret_key_16_chars_minimum
```

### Local Development
```bash
# Same as production, plus:
NODE_ENV=development
```

## Testing

### 1. Test Cron Functionality
```bash
# Manual test (requires CRON_SECRET in Authorization header)
curl -X GET "https://your-app.vercel.app/api/cron/test" \
  -H "Authorization: Bearer your_cron_secret"

# Expected response:
{
  "success": true,
  "message": "Cron test endpoint working",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": {
    "hasSupabaseUrl": true,
    "hasServiceKey": true,
    "hasCronSecret": true,
    "nodeEnv": "production"
  }
}
```

### 2. Test Campaign Processing
```bash
# Manual campaign processing test
curl -X POST "https://your-app.vercel.app/api/cron/process-campaigns" \
  -H "Authorization: Bearer your_cron_secret"

# Expected response:
{
  "success": true,
  "processed": 2,
  "successful": 2,
  "errors": 0,
  "timestamp": "2024-01-15T10:35:00.000Z",
  "results": [
    {
      "campaignId": "abc123",
      "campaignName": "Product Launch",
      "success": true,
      "message": "Campaign processing triggered"
    }
  ]
}
```

## Monitoring and Troubleshooting

### 1. Vercel Dashboard
- Navigate to your project in Vercel
- Go to Settings → Cron Jobs
- Monitor execution logs and success/failure rates

### 2. Common Issues

#### Cron Job Not Running
- **Check**: Vercel project has cron jobs enabled
- **Check**: `vercel.json` is in project root
- **Check**: Correct cron expression syntax

#### Unauthorized Errors
- **Check**: `CRON_SECRET` environment variable is set
- **Check**: Secret matches in both Vercel and code
- **Check**: Secret is at least 16 characters

#### Campaign Not Processing
- **Check**: Campaign status is `scheduled`
- **Check**: `scheduled_date` is in the past
- **Check**: Supabase service role key has correct permissions
- **Check**: Campaign processor logs for errors

#### Database Connection Issues
- **Check**: `SUPABASE_SERVICE_ROLE_KEY` is correct
- **Check**: `NEXT_PUBLIC_SUPABASE_URL` is accessible
- **Check**: Network connectivity from Vercel to Supabase

### 3. Debugging Steps

1. **Check cron job status**:
   ```bash
   curl -X GET "https://your-app.vercel.app/api/cron/test"
   ```

2. **Check scheduled campaigns in database**:
   ```sql
   SELECT id, name, status, scheduled_date 
   FROM campaigns 
   WHERE status = 'scheduled' 
   AND scheduled_date <= NOW();
   ```

3. **Check Vercel function logs**:
   - Vercel Dashboard → Functions → View logs
   - Look for cron execution entries

4. **Test campaign processing manually**:
   ```bash
   curl -X POST "https://your-app.vercel.app/api/cron/process-campaigns"
   ```

## Maintenance

### Updating Cron Schedule
1. Modify `vercel.json` cron schedule
2. Redeploy the application
3. Verify new schedule in Vercel dashboard

### Performance Considerations
- Cron runs every 5 minutes (12 times/hour)
- Each execution processes all ready campaigns
- Background processing prevents timeout issues
- Service role bypasses RLS for efficiency

### Scaling
- Current setup handles hundreds of campaigns
- For thousands of campaigns, consider:
  - Batch processing with pagination
  - Multiple cron jobs with different schedules
  - Queue system for large campaign processing

## Security Best Practices

1. **Use strong CRON_SECRET**: Minimum 16 characters, random string
2. **Rotate secrets regularly**: Update CRON_SECRET periodically
3. **Monitor logs**: Watch for unauthorized access attempts
4. **Limit service role permissions**: Only grant necessary database access
5. **Use HTTPS only**: Ensure all requests are encrypted

## Files Modified/Created

```
├── vercel.json                                    # Cron configuration
├── src/app/api/cron/
│   ├── process-campaigns/route.ts                # Main cron endpoint
│   └── test/route.ts                             # Test endpoint
├── CRON_JOBS.md                                  # This documentation
└── lib/
    ├── campaign-processor.ts                     # Existing (compatible)
    └── supabase-server.ts                        # Existing (uses service role)
```

## FAQ

**Q: Why every 5 minutes instead of exactly at scheduled time?**
A: Vercel cron has minimum 1-minute granularity, and 5-minute intervals balance responsiveness with resource usage.

**Q: What happens if a cron job fails?**
A: Failed campaigns remain in `scheduled` status and will be retried on the next cron execution.

**Q: Can I test cron jobs locally?**
A: Yes, call the cron endpoints directly with proper authorization headers.

**Q: How do I know if cron jobs are working?**
A: Monitor Vercel dashboard, check campaign status changes, and use the test endpoint.

**Q: What if I have many campaigns scheduled for the same time?**
A: The system processes them sequentially. Consider staggering schedule times for better performance.