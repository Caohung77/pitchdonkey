# Bounce Email Contact Flagging Solution

## 🎯 Problem Solved

When bounce/error emails arrive, they come from system addresses (like `MAILER-DAEMON@smtp.strato.de`) instead of the actual contact who bounced. The system now correctly:

1. ✅ Extracts the **failed recipient** from the bounce message content
2. ✅ Finds the correct contact in your database
3. ✅ Updates their engagement status appropriately
4. ✅ Handles both English and German bounce formats

---

## 🏗️ System Architecture

### Automatic Processing (Server-Side)

**File**: `src/app/api/mailbox/email-insights/route.ts`

When AI summary is generated for an email:
```
Bounce email received → AI detects "invalid_contact" intent →
Extract failed recipient from body → Find contact in database →
Update engagement status to "bad" → Recalculate engagement score
```

**Triggered**: Automatically when you view a bounce email and generate AI summary

### Manual Flagging (Client-Side)

**File**: `src/app/dashboard/mailbox/page.tsx`

When you click "Flag Contact" button:
```
Click "Flag Contact" → Extract failed recipient from email body →
Lookup contact by email → Flag as "bad" → Update engagement
```

**Fallback**: If extraction fails, you'll get a prompt to manually enter the email address

---

## 🔍 Extraction Patterns

The system uses comprehensive pattern matching to extract failed recipients:

### 1. SMTP Headers (Highest Priority)
- `X-Failed-Recipients: user@example.com`
- `Original-Recipient: rfc822; user@example.com`
- `Final-Recipient: rfc822; user@example.com`
- `RCPT TO:<user@example.com>`

### 2. English Body Patterns
- "could not be delivered to user@example.com"
- "delivery to the following recipient failed"
- "your message to user@example.com"
- "addressed to user@example.com"

### 3. German Body Patterns
- "konnte nicht zugestellt werden an user@example.de"
- "zustellung fehlgeschlagen an user@example.de"
- "Die E-Mail an user@example.de"
- "Empfänger: user@example.de"

### 4. Standalone Email Lines
```
...some bounce message...

user@example.com

...more bounce details...
```

### 5. Subject Line Extraction
Only when subject contains bounce keywords: `delivery`, `failed`, `bounce`, `undeliverable`, `zustellung`, `fehlgeschlagen`

---

## 🛡️ System Address Filtering

The system automatically **excludes** these addresses:
- ❌ `*mailer-daemon*`
- ❌ `*postmaster*`
- ❌ `*no-reply*`
- ❌ `*bounce*`

This ensures we only flag real contacts, never system addresses.

---

## 📊 Test Coverage

**All 15 tests passing** ✅

### Test Categories:
1. ✅ **German Bounce Formats (Strato SMTP)** - 3 tests
   - "konnte nicht zugestellt werden" format
   - "Empfänger" format
   - Real Strato bounce notification

2. ✅ **English Bounce Formats** - 2 tests
   - Standard delivery failure format
   - "could not be delivered to" format

3. ✅ **SMTP Header Formats** - 3 tests
   - X-Failed-Recipients header
   - Original-Recipient header
   - RCPT TO command

4. ✅ **System Address Filtering** - 3 tests
   - MAILER-DAEMON address filtering
   - Real recipient extraction when MAILER-DAEMON is sender
   - Postmaster address filtering

5. ✅ **Edge Cases** - 3 tests
   - Email addresses with angle brackets
   - No valid recipient found
   - Subject line extraction fallback

6. ✅ **Real-World Example** - 1 test
   - **Actual Strato bounce message format**

---

## 🎬 How to Test

### 1. View a Bounce Email in Mailbox

1. Go to **Dashboard → Mailbox**
2. Select a bounce email (e.g., from `MAILER-DAEMON@smtp.strato.de`)
3. Click **"Generate"** to create AI summary
4. The system will:
   - Detect intent as `invalid_contact`
   - Extract the failed recipient automatically
   - Update the contact's engagement status to "bad"

### 2. Manual Flagging

1. View any email in the mailbox
2. Generate AI summary
3. If contact status shows **"At Risk" (red)**, you'll see:
   - "Flag as Do Not Contact" option
   - Click **"Flag Contact"**
   - System extracts failed recipient and updates engagement

### 3. Check Logs (Browser Console)

You should see logs like:
```
🔍 Extracting failed recipient from bounce email...
✅ Extracted from body: peter.nuernberger@kleppers-group.de
✅ Found contact: Peter Nuernberger (peter.nuernberger@kleppers-group.de)
✅ Updated contact with invalid_contact status
✅ Recalculated engagement for contact
```

---

## 🚨 Error Scenarios & Fallbacks

### Scenario 1: Extraction Fails
**What happens**: System cannot find failed recipient in email body

**Fallback**:
- Manual entry dialog appears
- Enter the bounced email address manually
- System validates format and continues

**Example**:
```
Could not automatically detect the bounced email address.

Please enter the email address that bounced:
[                                          ]
```

### Scenario 2: Contact Not Found
**What happens**: Extracted email doesn't exist in your contacts

**Error Message**:
```
Contact "user@example.com" not found in your database.

Only contacts that exist in your contact list can be flagged.
```

**Action Required**: Verify the email address is correct and exists in your contacts

### Scenario 3: Invalid Email Format
**What happens**: Manually entered email is invalid

**Error Message**:
```
Invalid email address format
```

**Action Required**: Enter a valid email address (e.g., `name@domain.com`)

---

## 📈 Engagement Status Updates

When a contact is flagged from a bounce email:

### Status Change
```
Before: engaged/pending/not_contacted
After: bad
```

### Database Updates
- `engagement_status` → `'bad'`
- `bounced_at` → current timestamp (for invalid_contact)
- `unsubscribed_at` → current timestamp (for unsubscribe)
- `complained_at` → current timestamp (for complaint)
- `engagement_score` → recalculated (usually 0)

### Impact on Campaigns
- ✅ Automatically excluded from all future campaigns
- ✅ Active campaigns paused for this contact
- ✅ Contact appears in "Do Not Contact" filter

---

## 🔧 API Endpoints Used

### 1. Contact Lookup
**Endpoint**: `GET /api/contacts/lookup?email=user@example.com`

**Response**:
```json
{
  "success": true,
  "contact": {
    "id": "contact-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "engagement_status": "pending"
  },
  "exists": true
}
```

### 2. Flag Contact Status
**Endpoint**: `POST /api/contacts/{contactId}/flag-status`

**Request Body**:
```json
{
  "reason": "bounce" | "unsubscribe" | "complaint",
  "senderEmail": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "contactId": "contact-uuid",
    "engagement_status": "bad",
    "engagement_score": 0,
    "reason": "bounce"
  }
}
```

### 3. Email Insights
**Endpoint**: `POST /api/mailbox/email-insights`

**Request Body**:
```json
{
  "emailId": "email-uuid",
  "forceRegenerate": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sender_name": "Mail Delivery System",
    "sender_email": "MAILER-DAEMON@smtp.strato.de",
    "subject": "Returned Mail",
    "summary": "Die E-Mail konnte nicht zugestellt werden...",
    "intent": "invalid_contact",
    "contact_status": "red"
  }
}
```

---

## 💡 Best Practices

### 1. Review Bounce Emails Regularly
Check your mailbox for bounce notifications weekly to:
- Identify invalid contacts early
- Maintain clean contact database
- Prevent damaging sender reputation

### 2. Verify Before Flagging
When manual entry is required:
- Double-check the email address
- Ensure it matches a contact in your database
- Review the bounce reason in the email body

### 3. Monitor Engagement Status
Use the contacts page to:
- Filter by `engagement_status = 'bad'`
- Review flagged contacts
- Remove permanently invalid contacts

### 4. Check Logs for Debugging
If flagging fails:
1. Open browser console (F12)
2. Look for extraction logs
3. Verify the email pattern is recognized
4. Submit an issue with the email format if needed

---

## 🧪 Example Bounce Email Formats

### German Strato Bounce
```
Von: MAILER-DAEMON@smtp.strato.de
Betreff: Returned Mail: KI Bonitätsprüfung

Die E-Mail an peter.nuernberger@kleppers-group.de konnte nicht
zugestellt werden, da die E-Mailabdresse abgelaufen oder ungültig ist.

Die Nachricht konnte nicht zugestellt werden.
```

**Extracted**: `peter.nuernberger@kleppers-group.de` ✅

### English Gmail Bounce
```
From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>
Subject: Delivery Status Notification (Failure)

Delivery to the following recipient failed permanently:

john.doe@company.com

Technical details of permanent failure:
Google tried to deliver your message, but it was rejected.
```

**Extracted**: `john.doe@company.com` ✅

---

## 📝 Files Modified

1. **`src/app/api/mailbox/email-insights/route.ts`**
   - Enhanced extraction patterns
   - Added automatic contact flagging
   - Improved German bounce support

2. **`src/app/dashboard/mailbox/page.tsx`**
   - Updated client-side extraction logic
   - Added manual entry fallback
   - Improved error messages

3. **`lib/bounce-email-extractor.test.ts`** (NEW)
   - Comprehensive test suite
   - 15 tests covering all formats
   - Real-world Strato bounce example

---

## ✅ Summary

The bounce email contact flagging system is now:

1. ✅ **Robust**: 15/15 tests passing with comprehensive pattern matching
2. ✅ **Multilingual**: Full English and German support
3. ✅ **User-Friendly**: Manual fallback when automatic extraction fails
4. ✅ **Accurate**: Filters out system addresses automatically
5. ✅ **Tested**: Real-world Strato bounce format validated

The system correctly identifies failed recipients from bounce messages and updates the corresponding contact's engagement status, ensuring your contact database remains clean and your sender reputation stays healthy.

---

## 🐛 Troubleshooting

### Issue: "Contact not found in database"

**Cause**: The extracted email doesn't match any contact in your database

**Solutions**:
1. Verify the email is spelled correctly in the bounce message
2. Check if the contact exists in your contacts list
3. Look for alternative spellings or email addresses
4. Manually add the contact if it's a valid lead

### Issue: "Could not extract failed recipient"

**Cause**: The bounce email uses an unrecognized format

**Solutions**:
1. Use the manual entry fallback
2. Copy the full bounce email text
3. Report the format to support for future pattern updates
4. Check the email body for any recipient mentions

### Issue: Manual entry keeps failing

**Cause**: Invalid email format or database connectivity

**Solutions**:
1. Verify email format: `name@domain.com`
2. Check browser console for detailed errors
3. Refresh the page and try again
4. Contact support if issue persists

---

## 🆘 Support

If you encounter issues not covered here:

1. **Check Logs**: Open browser console (F12) and review error messages
2. **Test Suite**: Run `npm test -- lib/bounce-email-extractor.test.ts`
3. **GitHub Issues**: Report at github.com/your-repo/issues
4. **Documentation**: Review CLAUDE.md for additional context
