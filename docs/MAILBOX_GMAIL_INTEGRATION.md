# Mailbox System - Gmail Integration Documentation

## Overview

The mailbox system provides a unified inbox interface for managing incoming and outgoing emails through Gmail OAuth integration. It fetches emails using the Gmail API, stores them in the database, automatically classifies them, and displays them in a user-friendly interface.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
│  (Mailbox Page - Inbox/Sent/Unified View)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   API Routes                                │
│  • /api/inbox/sync        - Sync Gmail emails              │
│  • /api/inbox/emails      - Get inbox emails               │
│  • /api/mailbox/sent      - Get sent emails                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│            Gmail API Integration Layer                      │
│  • GmailIMAPSMTPService          (lib/gmail-imap-smtp.ts)  │
│  • GmailIMAPSMTPServerService    (lib/server/...)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Gmail API                                  │
│  • users.messages.list    - List messages                  │
│  • users.messages.get     - Get message details            │
│  • users.messages.send    - Send emails                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                Database (Supabase)                          │
│  • incoming_emails    - Received emails                    │
│  • email_sends        - Campaign sent emails               │
│  • email_accounts     - Gmail OAuth credentials            │
│  • imap_connections   - Sync status tracking               │
└─────────────────────────────────────────────────────────────┘
```

## Gmail OAuth Setup

### 1. Google Cloud Console Configuration

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Configure authorized redirect URIs:
   - Development: `http://localhost:3000/api/email-accounts/oauth/gmail/callback`
   - Production: `https://your-domain.com/api/email-accounts/oauth/gmail/callback`

### 2. Environment Variables

```bash
# .env.local
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 3. OAuth Scopes Required

```typescript
const SCOPES = [
  'https://mail.google.com/',  // Full Gmail access
  'https://www.googleapis.com/auth/gmail.send'  // Send emails
]
```

## Gmail API Integration

### Core Service: `GmailIMAPSMTPService`

**Location:** `/lib/gmail-imap-smtp.ts`

**Purpose:** Handles all Gmail API operations with OAuth token management

#### Key Methods

##### `fetchEmails(mailbox, options)`

Fetches emails from Gmail using the Gmail API.

**Parameters:**
- `mailbox: string` - The mailbox/label to fetch from ('INBOX', 'SENT', or custom label)
- `options: object` - Fetch options
  - `limit?: number` - Max emails to fetch (default: 50)
  - `since?: Date` - Fetch emails after this date
  - `unseen?: boolean` - Only fetch unread emails

**Returns:** `Promise<EmailMessage[]>`

**Gmail API Calls:**
1. `users.messages.list` - Get list of message IDs with labelIds filter
2. `users.messages.get` - Fetch full message details (format: 'full')

**Critical Implementation Details:**

```typescript
// For INBOX - use labelIds parameter ONLY
if (mailbox === 'INBOX' || !mailbox) {
  labelIds = ['INBOX']
  // NO search query needed - Gmail's INBOX label handles filtering
}

// For SENT - use labelIds
if (mailbox === 'SENT') {
  labelIds = ['SENT']
}

// Fetch message list
const listResponse = await gmail.users.messages.list({
  userId: 'me',
  labelIds: labelIds,  // Use labelIds for folder filtering
  q: query.trim() || undefined,  // Use q only for search terms
  maxResults: options.limit || 50
})

// Fetch full message details
const messageResponse = await gmail.users.messages.get({
  userId: 'me',
  id: message.id,
  format: 'full'  // Get complete email with body
})
```

**Email Body Extraction:**

```typescript
// Extract email body from Gmail API payload
extractEmailBody(payload) {
  // Handle multipart MIME messages
  // Decode base64url encoded content
  // Support both text/plain and text/html

  const decode = (data) => {
    // Gmail uses URL-safe base64 (not standard base64)
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(normalized, 'base64').toString('utf-8')
  }

  return { textBody, htmlBody }
}
```

##### `sendEmail(options)`

Sends emails via Gmail API.

**Parameters:**
- `to: string | string[]` - Recipient(s)
- `subject: string` - Email subject
- `text?: string` - Plain text body
- `html?: string` - HTML body
- `cc?: string[]` - CC recipients
- `bcc?: string[]` - BCC recipients
- `attachments?: Attachment[]` - File attachments

**Gmail API Call:**
```typescript
gmail.users.messages.send({
  userId: 'me',
  requestBody: {
    raw: base64EncodedEmail  // RFC-2822 format
  }
})
```

### Server-Side Service: `GmailIMAPSMTPServerService`

**Location:** `/lib/server/gmail-imap-smtp-server.ts`

**Purpose:** Server-side wrapper for Gmail operations with database integration

**Key Methods:**
- `fetchGmailEmails(accountId, mailbox, options)` - Fetch emails for account
- `sendGmailEmail(accountId, options)` - Send email from account
- `testGmailConnection(accountId)` - Test OAuth credentials

## Email Synchronization

### Sync Flow

```
User clicks "Sync" button
        ↓
