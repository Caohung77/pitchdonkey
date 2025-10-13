# AI Persona Email Assignment - Not Yet Implemented

**Date:** 2025-10-13
**Status:** ⚠️ Feature Not Implemented

## Discovery

The `email_accounts` table **does NOT have** an `assigned_agent_id` column. This means:

- ✅ AI Personas system exists (new)
- ❌ Email account → persona assignment NOT implemented yet
- ❌ "Sam Sales" shown in screenshot must be from old UI/mock data

## Current Database Schema

### email_accounts table (confirmed columns):
- `id`
- `email`
- `provider`
- `status`
- `domain`
- `smtp_*` fields
- `imap_*` fields
- **NO `assigned_agent_id` column!**

### ai_personas table (confirmed exists):
- All your personas (Sarah Münster, Marcus Johnson, Anna Schäfer)
- Status field (currently all showing as "active" incorrectly)

## What This Means

### The "Sam Sales" in your screenshot:
1. **Option 1:** Old UI mockup/placeholder data
2. **Option 2:** Legacy code that's not actually working
3. **Option 3:** Different table we haven't found yet

### Current Status:
- ✅ AI Personas created and displayed
- ❌ Cannot assign personas to email accounts yet
- ❌ Feature needs to be built

## Immediate Action: Fix Persona Status

Since assignment isn't implemented, ALL personas should be **inactive**:

```sql
-- Run this to fix all persona statuses
UPDATE ai_personas
SET status = 'inactive',
    updated_at = NOW()
WHERE status IN ('active', 'draft');

-- Verify
SELECT name, sender_name, status FROM ai_personas ORDER BY name;
```

**Expected Result:**
All personas show as `inactive` (since none can be assigned yet).

## Future Implementation Needed

### Step 1: Add Column to email_accounts

```sql
-- Add assigned persona column
ALTER TABLE email_accounts
ADD COLUMN assigned_persona_id UUID REFERENCES ai_personas(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_email_accounts_assigned_persona
ON email_accounts(assigned_persona_id)
WHERE assigned_persona_id IS NOT NULL;
```

### Step 2: Create API Endpoint

**`/api/email-accounts/[id]/assign-persona` (PUT)**

```typescript
// Assign persona to email account
{
  persona_id: string | null
}
```

### Step 3: Update Status Automatically

```sql
-- Trigger to auto-update persona status
CREATE OR REPLACE FUNCTION update_persona_status_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark persona as active if assigned
  IF NEW.assigned_persona_id IS NOT NULL THEN
    UPDATE ai_personas
    SET status = 'active', updated_at = NOW()
    WHERE id = NEW.assigned_persona_id;
  END IF;

  -- Mark old persona as inactive if unassigned
  IF OLD.assigned_persona_id IS NOT NULL
     AND OLD.assigned_persona_id != NEW.assigned_persona_id
     AND NOT EXISTS (
       SELECT 1 FROM email_accounts
       WHERE assigned_persona_id = OLD.assigned_persona_id
       AND id != NEW.id
     )
  THEN
    UPDATE ai_personas
    SET status = 'inactive', updated_at = NOW()
    WHERE id = OLD.assigned_persona_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_persona_status
AFTER INSERT OR UPDATE OF assigned_persona_id
ON email_accounts
FOR EACH ROW
EXECUTE FUNCTION update_persona_status_on_assignment();
```

### Step 4: Update UI

The `AssignAgentDialog` component needs:
1. API endpoint update (currently tries to call `/api/email-accounts/[id]/assign-agent`)
2. Should call new `/api/email-accounts/[id]/assign-persona` endpoint
3. Already updated to use `/api/ai-personas` for listing ✅

## What You Can Do Now

### 1. Fix All Persona Statuses

Run this SQL in Supabase:

```sql
UPDATE ai_personas
SET status = 'inactive',
    updated_at = NOW();

SELECT name, status FROM ai_personas;
```

### 2. Check Where "Sam Sales" Appears

Check if there's a different table storing assignments:

```sql
-- Search for any table with "agent" or "persona" in name
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%agent%' OR table_name LIKE '%persona%');

-- Search for any column with "agent" or "persona"
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE '%agent%' OR column_name LIKE '%persona%')
ORDER BY table_name, column_name;
```

### 3. Verify Assignment Dialog Code

Check what the dialog is actually doing:
- File: `components/email-accounts/AssignAgentDialog.tsx`
- API call on line 100: `/api/email-accounts/${emailAccount.id}/assign-agent`

**This API route probably doesn't work yet!**

## Summary

### ✅ What Exists:
- AI Personas system (table, API, UI)
- Flip card design
- Persona creation workflow

### ❌ What's Missing:
- `assigned_persona_id` column in `email_accounts`
- `/api/email-accounts/[id]/assign-persona` endpoint
- Auto-status update trigger
- Working assignment functionality

### 🎯 Next Steps:

1. **Immediate:** Run SQL to set all personas to `inactive`
2. **Short-term:** Build the assignment feature
3. **Long-term:** Test full workflow (create → assign → activate)

---

**Conclusion:** The persona-to-email assignment feature needs to be built. For now, all personas should be marked as `inactive` until the feature is ready.
