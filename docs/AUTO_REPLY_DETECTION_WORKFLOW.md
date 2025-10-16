# Auto-Reply Detection & AI Persona Suppression - Implementation Workflow

## Executive Summary

**Feature**: Auto-reply detection system for Gmail/SMTP email accounts with intelligent AI persona suppression
**Scope**: Backend email processing pipeline
**Timeline**: 1-2 days implementation
**Risk Level**: Low-Medium (existing infrastructure can be leveraged)

---

## 1. Current Infrastructure Analysis

### 1.1 Existing Components ✅

**Email Classification System** (`lib/email-classifier.ts`):
- ✅ Already classifies emails as: `bounce`, `auto_reply`, `human_reply`, `unsubscribe`, `spam`
- ✅ Detects out-of-office, vacation responses with confidence scoring
- ✅ NEW: Enhanced transactional/no-reply detection (v0.26.6)
- ✅ Pattern matching for common auto-reply indicators
- ✅ Extracts `autoReplyUntil` dates from vacation messages
- ✅ Confidence scoring (0.0-1.0)

**Reply Processing Pipeline** (`lib/reply-processor.ts`):
- ✅ Processes incoming emails via `ReplyProcessor.processIncomingEmail()`
- ✅ Classifies emails using `EmailClassifier`
- ✅ Stores results in `email_replies` table
- ✅ Already updates `contacts.auto_reply_until` for vacation messages (lines 411-413)
- ✅ Autonomous reply drafting system with persona awareness (lines 498-587)

**Database Schema** (Supabase):
- ✅ `incoming_emails` table with classification fields
- ✅ `email_replies` table with `auto_reply_until` field (line 73)
- ✅ `contacts` table (needs `auto_reply_until` field added)
- ✅ `email_accounts` table with `assigned_persona_id` for AI persona assignment
- ✅ `reply_jobs` table for scheduled autonomous replies

**AI Persona Integration**:
- ✅ Email accounts can be assigned to AI personas via `assigned_persona_id`
- ✅ `checkAndDraftAutonomousReply()` creates draft replies for human messages
- ✅ Uses `createDraftService()` to generate AI-powered replies

### 1.2 What's Missing ❌

1. **Contact Schema**: `contacts.auto_reply_until` field not present
2. **Persona Suppression Logic**: No check in autonomous reply system to skip contacts with active auto-replies
3. **IMAP Integration**: Auto-reply detection not integrated with IMAP processor
4. **Logging**: Enhanced logging for auto-reply suppression events

---

## 2. Implementation Phases

### Phase 1: Database Schema Enhancement (30 mins)

**Goal**: Add `auto_reply_until` field to contacts table and ensure proper indexing

**File**: `/Users/caohungnguyen/Projects/Kiro/pitchdonkey/supabase/migrations/20251016_add_auto_reply_detection.sql`

```sql
-- Migration: Auto-Reply Detection & AI Persona Suppression
-- Purpose: Prevent AI personas from responding to OOO/vacation auto-replies
-- Date: 2025-10-16

-- ============================================================================
-- Part 1: Add auto_reply_until to contacts table
-- ============================================================================

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS auto_reply_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient queries on active auto-replies
CREATE INDEX IF NOT EXISTS idx_contacts_auto_reply_until
ON contacts(auto_reply_until)
WHERE auto_reply_until IS NOT NULL AND auto_reply_until > NOW();

-- Add comment for documentation
COMMENT ON COLUMN contacts.auto_reply_until IS
'Timestamp until which contact has auto-reply enabled (OOO, vacation). NULL = no active auto-reply.';

-- ============================================================================
-- Part 2: Helper function to check active auto-replies
-- ============================================================================

CREATE OR REPLACE FUNCTION is_contact_auto_replying(contact_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  auto_reply_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT auto_reply_until INTO auto_reply_end
  FROM contacts
  WHERE id = contact_id_param;

  -- Return true if auto_reply_until exists and is in the future
  RETURN (auto_reply_end IS NOT NULL AND auto_reply_end > NOW());
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_contact_auto_replying IS
'Check if a contact currently has an active auto-reply (OOO/vacation)';

-- ============================================================================
-- Part 3: Update contacts type in database.types.ts
-- ============================================================================

-- This migration will require regenerating TypeScript types:
-- Run: npx supabase gen types typescript --local > lib/database.types.ts

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'auto_reply_until'
  ) THEN
    RAISE EXCEPTION 'auto_reply_until column was not added to contacts';
  END IF;

  RAISE NOTICE 'Migration completed successfully! ✅';
  RAISE NOTICE 'Added column: contacts.auto_reply_until';
  RAISE NOTICE 'Created function: is_contact_auto_replying(UUID)';
  RAISE NOTICE 'Created index: idx_contacts_auto_reply_until';
END $$;
```