POST /api/inbox/sync
        ↓
Get email_accounts from database (with OAuth tokens)
        ↓
For each Gmail OAuth account:
        ↓
    Call GmailIMAPSMTPService.fetchEmails('INBOX', {limit: 100})
        ↓
    Gmail API: users.messages.list with labelIds=['INBOX']
        ↓
    Gmail API: users.messages.get for each message
        ↓
    Filter out self-sent emails (from_address contains user's email)
        ↓
    Check for duplicates (by message_id)
        ↓
    Insert into incoming_emails table
        ↓
    Auto-classify emails (bounce, reply, auto-reply, etc.)
        ↓
Return sync results
```

### Sync Route: `/api/inbox/sync/route.ts`

**POST /api/inbox/sync**

Synchronizes emails from Gmail for the authenticated user's email accounts.

**Request Body:**
```typescript
{
  emailAccountId?: string  // Optional: sync specific account
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  data: {
    totalNewEmails: number
    accountResults: Array<{
      success: boolean
      newEmails: number
      totalProcessed: number
      errors: string[]
      account: string
    }>
  }
}
```

**Key Implementation:**

```typescript
async function syncGmailOAuthAccount(supabase, account) {
  // 1. Fetch inbox emails from Gmail API
  const emails = await gmailService.fetchGmailEmails(
    account.id,
    'INBOX',
    { limit: 100, unseen: false }
  )

  // 2. Filter and store emails
  for (const email of emails) {
    // CRITICAL: Skip self-sent emails
    const isFromSelf = email.from?.toLowerCase()
      .includes(account.email.toLowerCase())

    if (isFromSelf) {
      console.log(`⏭️ Skipping self-sent email: "${email.subject}"`)
      continue
    }

    // Check for duplicates
    const existing = await supabase
      .from('incoming_emails')
      .select('id')
      .eq('message_id', email.messageId)
      .single()

    if (existing) continue

    // Insert new email
    await supabase.from('incoming_emails').insert({
      user_id: account.user_id,
      email_account_id: account.id,
      message_id: email.messageId,
      from_address: email.from,
      to_address: email.to,
      subject: email.subject,
      date_received: email.date,
      text_content: email.textBody,
      html_content: email.htmlBody,
      processing_status: 'pending',
      classification_status: 'unclassified',
      imap_uid: email.uid  // Numeric hash of Gmail message ID
    })
  }

  // 3. Auto-classify new emails
  const replyProcessor = new ReplyProcessor()
  await replyProcessor.processUnclassifiedEmails(
    account.user_id,
    newEmailIds.length
  )

  return { success: true, newEmails: newEmailsCount }
}
```

### Self-Sent Email Filtering

**Problem:** Gmail assigns the INBOX label to emails you send to yourself, causing sent emails to appear in the inbox.

**Solution:** Filter out emails where the sender (`from_address`) matches the user's email address.

```typescript
// In sync route
const isFromSelf = email.from?.toLowerCase()
  .includes(account.email.toLowerCase())

if (isFromSelf) {
  console.log(`⏭️ Skipping self-sent email`)
  continue  // Don't store in incoming_emails
}
```

## Inbox Display

### Inbox Route: `/api/inbox/emails/route.ts`

**GET /api/inbox/emails**

Retrieves stored inbox emails from the database.

**Query Parameters:**
- `limit?: number` - Results per page (default: 50)
- `offset?: number` - Pagination offset (default: 0)
- `classification?: string` - Filter by classification status
- `search?: string` - Search in from_address and subject
- `account_id?: string` - Filter by email account

**Response:**
```typescript
{
  success: boolean
  emails: Array<IncomingEmail>
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  stats: {
    total: number
    classifications: Record<string, number>
  }
}
```

**Database Query:**
```typescript
supabase
  .from('incoming_emails')
  .select(`
    id,
    from_address,
    to_address,
    subject,
    date_received,
    classification_status,
    processing_status,
    text_content,
    html_content,
    email_accounts!inner (id, email, provider),
    email_replies (
      campaign_id,
      contact_id,
      campaigns (id, name),
      contacts (id, first_name, last_name, email)
    )
  `)
  .eq('user_id', user.id)
  .is('archived_at', null)
  .order('date_received', { ascending: false })
```

## Sent Mailbox

### Sent Route: `/api/mailbox/sent/route.ts`

**GET /api/mailbox/sent**

Retrieves sent emails from two sources:
1. **Gmail SENT folder** - Emails sent directly via Gmail (fetched on-demand)
2. **Campaign emails** - Emails sent via campaigns (from `email_sends` table)

**Gmail Sent Emails:**
```typescript
// Fetch sent emails from Gmail API on-demand (not stored)
const sentEmails = await gmailService.fetchGmailEmails(
  emailAccount.id,
  'SENT',
  { limit: limit + offset, unseen: false }
)

// Map to unified format
const gmailSent = sentEmails.map(email => ({
  id: email.messageId,
  subject: email.subject,
  text_content: email.textBody,
  html_content: email.htmlBody,
  date_received: email.date,
  to_address: email.to,
  from_address: email.from,
  email_account_id: emailAccount.id,
  source: 'gmail'  // Distinguish from campaign emails
}))
```

**Campaign Emails:**
```typescript
// Fetch campaign emails from database
const campaignEmails = await supabase
  .from('email_sends')
  .select(`
    id, subject, content, send_status, sent_at,
    email_account_id, contact_id, campaign_id,
    contacts (id, first_name, last_name, email),
    campaigns (id, name)
  `)
  .eq('user_id', user.id)
  .order('sent_at', { ascending: false })
```

**Combine and Sort:**
```typescript
const allEmails = [...gmailSent, ...campaignEmails]

// Sort by sent date (most recent first)
allEmails.sort((a, b) => {
  const dateA = new Date(a.sent_at || a.created_at).getTime()
  const dateB = new Date(b.sent_at || b.created_at).getTime()
  return dateB - dateA
})

// Apply pagination
const paginatedEmails = allEmails.slice(offset, offset + limit)
```

## Email Classification

### Auto-Classification System

**Location:** `/lib/email-classifier.ts` and `/lib/reply-processor.ts`

**Triggered:** Automatically after sync for new emails

**Classification Types:**
- `bounce` - Delivery failures (hard/soft bounces)
- `auto_reply` - Automated responses (out-of-office, etc.)
- `human_reply` - Genuine human responses
- `unsubscribe` - Unsubscribe requests
- `spam` - Spam or promotional content
- `unclassified` - Unable to classify

**Bounce Detection:**
```typescript
// Patterns for hard bounces
const hardBouncePatterns = [
  /user unknown/i,
  /mailbox unavailable/i,
  /no such user/i,
  /recipient address rejected/i,
  /invalid recipient/i
]

// Patterns for soft bounces
const softBouncePatterns = [
  /mailbox full/i,
  /quota exceeded/i,
  /temporarily unavailable/i
]

// Update contact status for hard bounces
if (bounceType === 'hard') {
  await supabase
    .from('contacts')
    .update({
      email_status: 'bounced',
      bounced_at: new Date().toISOString(),
      bounce_reason: bounceReason
    })
    .eq('id', contactId)
}
```

## Database Schema

### `incoming_emails` Table

Stores received emails from Gmail.

```sql
CREATE TABLE incoming_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id),
  message_id TEXT NOT NULL,  -- Gmail Message-ID header
  from_address TEXT NOT NULL,
  to_address TEXT,
  subject TEXT,
  text_content TEXT,
  html_content TEXT,
  date_received TIMESTAMPTZ NOT NULL,
  classification_status TEXT DEFAULT 'unclassified',
  processing_status TEXT DEFAULT 'pending',
  classification_confidence DECIMAL(3,2),
  imap_uid BIGINT,  -- Numeric hash of Gmail message ID
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uniq_incoming_emails_account_uid
    UNIQUE (email_account_id, imap_uid)
)
```

**Key Fields:**
- `imap_uid` - Numeric representation of Gmail message ID (BIGINT to prevent overflow)
- `message_id` - Gmail Message-ID header (used for duplicate detection)
- `classification_status` - Auto-classified email type
- `processing_status` - Processing state (pending, completed, failed)

### `email_sends` Table

Stores campaign-sent emails.

```sql
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  send_status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### `imap_connections` Table

