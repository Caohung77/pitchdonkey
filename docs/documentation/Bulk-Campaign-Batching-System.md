# Bulk Campaign Batching System - Implementation Guide

## Overview

The bulk campaign batching system ensures that campaigns with daily email limits (e.g., 5 emails per day) properly distribute emails over multiple days and avoid sending duplicate emails to the same contacts.

## How It Works

### 1. Daily Limit Configuration

Set the daily email limit in your campaign:
- **Default**: 5 emails per day
- **Database field**: `campaigns.daily_send_limit`
- **Campaign creation**: Configure when creating the campaign

### 2. Contact Tracking System

The new system tracks contact processing to prevent duplicates:

```sql
-- New fields in campaigns table
contacts_remaining JSONB    -- Contacts that still need emails
contacts_processed JSONB    -- Contacts that successfully received emails
contacts_failed JSONB       -- Contacts that failed to receive emails
batch_history JSONB         -- History of each batch send
```

### 3. Batch Scheduling Logic

**First Batch**:
- Sends immediately when campaign starts
- Sends up to `daily_send_limit` emails
- Schedules next batch 24 hours later

**Subsequent Batches**:
- Scheduled exactly 24 hours from previous batch
- Only sends to remaining contacts (no duplicates)
- Continues until all contacts processed

**Example Timeline**:
```
Day 1, 9:00 AM: Send 5 emails (Batch 1)
Day 2, 9:00 AM: Send 5 emails (Batch 2)
Day 3, 9:00 AM: Send 5 emails (Batch 3)
Day 4, 9:00 AM: Send remaining 2 emails (Batch 4) → Campaign Complete
```

### 4. Completion Detection

Campaign marked as `completed` when:
- `contacts_remaining` array is empty
- All contacts have been processed (sent or failed)

## Database Schema

### New Campaign Fields

```sql
-- Contact tracking
contacts_remaining JSONB DEFAULT '[]'::jsonb  -- Array of contact IDs to process
contacts_processed JSONB DEFAULT '[]'::jsonb  -- Array of successfully sent contact IDs
contacts_failed JSONB DEFAULT '[]'::jsonb     -- Array of failed contact IDs

-- Batch tracking
batch_history JSONB DEFAULT '[]'::jsonb       -- Array of batch records
first_batch_sent_at TIMESTAMP                 -- When first batch was sent
next_batch_send_time TIMESTAMP                -- When next batch should send
current_batch_number INTEGER DEFAULT 1        -- Current batch number

-- Configuration
daily_send_limit INTEGER DEFAULT 5            -- Max emails per day
```

### Batch History Format

```json
[
  {
    "batch_number": 1,
    "timestamp": "2025-09-24T09:00:00Z",
    "sent_count": 5,
    "failed_count": 0,
    "remaining_count": 10
  },
  {
    "batch_number": 2,
    "timestamp": "2025-09-25T09:00:00Z",
    "sent_count": 5,
    "failed_count": 0,
    "remaining_count": 5
  }
]
```

## API Workflow

### 1. Campaign Creation
```javascript
// Create campaign with daily limit
const campaign = await supabase
  .from('campaigns')
  .insert({
    name: 'My Bulk Campaign',
    daily_send_limit: 5,
    contact_list_ids: ['list-uuid-1', 'list-uuid-2'],
    status: 'sending'
  })
```

### 2. Contact Tracking Initialization
```javascript
// Automatically initialized on first processing
// Gets all contacts from lists: [contact1, contact2, contact3, ...]
// Sets contacts_remaining: [contact1, contact2, contact3, ...]
// Sets contacts_processed: []
```

### 3. Batch Processing
```javascript
// Day 1: Process first 5 contacts
// contacts_remaining: [contact6, contact7, contact8, ...] (reduced)
// contacts_processed: [contact1, contact2, contact3, contact4, contact5] (added)
// next_batch_send_time: "2025-09-25T09:00:00Z" (24 hours later)

// Day 2: Process next 5 contacts
// contacts_remaining: [contact11, contact12, ...] (further reduced)
// contacts_processed: [contact1...contact10] (expanded)
```

## Cron Job Integration

The system uses `/api/cron/process-campaigns` which runs:
- **Vercel**: Daily cron jobs
- **Docker**: Every 5 minutes
- **Manual**: POST to the endpoint

### Cron Job Logic
1. Find campaigns with status `sending` or `scheduled`
2. Check if it's time for next batch (±5 minute window)
3. Process remaining contacts up to daily limit
4. Schedule next batch if contacts remain
5. Mark as `completed` if no contacts remain

## Testing the System

### Test Endpoint
```bash
# Test the batching system
GET /api/debug/test-batch-campaign

# Initialize contact tracking for specific campaign
POST /api/debug/test-batch-campaign
{
  "campaignId": "uuid-of-campaign"
}
```

### Manual Campaign Processing
```bash
# Trigger campaign processor manually
POST /api/cron/process-campaigns
```

## Monitoring & Debugging

### Campaign Status Query
```sql
SELECT
  id,
  name,
  status,
  daily_send_limit,
  total_contacts,
  jsonb_array_length(contacts_remaining) as remaining_count,
  jsonb_array_length(contacts_processed) as processed_count,
  jsonb_array_length(contacts_failed) as failed_count,
  current_batch_number,
  next_batch_send_time,
  batch_history
FROM campaigns
WHERE status IN ('sending', 'scheduled')
ORDER BY created_at DESC;
```

### Batch History Analysis
```sql
-- View batch history for a campaign
SELECT
  name,
  jsonb_pretty(batch_history) as batch_details
FROM campaigns
WHERE id = 'your-campaign-uuid';
```

## Key Improvements

### ✅ **Prevents Duplicate Sends**
- Tracks processed contacts per campaign
- Only sends to remaining contacts each batch
- No risk of same contact receiving multiple emails

### ✅ **Accurate Daily Limits**
- Enforces exact daily email limits
- Proper 24-hour batch scheduling
- Respects campaign configuration

### ✅ **Automatic Completion**
- Detects when all contacts processed
- Updates campaign status automatically
- Stops scheduling future batches

### ✅ **Better Monitoring**
- Batch history tracking
- Detailed contact status
- Progress visibility

### ✅ **Backwards Compatible**
- Works with existing campaigns
- Fallback to old tracking method
- No breaking changes

## Migration Notes

### For Existing Campaigns
1. New fields will be `NULL` initially
2. System auto-initializes tracking on first run
3. Uses email_tracking table as fallback
4. Gradual migration as campaigns are processed

### Database Migration
```sql
-- Run the contact tracking migration
\i lib/campaign-contact-tracking-migration.sql
```

## Best Practices

### Campaign Setup
- Set realistic daily limits (5-50 emails)
- Ensure contact lists are properly populated
- Test with small batches first

### Monitoring
- Check batch progress daily
- Monitor completion rates
- Review failed contact logs

### Troubleshooting
- Use test endpoint for debugging
- Check campaign processor logs
- Verify cron job execution

## Support

For issues with the batching system:
1. Check campaign status and remaining contacts
2. Review batch history for timing issues
3. Use debug endpoints for detailed analysis
4. Check cron job execution logs