**Expected Changes**:
- New column: `contacts.auto_reply_until` (TIMESTAMP WITH TIME ZONE, nullable)
- New index: `idx_contacts_auto_reply_until` (conditional on future dates)
- New function: `is_contact_auto_replying(contact_id UUID) RETURNS BOOLEAN`

**Testing**:
```sql
-- Test 1: Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name = 'auto_reply_until';

-- Test 2: Test helper function
SELECT is_contact_auto_replying('test-uuid-here');

-- Test 3: Query contacts with active auto-replies
SELECT id, email, first_name, last_name, auto_reply_until
FROM contacts
WHERE auto_reply_until IS NOT NULL AND auto_reply_until > NOW();
```

**Rollback Plan**:
```sql
-- Rollback: Remove auto_reply_until field
DROP INDEX IF EXISTS idx_contacts_auto_reply_until;
DROP FUNCTION IF EXISTS is_contact_auto_replying;
ALTER TABLE contacts DROP COLUMN IF EXISTS auto_reply_until;
```

---

### Phase 2: Enhanced Auto-Reply Detection (1 hour)

**Goal**: Ensure comprehensive auto-reply detection patterns including transactional emails

**Current State** (`lib/email-classifier.ts`):
- ✅ Lines 182-307: Auto-reply classification with confidence scoring
- ✅ Lines 188-198: Transactional/no-reply sender patterns (HIGH CONFIDENCE)
- ✅ Lines 201-215: Transactional content patterns (login, verification, receipts)
- ✅ Lines 218-241: Auto-reply patterns (OOO, vacation, away)
- ✅ Lines 273-281: Date extraction for return dates

**Enhancement Needed**: Additional patterns for edge cases

**File**: `/Users/caohungnguyen/Projects/Kiro/pitchdonkey/lib/email-classifier.ts`

```typescript
// Add to noReplySenderPatterns (line 188)
const noReplySenderPatterns = [
  /no-reply/i,
  /noreply/i,
  /no_reply/i,
  /donotreply/i,
  /do-not-reply/i,
  /notifications?@/i,
  /auto-confirm/i,
  /mailer@/i,
  /automated@/i,
  // NEW: Additional patterns
  /bounce@/i,
  /postmaster@/i,
  /reply.*not.*monitored/i,
  /unattended@/i
]

// Add to transactionalPatterns (line 201)
const transactionalPatterns = [
  // Existing patterns...
  /verify.*email/i,
  /confirm.*email/i,
  // NEW: Additional patterns
  /account.*notification/i,
  /system.*alert/i,
  /automated.*message/i,
  /shipping.*confirmation/i,
  /invoice.*available/i,
  /password.*reset/i,
  /two.*factor.*auth/i
]

// Enhanced date extraction (line 273)
const dateMatches = content.match(
  /(?:return|back|available).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|
   (?:until|through).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|
   (\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i
)
```