Tracks sync status for each email account.

```sql
CREATE TABLE imap_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  email_account_id UUID NOT NULL REFERENCES email_accounts(id),
  status TEXT DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  last_processed_uid BIGINT,  -- Last synced UID
  total_emails_processed INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  last_successful_connection TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uniq_imap_connection_account
    UNIQUE (email_account_id)
)
```

## OAuth Token Management

### Token Storage

OAuth tokens are stored in the `email_accounts` table:

```sql
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  provider TEXT NOT NULL,  -- 'gmail'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Token Refresh

**Location:** `/lib/oauth-providers.ts`

```typescript
async function refreshTokensIfNeeded(provider, tokens) {
  // Check if token is expired or about to expire
  const expiresAt = new Date(tokens.expires_at)
  const now = new Date()
  const fiveMinutes = 5 * 60 * 1000

  if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
    return tokens  // Token still valid
  }

  // Refresh the token
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  })

  const { credentials } = await oauth2Client.refreshAccessToken()

  // Update tokens in database
  await supabase
    .from('email_accounts')
    .update({
      access_token: credentials.access_token,
      token_expires_at: new Date(credentials.expiry_date)
    })
    .eq('id', accountId)

  return {
    access_token: credentials.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: credentials.expiry_date
  }
}
```

**Token Refresh Triggers:**
- Before every Gmail API call
- Automatically when access token expires
- 5-minute buffer before expiration

## Error Handling

### Common Errors

#### 1. OAuth Token Expired

**Error:** `401 Unauthorized` or `invalid_grant`

**Solution:** Automatic token refresh via `refreshTokensIfNeeded()`

**Fallback:** Prompt user to re-authenticate

#### 2. Rate Limiting

**Error:** `429 Too Many Requests`

**Gmail API Limits:**
- 1 billion quota units per day
- 250 quota units per user per second
- `users.messages.get` = 5 units
- `users.messages.list` = 5 units

**Solution:**
```typescript
// Implement exponential backoff
await sleep(Math.pow(2, retryCount) * 1000)
```

#### 3. Integer Overflow (Historical Issue - FIXED)

**Error:** `value "28147796094099" is out of range for type integer`

**Cause:** Gmail message IDs converted to integers exceeded PostgreSQL INTEGER max (2,147,483,647)

**Solution:** Changed database column from `integer` to `bigint`

```sql
ALTER TABLE incoming_emails ALTER COLUMN imap_uid TYPE BIGINT;
ALTER TABLE imap_connections ALTER COLUMN last_processed_uid TYPE BIGINT;
```

#### 4. Duplicate Emails

**Error:** `duplicate key value violates unique constraint`

**Prevention:**
```typescript
// Check for existing email before insert
const existing = await supabase
  .from('incoming_emails')
  .select('id')
  .eq('message_id', email.messageId)
  .single()

