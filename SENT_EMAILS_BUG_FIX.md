# Fix for "Failed to load sent emails" Bug

## Root Cause Analysis

The "Failed to load sent emails" error is caused by a **schema mismatch** in the `email_sends` table. There are two conflicting table definitions in the codebase:

1. **Main Schema** (`lib/database-schema.sql`): Uses UUID types with comprehensive structure
2. **Email Tracking Schema** (`lib/database-schema-email-tracking.sql`): Uses TEXT types with simplified structure

The API expects the main schema format but the database may have the email tracking format.

## Symptoms

- ✅ Mailbox page loads correctly
- ✅ Inbox emails display properly
- ❌ Sent emails show "Failed to load sent emails"
- ❌ "No emails found" message in sent folder
- ❌ API returns 500 errors for `/api/mailbox/sent`

## Fix Steps

### Option 1: Automatic Fix via API (Recommended)

1. **Diagnose the issue first:**
   ```
   GET /api/debug/diagnose-sent-emails
   ```
   This will show exactly what's wrong with the table structure.

2. **Apply the schema fix:**
   Run the SQL file `fix-sent-emails-schema.sql` directly on your Supabase database.

### Option 2: Manual Database Fix

Connect to your Supabase database and run these SQL commands:

```sql
-- 1. Drop the inconsistent email_sends table
DROP TABLE IF EXISTS email_sends CASCADE;

-- 2. Create the correct table structure
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Email content
  subject VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  step_number INTEGER DEFAULT 1,

  -- Sending details
  message_id VARCHAR(255),
  send_status VARCHAR(20) DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed', 'scheduled')),

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Additional fields
  ab_variant VARCHAR(20),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  tracking_data JSONB DEFAULT '{}'
);

-- 3. Create indexes for performance
CREATE INDEX idx_email_sends_user_id ON email_sends(user_id);
CREATE INDEX idx_email_sends_campaign_id ON email_sends(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_email_sends_contact_id ON email_sends(contact_id);
CREATE INDEX idx_email_sends_email_account_id ON email_sends(email_account_id);
CREATE INDEX idx_email_sends_send_status ON email_sends(send_status);
CREATE INDEX idx_email_sends_sent_at ON email_sends(sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_email_sends_created_at ON email_sends(created_at);

-- Composite index for mailbox queries
CREATE INDEX idx_email_sends_mailbox_query ON email_sends(user_id, send_status, sent_at DESC NULLS LAST, created_at DESC);

-- 4. Create update trigger
CREATE OR REPLACE FUNCTION update_email_sends_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_sends_updated_at_trigger
  BEFORE UPDATE ON email_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_email_sends_updated_at();
```

### Option 3: Test Data for Immediate Verification

After fixing the schema, you can add some test data:

```sql
-- Insert sample data (adjust UUIDs to match your actual data)
INSERT INTO email_sends (
  user_id,
  contact_id,
  email_account_id,
  subject,
  content,
  send_status,
  sent_at
)
SELECT
  u.id,
  c.id,
  ea.id,
  'Test email #' || generate_random_uuid()::text,
  'This is test content for verifying the mailbox functionality.',
  'sent',
  NOW() - INTERVAL '1 hour'
FROM users u
CROSS JOIN LATERAL (
  SELECT id FROM contacts WHERE user_id = u.id LIMIT 1
) c
CROSS JOIN LATERAL (
  SELECT id FROM email_accounts WHERE user_id = u.id LIMIT 1
) ea
LIMIT 5;
```

## Verification

After applying the fix:

1. **Check the table structure:**
   ```sql
   \d email_sends
   ```

2. **Test the API query:**
   ```sql
   SELECT
     id, subject, content, send_status, sent_at, created_at,
     email_account_id, contact_id, campaign_id
   FROM email_sends
   WHERE user_id = 'your-user-id'
   ORDER BY sent_at DESC NULLS LAST, created_at DESC
   LIMIT 10;
   ```

3. **Test the mailbox functionality:**
   - Visit the mailbox page
   - Click on "All Sent" or individual account sent folders
   - Verify emails display without errors

## Prevention

To prevent this issue in the future:

1. **Single Source of Truth**: Maintain only one authoritative schema definition
2. **Schema Validation**: Add automated tests that verify table structure matches TypeScript types
3. **Migration Scripts**: Use proper database migration scripts instead of conflicting CREATE statements
4. **API Testing**: Include integration tests for all mailbox endpoints

## Files Modified

- ✅ `fix-sent-emails-schema.sql` - Complete schema fix
- ✅ `/api/debug/diagnose-sent-emails` - Diagnostic endpoint
- ✅ This documentation file

## Technical Details

### API Query Structure
The `/api/mailbox/sent` endpoint expects:
- UUID primary keys and foreign keys
- `user_id` field for user filtering
- Relations to `contacts`, `campaigns`, and `email_accounts` tables
- Specific field names: `send_status`, `sent_at`, `created_at`

### Database Schema Match
The fixed table structure matches:
- `database.types.ts` TypeScript definitions
- API query expectations in `/api/mailbox/sent/route.ts`
- Frontend component interfaces in `/dashboard/mailbox/page.tsx`

This comprehensive fix resolves the schema conflicts and ensures the sent emails feature works correctly.