**Testing**:
```typescript
// Test auto-reply detection
import { emailClassifier } from './email-classifier'

const testCases = [
  {
    name: 'OOO with return date',
    email: {
      fromAddress: 'john@example.com',
      subject: 'Out of Office',
      textContent: 'I am out of office until 10/20/2025. Please contact jane@example.com.',
      // ...other fields
    },
    expected: { type: 'auto_reply', confidence: 0.9 }
  },
  {
    name: 'No-reply transactional',
    email: {
      fromAddress: 'no-reply@service.com',
      subject: 'Verify your email',
      textContent: 'Click here to verify your email address',
      // ...other fields
    },
    expected: { type: 'auto_reply', subtype: 'transactional', confidence: 0.9 }
  },
  // Add more test cases...
]

for (const test of testCases) {
  const result = await emailClassifier.classifyEmail(test.email)
  console.log(`Test: ${test.name}`, result.type === test.expected.type ? '✅' : '❌')
}
```

---

### Phase 3: Reply Processor Integration (1 hour)

**Goal**: Update reply processor to store auto-reply data in contacts table

**Current State** (`lib/reply-processor.ts`):
- ✅ Lines 398-444: `handleAutoReply()` method exists
- ⚠️ Line 412: Currently updates `contacts.auto_reply_until` but field doesn't exist in DB

**Enhancement**: Ensure proper error handling and logging

**File**: `/Users/caohungnguyen/Projects/Kiro/pitchdonkey/lib/reply-processor.ts`

```typescript
// Enhanced handleAutoReply method (line 398)
private async handleAutoReply(
  email: any,
  classification: EmailClassificationResult,
  context: any
): Promise<ReplyAction[]> {
  const actions: ReplyAction[] = []

  if (context.contactId) {
    // Update contact with auto-reply information
    const updateData: any = {
      last_contacted_at: new Date().toISOString()
    }

    if (classification.autoReplyInfo?.autoReplyUntil) {
      updateData.auto_reply_until = classification.autoReplyInfo.autoReplyUntil.toISOString()

      console.log(`🚫 Auto-reply detected for contact ${context.contactId}`)
      console.log(`   Auto-reply active until: ${updateData.auto_reply_until}`)
      console.log(`   Subtype: ${classification.subtype}`)
    }

    // NEW: Enhanced error handling
    const { error } = await this.supabase
      .from('contacts')
      .update(updateData)
      .eq('id', context.contactId)

    if (error) {
      console.error(`❌ Failed to update contact auto-reply status:`, error)
      actions.push({
        action: 'auto_reply_update_failed',
        timestamp: new Date().toISOString(),
        details: { error: error.message }
      })
    } else {
      actions.push({
        action: 'contact_auto_reply_recorded',
        timestamp: new Date().toISOString(),
        details: {
          autoReplyUntil: classification.autoReplyInfo?.autoReplyUntil,
          subtype: classification.subtype
        }
      })
    }

    // Temporarily pause campaigns for extended absences (>7 days)
    if (classification.autoReplyInfo?.autoReplyUntil && context.campaignId) {
      const awayDuration = classification.autoReplyInfo.autoReplyUntil.getTime() - Date.now()
      if (awayDuration > 7 * 24 * 60 * 60 * 1000) {
        await this.pauseCampaignForContact(context.campaignId, context.contactId)
        actions.push({
          action: 'campaign_paused_extended_absence',
          timestamp: new Date().toISOString(),
          details: {
            campaignId: context.campaignId,
            awayUntil: classification.autoReplyInfo.autoReplyUntil
          }
        })
      }
    }
  }

  return actions
}
```

**Testing**:
```typescript
// Test reply processor integration
import { createReplyProcessor } from './reply-processor'

const testAutoReply = async () => {
  const processor = createReplyProcessor(supabase)

  // Simulate incoming auto-reply email
  const incomingEmail = {
    id: 'test-email-id',
    user_id: 'test-user-id',
    from_address: 'contact@example.com',
    subject: 'Out of Office',
    text_content: 'I am away until 10/25/2025',
    // ...other fields
  }

  const actions = await processor.processIncomingEmail(incomingEmail)

  console.log('Actions taken:', actions)

  // Verify contact was updated
  const { data: contact } = await supabase
    .from('contacts')
    .select('auto_reply_until')
    .eq('email', 'contact@example.com')
    .single()

  console.log('Contact auto_reply_until:', contact?.auto_reply_until)
}
```

---

### Phase 4: AI Persona Suppression (1.5 hours)