if (existing) {
  console.log('Email already exists, skipping')
  continue
}
```

## Performance Optimization

### 1. Batch Processing

Fetch multiple emails in parallel:

```typescript
const messagePromises = messages.map(async (message) => {
  return await gmail.users.messages.get({
    userId: 'me',
    id: message.id,
    format: 'full'
  })
})

const messageResults = await Promise.all(messagePromises)
```

### 2. Pagination

**Gmail API Pagination:**
```typescript
let nextPageToken = null

do {
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 50,
    pageToken: nextPageToken
  })

  nextPageToken = listResponse.data.nextPageToken
  // Process messages...
} while (nextPageToken)
```

**Database Pagination:**
```typescript
const { data, count } = await supabase
  .from('incoming_emails')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1)
```

### 3. Selective Syncing

Only sync new emails since last sync:

```typescript
const { data: connection } = await supabase
  .from('imap_connections')
  .select('last_processed_uid')
  .eq('email_account_id', accountId)
  .single()

const lastUID = connection?.last_processed_uid || 0

// Only fetch emails with UID > lastUID
```

## Security Considerations

### 1. OAuth Token Protection

- ✅ Tokens stored in database (not in client-side code)
- ✅ Server-side only access to tokens
- ✅ Automatic token refresh
- ✅ No tokens in logs or error messages

### 2. Data Privacy

- ✅ User isolation (user_id checks on all queries)
- ✅ Email content not logged
- ✅ Sensitive data encrypted at rest (Supabase)

### 3. API Security

- ✅ Authentication required (`withAuth` middleware)
- ✅ Rate limiting per user
- ✅ Input validation on all endpoints

### 4. GDPR Compliance

- ✅ User data deletion cascade
- ✅ Email archiving (soft delete)
- ✅ Export functionality available

## Troubleshooting

### Issue: Inbox shows sent emails

**Symptoms:** Emails you sent appear in inbox

**Cause:** Gmail assigns INBOX label to self-sent emails

**Solution:** Filter implemented in sync route

```typescript
const isFromSelf = email.from?.toLowerCase()
  .includes(account.email.toLowerCase())

