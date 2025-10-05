## v0.17.7 - Gmail API inbox sync fixes and multi-user email support

### Fixed Critical Inbox Sync Issues
- **Gmail API Query**: Changed from `labelIds: ['INBOX']` to `query: '-in:spam -in:trash'` to fetch all inbox emails (not just INBOX label)
  - Previous behavior: Only fetched 15 emails due to Gmail's computed INBOX label limitations
  - New behavior: Fetches all emails matching traditional IMAP inbox view (223 emails in test case)

- **Self-Sent Email Filtering**: Correctly filters out emails sent from user's own address
  - Prevents sent emails from appearing in inbox (201 self-sent emails filtered in test)
  - Allows 22 legitimate inbox emails to be processed

- **User-Scoped Duplicate Detection**: Fixed duplicate check to filter by `user_id`
  - Previous: Checked if email exists globally across all users
  - Fixed: Only checks if email exists for current user
  - Location: `/api/inbox/sync/route.ts` lines 400, 415

### Database Schema Improvements
- **Multi-User Email Support**: Changed unique constraints to be user-scoped
  - Removed global unique constraint on `incoming_emails.message_id`
  - Added composite unique constraint `(user_id, message_id)`
  - Removed global unique constraint on `incoming_emails.gmail_message_id`
  - Added composite unique constraint `(user_id, gmail_message_id)`
  - Allows same email to exist for different users (multi-tenant support)

### API Endpoint Fixes
- **Inbox Emails Query**: Fixed Supabase count query syntax error
  - Changed from invalid `.count('exact')` chained method
  - Fixed: Separate count query with proper `select('id', { count: 'exact', head: true })`
  - Location: `/api/inbox/emails/route.ts` lines 80-103

- **Email Account Join**: Changed from `!inner` join to standard left join
  - Prevents emails from being hidden if email_account relationship has issues
  - Location: `/api/inbox/emails/route.ts` line 39

### Sync Process Enhancements
- **Extended Lookback Window**:
  - Initial sync: Fetches last 30 days of emails
  - Incremental sync: 7-day safety window (was 12 hours)
  - Location: `/api/inbox/sync/route.ts` lines 296-347

- **Enhanced Debug Logging**:
  - Added comprehensive email fetch statistics
  - Shows all fetched emails with self-sent status
  - Displays skip reasons: self-sent, already exists, archived
  - Shows database insert errors with full details
  - Post-sync database verification with email counts
  - Location: `/api/inbox/sync/route.ts` lines 365-583

### Performance Improvements
- **Gmail API Pagination**: Default limit of 500 emails per sync (was unlimited)
  - Prevents quota exhaustion
  - Batch size: 100 emails per page
  - Location: `lib/gmail-imap-smtp.ts` line 292

### Testing Results
- Successfully synced 223 total emails
- Correctly filtered 201 self-sent emails
- Inserted 22 legitimate inbox emails (was failing with 18 duplicate errors)
- All 22 emails now display correctly in mailbox UI

### Migration Required
Run this SQL in Supabase to fix unique constraints:
```sql
ALTER TABLE incoming_emails DROP CONSTRAINT IF EXISTS incoming_emails_message_id_key;
ALTER TABLE incoming_emails ADD CONSTRAINT incoming_emails_user_message_id_unique
  UNIQUE (user_id, message_id);
ALTER TABLE incoming_emails DROP CONSTRAINT IF EXISTS incoming_emails_gmail_message_id_key;
ALTER TABLE incoming_emails ADD CONSTRAINT incoming_emails_user_gmail_message_id_unique
  UNIQUE (user_id, gmail_message_id);
```

## v0.3.1 - Open tracking fixes and diagnostics

- Track opens via pixel reliably: set `opened_at`, increment `open_count`, and log `email_events`.
- Campaign stats update on first open to reflect unique/total opens.
- Analytics counts opens from timestamps (opened_at/clicked_at/replied_at), not only status.
- Pixel URL generation hardened: uses `NEXT_PUBLIC_APP_URL` or falls back to `https://${VERCEL_URL}`.
- Added `scripts/diagnose-tracking.js` for quick Supabase-based verification.
## v0.3.2 - Campaign Analytics fixes

- Analytics derives sent/delivered/opened metrics from timestamps (not only `status`).
- Daily stats, pipeline, and recent activity now reflect real openings and deliveries.
- Added API: `GET /api/campaigns/[id]/email-details` to return real email rows (with contact info + timestamps).
- UI: EmailDetailsTable now fetches from the new endpoint (removed mock data).
## v0.3.3 - Define Delivered (Reached) as SMTP accepted

- Mark `delivered_at` at send time for SMTP success in both execution paths.
- Ensures Analytics “Delivered/Reached” > 0 even if no separate delivery webhook exists.