**Goal**: Prevent AI personas from drafting replies to contacts with active auto-replies

**Current State** (`lib/reply-processor.ts`):
- ✅ Lines 519-587: `checkAndDraftAutonomousReply()` method
- ⚠️ No check for active auto-replies before drafting

**Enhancement**: Add auto-reply check before autonomous drafting

**File**: `/Users/caohungnguyen/Projects/Kiro/pitchdonkey/lib/reply-processor.ts`

```typescript
// Enhanced checkAndDraftAutonomousReply (line 519)
private async checkAndDraftAutonomousReply(
  email: any,
  classification: EmailClassificationResult,
  context: any
): Promise<ReplyAction | null> {
  const accountId = email.email_account_id

  if (!accountId) {
    console.log('⏭️ Incoming email missing email_account_id, skipping autonomous draft')
    return null
  }

  // Find the email account that received this email
  const { data: emailAccount, error: emailAccountError } = await this.supabase
    .from('email_accounts')
    .select('id, email, assigned_persona_id, user_id')
    .eq('id', accountId)
    .eq('user_id', email.user_id)
    .single()

  if (emailAccountError || !emailAccount) {
    console.log('⏭️ No email account found for', email.to_address)
    return null
  }

  // Check if agent is assigned
  if (!emailAccount.assigned_persona_id) {
    console.log('⏭️ No AI persona assigned to mailbox', emailAccount.email)
    return null
  }

  // NEW: Check if contact has active auto-reply
  if (context.contactId) {
    const { data: contact } = await this.supabase
      .from('contacts')
      .select('auto_reply_until')
      .eq('id', context.contactId)
      .single()

    if (contact?.auto_reply_until) {
      const autoReplyEnd = new Date(contact.auto_reply_until)
      const now = new Date()

      if (autoReplyEnd > now) {
        console.log(`🚫 Suppressing AI reply - contact has active auto-reply until ${autoReplyEnd.toISOString()}`)

        return {
          action: 'autonomous_draft_suppressed',
          timestamp: new Date().toISOString(),
          details: {
            reason: 'contact_auto_reply_active',
            autoReplyUntil: autoReplyEnd.toISOString(),
            contactId: context.contactId,
            personaId: emailAccount.assigned_persona_id
          }
        }
      }
    }
  }

  console.log(`🤖 AI Persona ${emailAccount.assigned_persona_id} assigned to ${emailAccount.email} - drafting autonomous reply`)

  // ... rest of existing drafting logic (lines 554-587)
  const draftService = createDraftService(this.supabase)

  try {
    const draftResult = await draftService.draftReply(email.user_id, {
      agentId: emailAccount.assigned_persona_id,
      emailAccountId: emailAccount.id,
      incomingEmailId: email.id,
      threadId: email.thread_id || email.message_id,
      contactId: context.contactId,
      incomingSubject: email.subject,
      incomingBody: email.text_content || email.html_content,
      incomingFrom: email.from_address,
      messageRef: email.message_id,
    })

    console.log(`✅ Autonomous draft created: ${draftResult.replyJobId} (status: ${draftResult.status})`)

    return {
      action: 'autonomous_draft_created',
      timestamp: new Date().toISOString(),
      details: {
        replyJobId: draftResult.replyJobId,
        status: draftResult.status,
        riskScore: draftResult.riskScore,
        scheduledAt: draftResult.scheduledAt,
      }
    }
  } catch (error) {
    console.error('❌ Failed to draft autonomous reply:', error)
    throw error
  }
}
```

