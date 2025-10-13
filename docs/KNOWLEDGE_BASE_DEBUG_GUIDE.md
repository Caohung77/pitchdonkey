# Knowledge Base Creation Debugging Guide

## Problem: "Failed to create knowledge item"

This error occurs when the persona is created successfully, but knowledge items fail to save afterward.

## Enhanced Logging

I've added detailed console logging to help debug. When you create a persona now, you'll see:

```
📝 Saving knowledge item: {type: 'text', title: 'Company Overview', content: '...', description: '...'}
✅ Knowledge item saved: {success: true, data: {...}}
```

Or if it fails:
```
❌ Error adding knowledge item: Error message here
Failed item: {type: 'text', title: 'Company Overview', ...}
```

## Debugging Steps

### Step 1: Check Browser Console

1. Open DevTools (F12)
2. Go to Console tab
3. Try creating a persona with 1 knowledge item
4. Look for the logs:
   - `📝 Saving knowledge item:` - Shows what's being sent
   - `✅ Knowledge item saved:` - Success response
   - `❌ Error adding knowledge item:` - Error details

**Share the exact error message with me!**

### Step 2: Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Create persona
5. Find the failed POST request to `/api/ai-personas/[id]/knowledge`
6. Click on it → Response tab
7. Copy the response

### Step 3: Verify Persona Was Created

```sql
-- Check if persona was created
SELECT id, name, created_at
FROM ai_personas
ORDER BY created_at DESC
LIMIT 1;

-- Try to manually create a knowledge item
INSERT INTO ai_persona_knowledge (
  persona_id,
  user_id,
  type,
  title,
  content,
  embedding_status
) VALUES (
  'YOUR_PERSONA_ID_FROM_ABOVE',
  'YOUR_USER_ID',
  'text',
  'Test Knowledge',
  'This is test content',
  'pending'
);
```

### Step 4: Check Knowledge Table Schema

```sql
-- Verify table structure
\d ai_persona_knowledge

-- Or
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_persona_knowledge'
ORDER BY ordinal_position;
```

## Common Causes & Fixes

### Cause 1: Missing `persona_id` Column Name

**Symptom**: Error says `column "persona_id" does not exist` or `column "agent_id" does not exist`

**Check**:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ai_persona_knowledge'
  AND column_name LIKE '%persona%' OR column_name LIKE '%agent%';
```

**Fix**: The migration might not have renamed `agent_id` to `persona_id`. Run:
```sql
ALTER TABLE ai_persona_knowledge
RENAME COLUMN agent_id TO persona_id;
```

### Cause 2: Validation Error

**Symptom**: "Validation error" in response

**Possible Issues**:
- `type` field doesn't match enum ('text', 'link', 'pdf', 'doc', 'html')
- Missing required fields (title, type)
- Invalid data types

**Debug Payload**:
```javascript
// Check what's being sent
console.log('📝 Saving knowledge item:', item)
// Should look like:
{
  type: 'text' | 'link',
  title: 'Some title',
  description: 'Optional description',
  content: 'For text type',  // only for type='text'
  url: 'https://...'         // only for type='link'
}
```

### Cause 3: Authentication Issue

**Symptom**: 401 Unauthorized or "User not found"

**Check**:
```sql
-- Verify user exists
SELECT id, email FROM users LIMIT 5;

-- Check if persona belongs to user
SELECT p.id, p.name, p.user_id, u.email
FROM ai_personas p
JOIN users u ON p.user_id = u.id
ORDER BY p.created_at DESC
LIMIT 5;
```

### Cause 4: Foreign Key Constraint

**Symptom**: Error about foreign key constraint violation

**Possible Issues**:
- `persona_id` doesn't exist (persona creation failed silently)
- `user_id` doesn't match

**Check**:
```sql
-- Verify persona exists with correct user_id
SELECT id, user_id, name
FROM ai_personas
WHERE id = 'YOUR_PERSONA_ID';

-- Check foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'ai_persona_knowledge'
  AND tc.constraint_type = 'FOREIGN KEY';
```

## Test Knowledge Creation Directly

### Test via SQL

```sql
-- Get a valid persona_id and user_id
SELECT p.id as persona_id, p.user_id, p.name
FROM ai_personas p
ORDER BY created_at DESC
LIMIT 1;

-- Try to insert knowledge
INSERT INTO ai_persona_knowledge (
  persona_id,
  user_id,
  type,
  title,
  description,
  content,
  embedding_status,
  embedding_metadata
) VALUES (
  'PERSONA_ID_FROM_ABOVE',
  'USER_ID_FROM_ABOVE',
  'text',
  'Test Knowledge Item',
  'This is a test',
  'Test content for debugging',
  'pending',
  '{}'::jsonb
) RETURNING *;
```

If this works, the issue is in the API endpoint, not the database.

### Test via API (Using curl)

```bash
# Replace with your values
PERSONA_ID="your-persona-id"
AUTH_TOKEN="your-auth-token"

curl -X POST "http://localhost:3000/api/ai-personas/${PERSONA_ID}/knowledge" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "type": "text",
    "title": "Test Knowledge",
    "description": "Test description",
    "content": "Test content"
  }'
```

## Detailed API Endpoint Check

Let me verify the knowledge creation endpoint:

**File**: `src/app/api/ai-personas/[personaId]/knowledge/route.ts`

**Expected behavior**:
1. Receives POST request with knowledge data
2. Validates user owns the persona
3. Validates payload with Zod schema
4. Inserts into `ai_persona_knowledge` table
5. Updates persona's `knowledge_summary`
6. Returns success response

**Common endpoint issues**:
- `params.personaId` is undefined (routing issue)
- User authentication fails
- Zod validation fails on payload structure
- Database insert fails

## Quick Fix: Skip Knowledge During Creation

If you need to create personas urgently while we debug:

1. **Skip Step 6**: Don't add knowledge items during creation
2. **Add knowledge after**: Go to persona detail page and add knowledge there

This isolates the issue to just the knowledge creation endpoint.

## What to Share With Me

To help fix this, please share:

1. **Console logs** showing:
   ```
   📝 Saving knowledge item: {...}
   ❌ Error adding knowledge item: [THE ACTUAL ERROR]
   ```

2. **Network tab** response from the failed request

3. **Database check** results:
   ```sql
   -- Does persona exist?
   SELECT id, name, user_id FROM ai_personas
   ORDER BY created_at DESC LIMIT 1;

   -- Can we manually insert knowledge?
   -- (Try the INSERT query from above)
   ```

4. **Any other error messages** from terminal/console

## Temporary Workaround

While debugging, you can:

1. Create persona WITHOUT knowledge items (skip Step 6)
2. After creation, go to persona detail page
3. Use "Add Knowledge" button there
4. If that works, the issue is specifically in the creation flow
5. If that also fails, the issue is in the knowledge endpoint itself

This helps narrow down where the problem is!
