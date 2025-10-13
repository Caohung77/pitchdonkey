# Migration Status Check

## Quick Status Check

Run these SQL queries in your Supabase SQL Editor to verify everything is set up correctly:

### 1. Check Appearance Columns Exist

```sql
-- Should return 3 rows
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_personas'
  AND column_name IN ('gender', 'appearance_description', 'avatar_url');
```

**Expected Result:**
```
column_name            | data_type         | is_nullable
-----------------------|-------------------|-------------
gender                 | character varying | YES
appearance_description | text             | YES
avatar_url            | text             | YES
```

### 2. Check Storage Bucket Exists

```sql
-- Should return 1 row
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id = 'persona-avatars';
```

**Expected Result:**
```
id              | name            | public | created_at
----------------|-----------------|--------|-------------------
persona-avatars | persona-avatars | true   | 2025-10-13 ...
```

### 3. Check Storage Policies

```sql
-- Should return 5 rows (INSERT, SELECT user, UPDATE, DELETE, SELECT public)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%persona avatars%'
ORDER BY policyname;
```

**Expected Result:**
```
policyname                                   | cmd    | qual
---------------------------------------------|--------|------
Public can read persona avatars              | SELECT | (bucket_id = 'persona-avatars'::text)
Users can delete their own persona avatars   | DELETE | ...
Users can read their own persona avatars     | SELECT | ...
Users can update their own persona avatars   | UPDATE | ...
Users can upload to their own persona avatars| INSERT | ...
```

## What To Do Based on Results

### ✅ All 3 Checks Pass
Great! Your database is fully set up. You can now:
1. Rebuild the app: `npm run build`
2. Start dev server: `npm run dev`
3. Create a new persona with avatar generation
4. Test knowledge base with URL and PDF

### ❌ Check 1 Fails (Appearance Columns Missing)
**Action**: Run the first migration

**Supabase Dashboard:**
1. Go to SQL Editor
2. Copy content from `supabase/migrations/20251013_add_persona_appearance_fields.sql`
3. Execute the SQL
4. Re-run Check 1 to verify

**Or via CLI:**
```bash
supabase migration run 20251013_add_persona_appearance_fields
```

### ❌ Check 2 or 3 Fails (Storage Missing/Incomplete)
**Action**: Run the updated storage migration

**Supabase Dashboard:**
1. Go to SQL Editor
2. Copy content from `supabase/migrations/20251013_create_persona_avatar_storage.sql`
3. Execute the SQL (now handles existing policies gracefully)
4. Re-run Checks 2 and 3 to verify

**Or via CLI:**
```bash
supabase migration run 20251013_create_persona_avatar_storage
```

### ⚠️ "Policy Already Exists" Error
This is **NORMAL** and **SAFE**! I've updated the migration to handle this case.

**What happened:**
- The storage bucket was created previously (maybe manually or different migration)
- The new migration now uses `IF NOT EXISTS` checks
- It will only create policies that don't already exist

**Solution:**
1. Use the updated migration file (already done)
2. Re-run the migration - it will skip existing policies and complete successfully
3. Verify with Check 3 above

## Verify Existing Persona

If you already created "Sophiena von The AIWhisperer", check if it has the new fields:

```sql
SELECT
  id,
  name,
  gender,
  appearance_description,
  avatar_url,
  avatar_generation_status,
  created_at
FROM ai_personas
WHERE name LIKE '%Sophiena%'
  OR name LIKE '%AIWhisperer%';
```

### If gender/appearance_description are NULL
That persona was created **before** the columns existed. Options:

**Option A: Create a New Persona** (Recommended)
- Create a new persona to test the full flow
- Old persona will still work, just without appearance data

**Option B: Manually Add Appearance Data**
```sql
UPDATE ai_personas
SET
  gender = 'female',
  appearance_description = 'Professional business attire, friendly demeanor',
  avatar_url = 'https://your-generated-avatar-url.png'
WHERE id = 'YOUR_PERSONA_ID_HERE';
```

**Option C: Delete and Recreate**
```sql
-- Only if you want to start fresh
DELETE FROM ai_personas WHERE id = 'YOUR_PERSONA_ID_HERE';
-- Then create new persona via UI
```

## Common Issues and Solutions

### Issue: "Column does not exist"
**Symptom**: Error when creating persona: `column "gender" does not exist`
**Cause**: First migration not applied
**Solution**: Run Check 1, then apply migration 1

### Issue: "Bucket does not exist"
**Symptom**: Error when generating avatar: `bucket "persona-avatars" does not exist`
**Cause**: Storage migration not applied
**Solution**: Run Check 2, then apply migration 2

### Issue: Avatar generates but doesn't save
**Symptom**: Avatar shows during creation but not on persona card
**Cause**: Code not including avatar_url in payload (already fixed)
**Solution**:
1. Rebuild app: `npm run build`
2. Restart dev server: `npm run dev`
3. Try creating new persona

### Issue: Knowledge items not saving
**Symptom**: "Failed to create knowledge item" error
**Cause**: Multiple possible causes:
1. Persona ID not found (persona creation failed silently)
2. Knowledge table schema mismatch
3. Validation error in payload

**Debug Steps:**
```sql
-- Check if persona was created
SELECT id, name FROM ai_personas ORDER BY created_at DESC LIMIT 1;

-- Check knowledge table structure
\d ai_persona_knowledge

-- Try inserting knowledge manually
INSERT INTO ai_persona_knowledge (
  persona_id,
  user_id,
  type,
  title,
  content,
  embedding_status
) VALUES (
  'YOUR_PERSONA_ID',
  'YOUR_USER_ID',
  'text',
  'Test Knowledge',
  'This is test content',
  'pending'
);
```

## Post-Migration Testing

After confirming all checks pass:

1. **Test Avatar Generation**:
   - Create new persona
   - Complete Step 4 (Appearance)
   - Generate avatar
   - Verify it displays on persona card

2. **Test Text Knowledge**:
   - During persona creation (Step 6)
   - Add text knowledge item
   - Complete creation
   - Verify knowledge appears on detail page

3. **Test URL Extraction**:
   - After persona creation
   - Add URL knowledge
   - Trigger Jina extraction
   - Verify content extracted

4. **Test PDF Upload**:
   - After persona creation
   - Upload PDF file
   - Verify upload to storage
   - Verify Jina extraction

## Success Criteria

All of these should work without errors:

- ✅ Create persona with avatar generation
- ✅ Avatar saves to database (`avatar_url` populated)
- ✅ Avatar displays on persona list/detail pages
- ✅ Gender and appearance description save correctly
- ✅ Text knowledge saves during creation
- ✅ URL extraction works via Jina AI
- ✅ PDF upload and extraction works
- ✅ No console errors
- ✅ No "column does not exist" errors
- ✅ No "bucket does not exist" errors

## Need Help?

If you're still seeing errors after following this guide:

1. **Copy the exact error message** from:
   - Browser console (F12 → Console tab)
   - Network tab (F12 → Network → Failed request → Response)
   - Terminal where dev server is running

2. **Run all 3 verification queries** and share results

3. **Check recent persona record**:
```sql
SELECT * FROM ai_personas ORDER BY created_at DESC LIMIT 1;
```

4. **Check Supabase logs**:
   - Go to Supabase Dashboard
   - Logs & Reports
   - Look for recent errors