**Testing**:
```typescript
// Test autonomous reply suppression
import { createReplyProcessor } from './reply-processor'

const testSuppressionLogic = async () => {
  const processor = createReplyProcessor(supabase)

  // Setup: Create contact with active auto-reply
  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      email: 'ooo@example.com',
      first_name: 'Test',
      last_name: 'Contact',
      user_id: 'test-user-id',
      auto_reply_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    })
    .select()
    .single()

  // Simulate incoming email from contact with OOO
  const incomingEmail = {
    id: 'test-email-id',
    user_id: 'test-user-id',
    email_account_id: 'test-account-id',
    from_address: 'ooo@example.com',
    subject: 'Re: Follow-up',
    text_content: 'Thanks for reaching out!',
    // ...other fields
  }

  const actions = await processor.processIncomingEmail(incomingEmail)

  // Verify autonomous_draft_suppressed action
  const suppressedAction = actions.find(a => a.action === 'autonomous_draft_suppressed')

  console.log('Suppression test:', suppressedAction ? '✅ PASSED' : '❌ FAILED')
  console.log('Actions:', actions)
}
```

---

### Phase 5: IMAP Processor Integration (30 mins)

**Goal**: Ensure IMAP processor triggers reply classification pipeline

**Current State**:
- ✅ IMAP fetches emails and stores in `incoming_emails` table
- ⚠️ Need to verify classification pipeline is triggered

**File**: Check `/Users/caohungnguyen/Projects/Kiro/pitchdonkey/lib/email-fetch-service.ts` or IMAP processor

**Enhancement**:
```typescript
// Ensure IMAP processor calls reply processor
import { replyProcessor } from './reply-processor'

// After storing email in incoming_emails
const { data: newEmail } = await supabase
  .from('incoming_emails')
  .insert(emailData)
  .select()
  .single()

// Trigger classification pipeline
try {
  await replyProcessor.processIncomingEmail(newEmail)
} catch (error) {
  console.error('Failed to process incoming email:', error)
}
```

**Testing**:
- Verify IMAP fetch triggers classification
- Check `email_replies` table for new records
- Verify `contacts.auto_reply_until` is updated

---

### Phase 6: Enhanced Logging & Monitoring (30 mins)

**Goal**: Add comprehensive logging for auto-reply detection and suppression

**Enhancements**:

1. **Structured Logging** (`lib/reply-processor.ts`):
```typescript
// Add structured logging helper
private logAutoReplyEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  details: any
) {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    level,
    event,
    ...details
  }

  console.log(`[AUTO-REPLY] ${timestamp} [${level.toUpperCase()}] ${event}`, details)

  // Optional: Send to monitoring service (e.g., Sentry, LogRocket)
}

// Usage examples:
this.logAutoReplyEvent('info', 'auto_reply_detected', {
  contactId: context.contactId,
  emailId: email.id,
  subtype: classification.subtype,
  autoReplyUntil: classification.autoReplyInfo?.autoReplyUntil
})

this.logAutoReplyEvent('info', 'autonomous_draft_suppressed', {
  contactId: context.contactId,
  personaId: emailAccount.assigned_persona_id,
  reason: 'active_auto_reply',
  autoReplyUntil: contact.auto_reply_until
})
```

2. **Dashboard Metrics** (Future enhancement):
- Count of auto-replies detected per day
- Count of autonomous drafts suppressed
- Average auto-reply duration
- Most common auto-reply types (OOO, vacation, transactional)

---

## 3. Testing Strategy

### 3.1 Unit Tests

**File**: `/Users/caohungnguyen/Projects/Kiro/pitchdonkey/__tests__/lib/reply-processor-autoreply.test.ts`

```typescript
import { createReplyProcessor } from '@/lib/reply-processor'
import { emailClassifier } from '@/lib/email-classifier'

describe('Auto-Reply Detection & Suppression', () => {
  describe('Email Classification', () => {
    it('should classify OOO emails correctly', async () => {
      const email = {
        fromAddress: 'john@example.com',
        subject: 'Out of Office',
        textContent: 'I am away until 10/25/2025',
        // ...
      }

      const result = await emailClassifier.classifyEmail(email)

      expect(result.type).toBe('auto_reply')
      expect(result.subtype).toBe('out_of_office')
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.autoReplyInfo?.autoReplyUntil).toBeDefined()
    })

    it('should classify transactional emails correctly', async () => {
      const email = {
        fromAddress: 'no-reply@service.com',
        subject: 'Verify your email',
        textContent: 'Click to verify',
        // ...
      }

      const result = await emailClassifier.classifyEmail(email)

      expect(result.type).toBe('auto_reply')
      expect(result.subtype).toBe('transactional')
      expect(result.confidence).toBeGreaterThan(0.8)
    })
  })

  describe('Contact Auto-Reply Storage', () => {
    it('should update contacts.auto_reply_until', async () => {
      // Test implementation...
    })
  })

  describe('AI Persona Suppression', () => {
    it('should suppress autonomous drafts for contacts with active auto-replies', async () => {
      // Test implementation...
    })

    it('should allow autonomous drafts after auto-reply expires', async () => {
      // Test implementation...
    })
  })
})
```

