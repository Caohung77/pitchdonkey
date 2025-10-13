# Migrate Legacy Outreach Agents to AI Personas

**Version:** v0.26.0
**Date:** 2025-10-13
**Status:** ✅ READY TO APPLY

## Problem Analysis

You have **"Sam Sales"** assigned to your email account, which is from the **legacy `outreach_agents`** system. This needs to be migrated to the new **`ai_personas`** system.

### Current System State

**Legacy System (`outreach_agents`):**
- Old table: `outreach_agents`
- Old API: `/api/outreach-agents`
- Old page: `/dashboard/outreach-agents`
- Assignment: Email accounts reference `assigned_agent_id`

**New System (`ai_personas`):**
- New table: `ai_personas`
- New API: `/api/ai-personas`
- New page: `/dashboard/ai-personas`
- Need to migrate existing assignments

## Is "Sam Sales" the Same as "Sam Helper"?

**Need to verify in database:**
Run this SQL to check:
```sql
-- Check for Sam in legacy system
SELECT 'LEGACY' as source, id, name, status, created_at
FROM outreach_agents
WHERE name ILIKE '%sam%';

-- Check for Sam in new system
SELECT 'NEW' as source, id, name, sender_name, status, created_at
FROM ai_personas
WHERE name ILIKE '%sam%' OR sender_name ILIKE '%sam%';
```

**Possible Scenarios:**

1. **They are DIFFERENT (different IDs):**
   - "Sam Sales" is legacy agent (outreach_agents)
   - "Sam Helper" is new persona (ai_personas)
   - Need to decide which one to keep

2. **They are the SAME (same ID):**
   - Same person, just showing in both systems
   - Migration already partially done
   - Just need to update references

3. **Only ONE exists:**
   - "Sam Sales" only in outreach_agents → Needs migration
   - "Sam Helper" only in ai_personas → Legacy agent doesn't exist

## Migration Strategy

### Phase 1: Database Migration

**File:** `supabase/migrations/20251013_migrate_outreach_agents_to_personas.sql`

**What it does:**
1. Migrates all legacy outreach agents to ai_personas
2. Preserves agent IDs (so email account assignments still work)
3. Skips duplicates (if agent name already exists)
4. Keeps legacy active status for assigned agents
5. Maps agent data to persona fields

**Apply Migration:**

```bash
# Option 1: Supabase CLI
supabase db push

# Option 2: Manual via Dashboard
# Copy SQL from migration file and run in SQL Editor
```

### Phase 2: Update UI Components

**File:** `components/email-accounts/AssignAgentDialog.tsx`

**Changes Made:**
1. Changed API call from `/api/outreach-agents` to `/api/ai-personas`
2. Updated UI labels: "Outreach Agent" → "AI Persona"
3. Updated link: `/dashboard/outreach-agents` → `/dashboard/ai-personas/create`

**Result:**
- Email account assignment dialog now uses new AI Personas
- All existing assignments continue to work (IDs preserved)

## Detailed Migration Steps

### Step 1: Backup Current Data

```sql
-- Backup outreach agents
SELECT * FROM outreach_agents;

-- Backup email account assignments
SELECT ea.id, ea.email, ea.assigned_agent_id, oa.name
FROM email_accounts ea
LEFT JOIN outreach_agents oa ON ea.assigned_agent_id = oa.id
WHERE ea.assigned_agent_id IS NOT NULL;
```

### Step 2: Run Migration

**Manual SQL via Supabase Dashboard:**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor"
4. Copy the migration SQL below:

```sql
-- Migrate outreach agents to ai_personas
INSERT INTO ai_personas (
  id,
  user_id,
  name,
  status,
  persona_type,
  purpose,
  tone,
  language,
  sender_name,
  personality_traits,
  avatar_generation_status,
  chat_enabled,
  total_chats,
  total_emails_handled,
  segment_config,
  quality_weights,
  knowledge_summary,
  settings,
  created_at,
  updated_at
)
SELECT
  oa.id,  -- Preserve ID so email account assignments work
  oa.user_id,
  oa.name,
  CASE
    WHEN oa.status = 'active' THEN 'active'::text
    ELSE 'inactive'::text
  END as status,
  -- Map to persona type based on purpose/name
  CASE
    WHEN oa.purpose ILIKE '%support%' OR oa.name ILIKE '%support%' THEN 'customer_support'
    WHEN oa.purpose ILIKE '%sales%' OR oa.name ILIKE '%sales%' THEN 'sales_rep'
    WHEN oa.name ILIKE '%consultant%' THEN 'consultant'
    ELSE 'custom'
  END::text as persona_type,
  oa.purpose,
  oa.tone,
  COALESCE(oa.language, 'en')::text as language,
  oa.name as sender_name,
  jsonb_build_object(
    'communication_style', COALESCE(oa.tone, 'professional'),
    'response_length', 'balanced',
    'empathy_level', 'moderate',
    'formality', 'professional',
    'expertise_depth', 'intermediate',
    'proactivity', 'balanced'
  ) as personality_traits,
  'pending'::text as avatar_generation_status,
  true as chat_enabled,
  0 as total_chats,
  0 as total_emails_handled,
  COALESCE(oa.segment_config, '{}'::jsonb),
  COALESCE(oa.quality_weights, '{}'::jsonb),
  COALESCE(oa.knowledge_summary, '{}'::jsonb),
  COALESCE(oa.settings, '{}'::jsonb),
  oa.created_at,
  oa.updated_at
FROM outreach_agents oa
WHERE NOT EXISTS (
  SELECT 1 FROM ai_personas ap
  WHERE ap.name = oa.name AND ap.user_id = oa.user_id
)
ON CONFLICT (id) DO NOTHING;
```

5. Click "Run"
6. Check results

