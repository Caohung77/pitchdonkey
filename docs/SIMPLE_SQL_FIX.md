# Simple SQL Fix for Persona Assignments

**Date:** 2025-10-13

## Copy and Paste This SQL

Run this in Supabase Dashboard → SQL Editor:

```sql
-- Step 1: Check current state
SELECT
  'BEFORE FIX' as stage,
  ea.email,
  ea.assigned_agent_id,
  ap.name as persona_name,
  ap.status as current_status
FROM email_accounts ea
LEFT JOIN ai_personas ap ON ea.assigned_agent_id = ap.id
WHERE ea.assigned_agent_id IS NOT NULL;

-- Step 2: Clean up invalid references (if any)
UPDATE email_accounts
SET assigned_agent_id = NULL,
    updated_at = NOW()
WHERE assigned_agent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ai_personas WHERE id = email_accounts.assigned_agent_id
  );

-- Step 3: Mark assigned personas as active
UPDATE ai_personas
SET status = 'active',
    updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT assigned_agent_id
  FROM email_accounts
  WHERE assigned_agent_id IS NOT NULL
)
AND status != 'active';

-- Step 4: Verify the fix
SELECT
  'AFTER FIX' as stage,
  ea.email,
  ap.name as persona_name,
  ap.status as new_status
FROM email_accounts ea
INNER JOIN ai_personas ap ON ea.assigned_agent_id = ap.id
WHERE ea.assigned_agent_id IS NOT NULL;

-- Step 5: Show all active personas
SELECT
  name,
  sender_name,
  status,
  persona_type,
  'Assigned to email account' as note
FROM ai_personas
WHERE status = 'active'
ORDER BY name;
```

## What This Does

1. **Shows current state** - See which personas are assigned before fix
2. **Cleans up** - Removes any invalid references
3. **Marks as active** - Sets assigned personas to 'active' status
4. **Verifies** - Shows the result after fix
5. **Lists active** - Shows all active personas

## Expected Output

### Before Fix:
```
stage       | email              | persona_name | current_status
------------|-------------------|--------------|----------------
BEFORE FIX  | your@email.com    | Sam Sales    | inactive
```

### After Fix:
```
stage       | email              | persona_name | new_status
------------|-------------------|--------------|------------
AFTER FIX   | your@email.com    | Sam Sales    | active
```

## Alternative: Super Simple Version

If the above still has issues, run just these 3 queries one at a time:

### Query 1: Check what you have
```sql
SELECT
  ea.email,
  ap.name as assigned_persona,
  ap.status
FROM email_accounts ea
INNER JOIN ai_personas ap ON ea.assigned_agent_id = ap.id
WHERE ea.assigned_agent_id IS NOT NULL;
```

### Query 2: Fix the status
```sql
UPDATE ai_personas
SET status = 'active', updated_at = NOW()
WHERE id IN (
  SELECT assigned_agent_id FROM email_accounts WHERE assigned_agent_id IS NOT NULL
);
```

### Query 3: Verify it worked
```sql
SELECT name, status FROM ai_personas WHERE status = 'active';
```

## Done!

After running any of these SQL queries:
1. Refresh your AI Personas page
2. Assigned personas should show green "active" badge
3. Email account assignment should work perfectly

---

**No migration file needed** - just run these queries directly!