### 3.2 Integration Tests

1. **Full Pipeline Test**:
   - IMAP fetches OOO email
   - Email classified as auto_reply
   - Contact auto_reply_until updated
   - Autonomous draft suppressed
   - Log entries created

2. **Edge Cases**:
   - Contact with expired auto_reply_until (should allow drafts)
   - Contact with no auto_reply_until (should allow drafts)
   - Multiple auto-reply emails (should update to latest date)
   - Invalid date formats in OOO messages

### 3.3 Manual Testing

1. **Setup**:
   - Create test email account with assigned AI persona
   - Enable IMAP connection
   - Import test contacts

2. **Test Cases**:
   - Send OOO email from test contact
   - Verify classification in `email_replies` table
   - Verify `contacts.auto_reply_until` is updated
   - Send follow-up email from same contact
   - Verify no autonomous draft is created
   - Check logs for suppression event

3. **Cleanup**:
   - Remove test data
   - Verify no side effects on production data

---

## 4. Risk Mitigation

### 4.1 Potential Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positives (legitimate replies classified as auto-reply) | Medium | Enhanced confidence scoring, human review for low confidence |
| Missing auto-reply patterns | Low | Continuous pattern improvement, monitoring |
| Database migration failures | Low | Rollback script, test on staging first |
| Performance impact of additional queries | Low | Indexed queries, efficient database design |
| Edge case: Auto-reply expires during processing | Low | Always check current timestamp vs. auto_reply_until |

### 4.2 Rollback Plan

**Database Rollback**:
```sql
-- Remove auto_reply_until from contacts
DROP INDEX IF EXISTS idx_contacts_auto_reply_until;
DROP FUNCTION IF EXISTS is_contact_auto_replying;
ALTER TABLE contacts DROP COLUMN IF EXISTS auto_reply_until;
```

**Code Rollback**:
- Revert changes to `reply-processor.ts`
- Remove auto-reply check from `checkAndDraftAutonomousReply()`
- Remove enhanced logging

### 4.3 Monitoring

**Key Metrics**:
- Auto-reply detection rate (per day)
- False positive rate (manual review)
- Suppression rate (autonomous drafts blocked)
- Average auto-reply duration
- Classification confidence distribution

**Alerts**:
- High false positive rate (>10%)
- Classification errors (exceptions)
- Database query performance degradation

---

## 5. Deployment Checklist

### Pre-Deployment

- [ ] Review all code changes
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Test database migration on staging
- [ ] Generate updated TypeScript types (`npx supabase gen types typescript`)
- [ ] Update `lib/database.types.ts`
- [ ] Review security implications (RLS policies)
- [ ] Create monitoring dashboard

### Deployment

- [ ] Apply database migration on production
- [ ] Deploy code changes
- [ ] Verify IMAP processor is running
- [ ] Monitor logs for errors
- [ ] Test with known OOO contacts
- [ ] Verify autonomous drafts are suppressed

### Post-Deployment

- [ ] Monitor auto-reply detection rate
- [ ] Check for classification errors
- [ ] Validate autonomous draft suppression
- [ ] Collect user feedback
- [ ] Document any issues found

---

## 6. Future Enhancements

1. **Smart Auto-Reply Duration Prediction**:
   - ML model to predict typical vacation durations
   - Extend auto_reply_until based on patterns

2. **Auto-Reply Type Classification**:
   - Distinguish between permanent (no-reply) vs temporary (OOO) auto-replies
   - Different handling strategies for each type