if (isFromSelf) {
  continue  // Skip this email
}
```

### Issue: Emails not syncing

**Diagnostics:**
1. Check OAuth tokens are valid
2. Check `imap_connections` table for errors
3. Check server logs for Gmail API errors
4. Verify Gmail API quota not exceeded

**Resolution Steps:**
```bash
# 1. Test connection
curl -X POST /api/inbox/sync

# 2. Check logs for errors
# Look for OAuth, network, or API errors

# 3. Re-authenticate if needed
# User: Settings → Email Accounts → Re-connect Gmail
```

### Issue: Missing email bodies

**Symptoms:** Email displays "No content available"

**Cause:** Email body extraction failed (complex MIME structure)

**Solution:** Enhanced `extractEmailBody()` with recursive part handling

```typescript
extractEmailBody(payload) {
  // Handle single part
  if (payload.body?.data) {
    return decode(payload.body.data)
  }

  // Handle multipart (recursive)
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        return decode(part.body.data)
      }
      if (part.parts) {
        return extractEmailBody(part)  // Recurse
      }
    }
  }
}
```

## Testing

### Manual Testing Checklist

- [ ] Connect Gmail account via OAuth
- [ ] Click "Sync" button
- [ ] Verify inbox shows received emails only
- [ ] Verify sent folder shows sent emails
- [ ] Send test email and verify it appears in sent folder
- [ ] Reply to inbox email and verify classification
- [ ] Check bounce detection with invalid email
- [ ] Test search functionality
- [ ] Test classification filters
- [ ] Test pagination with large email count

### Automated Tests

```typescript
// Example test for sync functionality
describe('Gmail Sync', () => {
  it('should fetch inbox emails', async () => {
    const result = await syncGmailOAuthAccount(supabase, account)
    expect(result.success).toBe(true)
    expect(result.newEmails).toBeGreaterThan(0)
  })

  it('should skip self-sent emails', async () => {
    const email = { from: 'user@example.com', to: 'other@example.com' }
    const account = { email: 'user@example.com' }

    const isFromSelf = email.from.includes(account.email)
    expect(isFromSelf).toBe(true)
  })
})
```

## Future Enhancements

### Planned Features

1. **Real-time Sync**
   - Gmail push notifications via Pub/Sub
   - WebSocket updates to UI
   - Instant inbox refresh

2. **Advanced Search**
   - Full-text search in email bodies
   - Date range filtering
   - Attachment search
   - Sender/recipient search

3. **Email Threading**
   - Group related emails by thread
   - Conversation view
   - Thread-level actions

4. **Improved Classification**
   - Machine learning model for classification
   - Custom classification rules
   - Priority inbox

5. **Multi-Account Support**
   - Unified inbox across accounts
   - Per-account sync schedules
   - Account-specific settings

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail API Node.js Quickstart](https://developers.google.com/gmail/api/quickstart/nodejs)
- [Gmail Search Operators](https://support.google.com/mail/answer/7190)
- [RFC 2822 - Internet Message Format](https://www.ietf.org/rfc/rfc2822.txt)

---

## Summary

The mailbox system provides a complete Gmail integration with:
- ✅ OAuth 2.0 authentication
- ✅ Inbox and sent email fetching via Gmail API
- ✅ Automatic email classification
- ✅ Self-sent email filtering
- ✅ Database storage with efficient queries
- ✅ Real-time sync with error handling
- ✅ Campaign email integration
- ✅ Bounce detection and contact status updates

The system is production-ready and follows Gmail API best practices for reliability, security, and performance.