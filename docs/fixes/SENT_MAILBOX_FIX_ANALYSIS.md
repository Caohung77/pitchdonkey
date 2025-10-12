# Sent Mailbox Empty - Root Cause Analysis

## Problem Summary
The sent mailbox in the UI shows as empty despite emails being sent from campaigns and manual compose actions.

## Root Cause Analysis

### 1. **Missing Data Population in `outgoing_emails` Table**

The [`/api/mailbox/sent`](src/app/api/mailbox/sent/route.ts:1) endpoint queries two sources:
- `outgoing_emails` table (for Gmail sent emails synced via IMAP)
- `email_sends` table (for campaign emails)

**Issue**: The `outgoing_emails` table is empty because:
- It was created in migration [`20250930_create_outgoing_emails.sql`](supabase/migrations/20250930_create_outgoing_emails.sql:1) but no data is being inserted into it
- The Gmail IMAP sync service that should populate this table is not running or not configured

### 2. **Campaign Emails Not Showing**

Looking at [`campaign-processor.ts`](lib/campaign-processor.ts:1), when emails are sent:
- Line 705-715: Creates tracking record in `email_tracking` table
- Line 765-775: Sends email via SMTP/Gmail
- **BUT**: No insertion into `email_sends` table or `outgoing_emails` table

The sent emails API expects data in `email_sends` table with this structure:
```typescript
{
  id, subject, content, send_status, sent_at, created_at,
  email_account_id, contact_id, campaign_id,
  contacts { id, first_name, last_name, email },
  campaigns { id, name }
}
```

### 3. **Manual Compose Emails Not Tracked**

When users manually compose emails via the mailbox (line 580-627 in [`page.tsx`](src/app/dashboard/mailbox/page.tsx:580)):
- Calls `/api/email-accounts/${composeAccountId}/send-test`
- This endpoint sends the email but doesn't create any tracking records
- No entry in `email_sends` or `outgoing_emails` tables

## Data Flow Issues

### Current Flow (Broken):
```
Campaign Send → email_tracking table only
Manual Send → No tracking at all
Gmail IMAP Sync → Not running/configured
```

### Expected Flow:
```
Campaign Send → email_tracking + email_sends tables
Manual Send → outgoing_emails table
Gmail IMAP Sync → outgoing_emails table (for sent folder)
```

## Solutions Required

### Solution 1: Fix Campaign Email Tracking
**File**: [`lib/campaign-processor.ts`](lib/campaign-processor.ts:765)

After successful email send (line 777-790), add insertion to `email_sends`:

```typescript
// After line 790, add:
await supabase
  .from('email_sends')
  .insert({
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    contact_id: contact.id,
    email_account_id: emailAccount.id,
    subject: personalizedSubject,
    content: personalizedContent,
    send_status: 'sent',
    sent_at: nowIso,
    created_at: nowIso
  })
```

### Solution 2: Fix Manual Compose Tracking
**File**: Need to find `/api/email-accounts/[id]/send-test/route.ts`

After successful send, insert into `outgoing_emails`:

```typescript
await supabase
  .from('outgoing_emails')
  .insert({
    user_id: user.id,
    email_account_id: emailAccountId,
    message_id: result.messageId,
    from_address: emailAccount.email,
    to_address: to,
    subject: subject,
    html_content: message,
    date_sent: new Date().toISOString()
  })
```

### Solution 3: Enable Gmail IMAP Sync
The `outgoing_emails` table was designed to be populated by Gmail IMAP sync, but this service needs to be:
1. Configured to sync the SENT folder
2. Running as a cron job or background process
3. Properly authenticated with Gmail accounts

## Quick Fix Priority

1. **HIGH**: Fix campaign email tracking (Solution 1) - This will show campaign emails in sent box
2. **MEDIUM**: Fix manual compose tracking (Solution 2) - This will show manually sent emails
3. **LOW**: Enable Gmail IMAP sync (Solution 3) - This is for Gmail accounts only

## Testing Steps

After implementing fixes:

1. Send a test campaign email
2. Check `email_sends` table for new record
3. Refresh sent mailbox - should show campaign email

4. Manually compose and send an email
5. Check `outgoing_emails` table for new record  
6. Refresh sent mailbox - should show manual email

## Database Schema Verification

Verify these tables exist and have correct structure:
- `email_sends` - for campaign emails
- `outgoing_emails` - for manual/Gmail synced emails
- Both should have proper RLS policies for user access

## API Response Debug

The API at line 482-487 in [`route.ts`](src/app/api/mailbox/sent/route.ts:482) logs:
```javascript
console.log(`📤 Sent emails API response:`, {
  success: data?.success,
  total: data?.emails?.length,
  pagination: data?.pagination,
  sample: data?.emails?.slice?.(0, 1)
})
```

Check browser console or server logs for this output to see what's actually being returned.

## Conclusion

The sent mailbox is empty because:
1. Campaign emails are tracked in `email_tracking` but not in `email_sends` table
2. Manual emails have no tracking at all
3. Gmail IMAP sync (for `outgoing_emails`) is not configured/running

The primary fix is to ensure campaign sends also insert into `email_sends` table, which the sent mailbox API queries.