3. **User Dashboard**:
   - Show contacts currently on auto-reply
   - Allow manual override of suppression
   - Display suppression statistics

4. **Multi-Language Support**:
   - Detect auto-replies in languages other than English
   - Pattern matching for German, French, Spanish OOO messages

5. **Integration with Calendar APIs**:
   - Sync with Google Calendar out-of-office settings
   - Pre-populate auto_reply_until from calendar data

---

## 7. Documentation Updates Required

- [ ] Update API documentation for `contacts` table schema
- [ ] Add auto-reply detection section to CLAUDE.md
- [ ] Document AI persona suppression logic
- [ ] Update IMAP processor documentation
- [ ] Add troubleshooting guide for auto-reply issues

---

## 8. Summary

**Implementation Complexity**: Low-Medium

**Key Success Factors**:
1. ✅ Existing email classification infrastructure (80% complete)
2. ✅ Existing autonomous reply system with persona awareness
3. ✅ Simple database schema change (single field + index)
4. ✅ Clear integration points with existing pipeline

**Estimated Timeline**:
- Phase 1 (Database): 30 minutes
- Phase 2 (Detection): 1 hour
- Phase 3 (Reply Processor): 1 hour
- Phase 4 (Suppression): 1.5 hours
- Phase 5 (IMAP): 30 minutes
- Phase 6 (Logging): 30 minutes
- **Total: 5.5 hours** (well within 1-2 days)

**Risk Level**: Low
- Minimal changes to existing code
- Well-defined integration points
- Comprehensive testing strategy
- Clear rollback path

---

## Appendix A: File Changes Summary

| File | Changes | Lines | Status |
|------|---------|-------|--------|
| `supabase/migrations/20251016_add_auto_reply_detection.sql` | New migration | ~80 | NEW |
| `lib/email-classifier.ts` | Enhanced patterns | ~20 | MINOR |
| `lib/reply-processor.ts` | Auto-reply check + logging | ~50 | MODERATE |
| `lib/database.types.ts` | Updated types | Auto-gen | REGENERATE |
| `__tests__/lib/reply-processor-autoreply.test.ts` | New test suite | ~200 | NEW |

**Total New Code**: ~350 lines
**Total Modified Code**: ~70 lines
**Total Test Code**: ~200 lines

---

## Appendix B: Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        contacts                              │
├─────────────────────────────────────────────────────────────┤
│ id                          UUID (PK)                        │
│ email                       TEXT (UNIQUE)                    │
│ first_name                  TEXT                             │
│ last_name                   TEXT                             │
│ ...                                                           │
│ auto_reply_until            TIMESTAMP WITH TIME ZONE (NEW)   │ <-- ADDED
│ engagement_status           TEXT                             │
│ engagement_score            INTEGER                          │
│ ...                                                           │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
                               │ foreign key
                               │
┌─────────────────────────────────────────────────────────────┐
│                      email_replies                           │
├─────────────────────────────────────────────────────────────┤
│ id                          UUID (PK)                        │
│ user_id                     UUID (FK → users)                │
│ incoming_email_id           UUID (FK → incoming_emails)      │
│ contact_id                  UUID (FK → contacts) (NULLABLE)  │
│ campaign_id                 UUID (FK → campaigns) (NULLABLE) │
│ reply_type                  TEXT                             │
│ auto_reply_until            TIMESTAMP WITH TIME ZONE         │ <-- EXISTING
│ ...                                                           │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
                               │ references
                               │
┌─────────────────────────────────────────────────────────────┐
│                    incoming_emails                           │
├─────────────────────────────────────────────────────────────┤
│ id                          UUID (PK)                        │
│ user_id                     UUID (FK → users)                │
│ email_account_id            UUID (FK → email_accounts)       │
│ message_id                  TEXT (UNIQUE)                    │
│ from_address                TEXT                             │
│ subject                     TEXT                             │
│ text_content                TEXT                             │
│ classification_status       TEXT                             │
│ classification_confidence   DECIMAL(3,2)                     │
│ ...                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

*End of Implementation Workflow Document*