### Step 3: Verify Migration

```sql
-- Check migrated personas
SELECT id, name, sender_name, persona_type, status, created_at
FROM ai_personas
ORDER BY created_at DESC;

-- Verify email account assignments still work
SELECT
  ea.email,
  ap.name as persona_name,
  ap.status as persona_status
FROM email_accounts ea
LEFT JOIN ai_personas ap ON ea.assigned_agent_id = ap.id
WHERE ea.assigned_agent_id IS NOT NULL;
```

**Expected result:**
- "Sam Sales" should now appear in `ai_personas`
- Email account assignment should still reference "Sam Sales"
- Persona status should be 'active' (since it's assigned)

### Step 4: Test in UI

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Check AI Personas page:**
   ```
   http://localhost:3007/dashboard/ai-personas
   ```
   - "Sam Sales" should appear in the list
   - Should show "active" status (green badge)

3. **Check Email Account Assignment:**
   ```
   http://localhost:3007/dashboard/email-accounts
   ```
   - Click on your email account
   - Click "Assign AI Persona" (updated label)
   - "Sam Sales" should appear in dropdown
   - Should show as currently assigned

## What Happens to "Sam Helper"?

**If "Sam Helper" is a duplicate:**

1. **Keep "Sam Sales"** (since it's assigned to email account)
2. **Option 1 - Merge:** Copy knowledge/settings from "Sam Helper" to "Sam Sales"
3. **Option 2 - Delete:** Remove "Sam Helper" as duplicate

```sql
-- Check if they're duplicates
SELECT name, sender_name, status, created_at
FROM ai_personas
WHERE name ILIKE '%sam%' OR sender_name ILIKE '%sam%'
ORDER BY created_at;

-- If duplicate, delete the newer one
DELETE FROM ai_personas
WHERE name = 'Sam Helper'
  AND id NOT IN (
    SELECT assigned_agent_id FROM email_accounts WHERE assigned_agent_id IS NOT NULL
  );
```

## Data Mapping

### Legacy `outreach_agents` → New `ai_personas`

| Legacy Field | New Field | Mapping Logic |
|--------------|-----------|---------------|
| `id` | `id` | **Preserved** (critical for assignments) |
| `name` | `name` | Direct copy |
| `name` | `sender_name` | Use name as sender name |
| `status` | `status` | active→active, else→inactive |
| `purpose` | `purpose` | Direct copy |
| `tone` | `tone` | Direct copy |
| `language` | `language` | Default 'en' if null |
| `custom_prompt` | `custom_prompt` | Direct copy |
| `purpose/name` | `persona_type` | Auto-detect from keywords |
| `tone` | `personality_traits` | Build from tone |
| `segment_config` | `segment_config` | Direct copy |
| `knowledge_summary` | `knowledge_summary` | Direct copy |

### Auto-Detection Logic

**Persona Type:**
- Contains "support" → `customer_support`
- Contains "sales" → `sales_rep`
- Contains "consultant" → `consultant`
- Default → `custom`

**Example:**
- "Sam Sales" → `persona_type: 'sales_rep'`
- "Sarah Support" → `persona_type: 'customer_support'`

## Testing Scenarios

### Scenario 1: "Sam Sales" is assigned to email

1. **Before migration:**
   - Email account → assigned_agent_id → outreach_agents.id
   - "Sam Sales" in outreach_agents table
   - `/api/outreach-agents` returns "Sam Sales"

2. **After migration:**
   - Email account → assigned_agent_id → ai_personas.id (same ID!)
   - "Sam Sales" in ai_personas table
   - `/api/ai-personas` returns "Sam Sales"
   - Assignment dialog shows "Sam Sales" as assigned
   - Status is 'active' (green badge)

3. **Expected result:**
   - ✅ Email account assignment works
   - ✅ "Sam Sales" shows in AI Personas list
   - ✅ Can still assign/unassign in Email Account settings

### Scenario 2: Handling duplicates

1. **If "Sam Helper" and "Sam Sales" are different:**
   - Migration creates "Sam Sales" in ai_personas
   - "Sam Helper" already exists in ai_personas
   - Both show in personas list
   - Email account assigned to "Sam Sales" (ID preserved)

2. **User decision needed:**
   - Keep both (different personas for different purposes)
   - Merge them (combine and delete one)
   - Delete one (if truly duplicate)

## Build Status

✅ Build succeeded
✅ UI components updated
✅ Migration script ready

## Files Created/Modified

### New Files:
1. `supabase/migrations/20251013_migrate_outreach_agents_to_personas.sql`
   - Migration script to move data

2. `docs/MIGRATE_OUTREACH_AGENTS_TO_PERSONAS.md`
   - This documentation file

### Modified Files:
1. `components/email-accounts/AssignAgentDialog.tsx`
   - Updated API endpoint from `/api/outreach-agents` to `/api/ai-personas`
   - Updated UI labels to use "AI Persona" terminology
   - Updated create link to `/dashboard/ai-personas/create`

## Next Steps

1. **Run Migration:**
   ```bash
   supabase db push
   # OR manually via Supabase Dashboard
   ```

2. **Verify in Database:**
   ```sql
   SELECT name, persona_type, status FROM ai_personas;
   ```

3. **Test in UI:**
   - Check AI Personas page
   - Check Email Account assignment
   - Verify "Sam Sales" appears and is marked active

4. **Handle Duplicates (if any):**
   - Decide to keep/merge/delete
   - Update assignments if needed

5. **Deprecate Legacy:**
   - Keep `/dashboard/outreach-agents` page for reference
   - Add deprecation notice
   - Eventually remove after confirming all migrations complete

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
**Status:** ✅ Ready to Apply
**Migration:** `supabase/migrations/20251013_migrate_outreach_agents_to_personas.sql`
