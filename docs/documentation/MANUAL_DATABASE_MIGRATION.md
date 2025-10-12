# 🚨 MANUAL DATABASE MIGRATION REQUIRED

Your simple campaign creation is failing because the database schema is missing required columns. You need to apply this migration manually.

## Steps to Fix:

### 1. Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `fwokykaobucelhkvdtik`
3. Navigate to **SQL Editor** in the left sidebar

### 2. Run This SQL Migration
Copy and paste the following SQL into the SQL Editor and click **Run**:

```sql
-- Add simple campaign fields to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_subject VARCHAR(500);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_immediately BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';

-- Add tracking fields for simple campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS daily_send_limit INTEGER DEFAULT 50;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_opens BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_clicks BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS track_replies BOOLEAN DEFAULT true;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_enabled BOOLEAN DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_config JSONB DEFAULT '{}';

-- Add statistics fields for simple campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_delivered INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_opened INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_clicked INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_replied INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_bounced INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS emails_complained INTEGER DEFAULT 0;

-- Modify existing constraints to support simple campaigns
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS valid_email_sequence;

-- Add new constraint that allows either email_sequence OR html_content
ALTER TABLE campaigns ADD CONSTRAINT valid_campaign_content CHECK (
    (jsonb_array_length(email_sequence) > 0) OR 
    (html_content IS NOT NULL AND length(html_content) > 0)
);

-- Update existing campaigns to have valid ai_settings if null
UPDATE campaigns SET ai_settings = '{}' WHERE ai_settings IS NULL;
UPDATE campaigns SET schedule_settings = '{}' WHERE schedule_settings IS NULL;

-- Add status values for simple campaigns
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (
    status IN ('draft', 'active', 'paused', 'completed', 'archived', 'sending', 'scheduled')
);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_campaigns_email_subject ON campaigns(email_subject);
CREATE INDEX IF NOT EXISTS idx_campaigns_send_immediately ON campaigns(send_immediately);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_date ON campaigns(scheduled_date) WHERE scheduled_date IS NOT NULL;
```

### 3. Verify the Migration
After running the SQL, verify it worked by running this query:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name IN ('email_subject', 'html_content', 'send_immediately', 'scheduled_date');
```

You should see 4 rows returned with the column names.

## What This Fixes:

✅ **Campaign Creation Error**: The "Failed to create campaign" error will be resolved

✅ **Simple Campaign Support**: Your database will now support both:
- Traditional multi-step campaigns (using `email_sequence`)
- Simple single-email campaigns (using `html_content`, `email_subject`)

✅ **Immediate Send**: The `send_immediately` and `scheduled_date` fields will work properly

## After Migration:

Once you've run the migration in Supabase:

1. ✅ Simple campaign creation should work without errors
2. ✅ "Send Immediately" should work properly  
3. ✅ "Schedule for Later" should work properly
4. ✅ All tracking and statistics will be stored correctly

## If You Have Issues:

If you encounter any errors while running the migration, please share the error message and I can help troubleshoot.

**The most important columns to add are:**
- `email_subject` 
- `html_content`
- `send_immediately`
- `scheduled_date`

These are the minimum required for simple campaigns to work.