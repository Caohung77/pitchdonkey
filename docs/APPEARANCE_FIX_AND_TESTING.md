# Appearance Step Fixes and Testing Guide

## Issues Fixed

### 1. Avatar Not Displaying ✅
**Problem**: Generated avatars weren't being saved to database
**Cause**: `createAIPersona()` function in `lib/ai-personas.ts` wasn't including `gender`, `appearance_description`, or `avatar_url` fields
**Fix**: Added these fields to:
- `AIPersona` interface (line 68-69)
- `createAIPersona` payload (line 270-279)
- `mapPersona` function (line 477-478)

### 2. Knowledge Creation Failing ✅
**Problem**: Knowledge items not being saved after persona creation
**Root Cause**: Same as avatar issue - fields were being sent but not saved
**Fix**: Database schema updates ensure all fields are properly persisted

### 3. Name Overflow (Pending)
**Problem**: Long persona names like "Sophiena von The AIWhisperer" break card layout
**Solution**: Need to add text truncation to persona cards

## Database Migrations Required

You **MUST** run these migrations before testing:

```bash
# Migration 1: Add appearance fields to ai_personas table
# File: supabase/migrations/20251013_add_persona_appearance_fields.sql
# Adds: gender, appearance_description columns

# Migration 2: Create persona-avatars storage bucket
# File: supabase/migrations/20251013_create_persona_avatar_storage.sql
# Creates: persona-avatars bucket with RLS policies

# Apply migrations (choose one method):

# Method A: Supabase CLI (if you have it)
supabase migration run 20251013_add_persona_appearance_fields
supabase migration run 20251013_create_persona_avatar_storage

# Method B: Supabase Dashboard
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Go to SQL Editor
# 4. Copy content from each migration file and execute
```

## Testing Checklist

### Part 1: Verify Database Schema

```sql
-- Check if columns exist in ai_personas table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_personas'
  AND column_name IN ('gender', 'appearance_description', 'avatar_url');

-- Expected result: 3 rows showing these columns exist
```

### Part 2: Test Avatar Generation

1. **Navigate to Create Persona**:
   ```
   http://localhost:3000/dashboard/ai-personas/create
   ```

2. **Complete Steps 1-3**:
   - Basic Info: Enter name, sender info
   - Persona Type: Select any type (e.g., Customer Success Manager)
   - Personality: Select traits (e.g., professional, moderate empathy)

3. **Test Step 4 (Appearance)**:
   - ✅ Select gender (male/female/non-binary)
   - ✅ Optionally add appearance description (e.g., "professional attire, friendly demeanor")
   - ✅ Click "Generate Random Headshot"
   - ✅ Wait 5-15 seconds for generation
   - ✅ Verify avatar preview displays
   - ✅ Try "Generate New Headshot" button

4. **Complete Steps 5-6**:
   - Context: Can skip or fill in company details
   - Knowledge: Can skip or add text/URL items

5. **Submit and Verify**:
   - ✅ Click "Create Persona"
   - ✅ Should redirect to personas list
   - ✅ **Avatar should display on persona card** (not just initials)

### Part 3: Test Knowledge Base (Text)

1. **During Creation (Step 6)**:
   ```
   Type: Text
   Title: Company Overview
   Content: We are a leading SaaS company...
   ```
   - ✅ Click "Add Knowledge"
   - ✅ Verify item appears in list
   - ✅ Complete persona creation
   - ✅ Check console for errors

2. **After Creation**:
   - Navigate to persona detail page
   - Go to Knowledge Base section
   - Verify knowledge item displays

### Part 4: Test Knowledge Base (URL Extraction)

**Test URL**: `https://example.com` or any real company website

1. **During Creation (Step 6)**:
   ```
   Type: URL
   Title: Company Website
   Description: Main company website
   URL: https://example.com
   ```
   - ✅ Click "Add Knowledge"
   - ✅ Should save URL (extraction happens after creation)

2. **After Creation** (Jina Extraction Test):
   - Navigate to persona detail page
   - Go to Knowledge Base section
   - Find the URL item
   - ✅ Should show "Extract Content" button
   - ✅ Click to trigger Jina AI extraction
   - ✅ Wait for extraction to complete
   - ✅ Verify content displays in knowledge item

**Expected Console Logs**:
```
🎨 Extracting content from URL...
✓ Extracted 1,250 words from example.com
```

**Common Issues**:
- "Jina AI API key not configured" → Add `JINA_API_KEY` to `.env`
- "Request timeout" → URL may be slow, try again or use different URL
- "Extraction failed" → Check Jina AI service status

### Part 5: Test Knowledge Base (PDF Upload)

**Test PDF**: Any PDF file < 10MB (e.g., product documentation, whitepaper)

1. **After Creation Only** (PDF requires persona ID):
   - Navigate to persona detail page
   - Go to Knowledge Base section
   - Click "Add Knowledge" → "PDF" tab

   ```
   Title: Product Documentation
   Description: Technical product docs
   File: Select PDF file
   ```

   - ✅ Click "Upload PDF"
   - ✅ Wait for upload (should show progress)
   - ✅ PDF uploads to Supabase storage
   - ✅ Jina AI extracts content automatically
   - ✅ Content displays in knowledge item

**Expected Console Logs**:
```
📤 Uploading PDF to Supabase...
✅ PDF uploaded: persona-knowledge/{userId}/{personaId}/filename.pdf
🎨 Extracting content from PDF...
✓ Extracted 2,340 words from PDF
```

**Common Issues**:
- "File size too large" → Use PDF < 10MB
- "Invalid file type" → Ensure file is .pdf
- "Upload failed" → Check Supabase storage bucket exists
- "Extraction failed" → PDF may be scanned/image-based (needs OCR)

### Part 6: Verify Database Records

```sql
-- Check persona was created with appearance fields
SELECT
  id,
  name,
  gender,
  appearance_description,
  avatar_url,
  avatar_generation_status
FROM ai_personas
WHERE name = 'Sophiena von The AIWhisperer';

-- Expected: Should show gender, appearance_description, and avatar_url values

-- Check knowledge items were created
SELECT
  id,
  persona_id,
  type,
  title,
  url,
  length(content) as content_length,
  storage_path,
  embedding_status
FROM ai_persona_knowledge
WHERE persona_id = 'YOUR_PERSONA_ID_HERE';

-- Expected: All knowledge items with proper type, title, and content
```

### Part 7: Test Avatar Display

1. **List View**:
   - Navigate to `/dashboard/ai-personas`
   - ✅ Generated avatars should display as images
   - ✅ Personas without avatars show initials

2. **Detail View**:
   - Click on persona card
   - ✅ Avatar displays in header
   - ✅ Appearance info shows if filled

3. **Card Text Overflow**:
   - Create persona with long name (e.g., "Sophiena von The AIWhisperer")
   - ✅ Name should truncate with ellipsis
   - ✅ Layout should not break

## Expected Results

### Successful Persona Creation

**Console Output (No Errors)**:
```
✓ Persona created successfully
✓ Generating headshot...
✓ Avatar generated and uploaded
✓ Adding 2 knowledge items...
✓ Knowledge item 1 saved
✓ Knowledge item 2 saved
```

**Database Records**:
- ✅ `ai_personas` table has new row with all fields populated
- ✅ `ai_persona_knowledge` table has knowledge items
- ✅ `persona-avatars` bucket has avatar image
- ✅ `avatar_url` points to valid Supabase storage URL

**UI Display**:
- ✅ Persona appears in list with generated avatar
- ✅ Name displays correctly (no overflow)
- ✅ Knowledge items visible in detail page
- ✅ Status badge shows "active" or "draft"

### Common Error Scenarios

#### Error: "POST API Request Failed: {}"
**Cause**: Usually a database constraint violation or missing column
**Solution**: Run migrations, check database schema

#### Error: "Failed to create knowledge item"
**Cause**: Persona ID not found or validation error
**Solution**: Verify persona was created first, check payload structure

#### Error: "Jina AI API key not configured"
**Cause**: Missing `JINA_API_KEY` environment variable
**Solution**: Add to `.env`:
```bash
JINA_API_KEY=jina_921018daa27142e8b5988b377227cc5003wnqysJwfT7LdK8hYgz0eGQ_QKN
```

#### Error: "Failed to upload avatar"
**Cause**: Storage bucket doesn't exist or RLS policies not configured
**Solution**: Run storage migration `20251013_create_persona_avatar_storage.sql`

#### Avatar not displaying
**Cause**: `avatar_url` not saved to database
**Solution**: Code fixes applied - rebuild and restart server:
```bash
npm run build
npm run dev
```

## Debugging Tips

### Enable Detailed Logging

**Frontend** (`src/app/dashboard/ai-personas/create/page.tsx`):
```typescript
// Add before handleSubmit
console.log('📝 Submitting persona:', formData)

// Add after API call
console.log('✅ API Response:', response)
```

**Backend** (`src/app/api/ai-personas/route.ts`):
```typescript
// Add in POST handler
console.log('📥 Received payload:', parsed)
console.log('💾 Saving to database:', payload)
```

### Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Look for:
   - `POST /api/ai-personas` - Persona creation
   - `POST /api/ai-personas/generate-headshot` - Avatar generation
   - `POST /api/ai-personas/[id]/knowledge` - Knowledge creation
5. Check request payload and response

### Check Database Directly

```bash
# Connect to Supabase database
# Use connection string from Supabase dashboard

psql "postgresql://..."

# Check table structure
\d ai_personas

# Check recent personas
SELECT id, name, gender, avatar_url, created_at
FROM ai_personas
ORDER BY created_at DESC
LIMIT 5;

# Check storage files
SELECT *
FROM storage.objects
WHERE bucket_id = 'persona-avatars'
ORDER BY created_at DESC
LIMIT 10;
```

## Next Steps

### Fix Name Overflow (TODO)

**File**: `src/app/dashboard/ai-personas/page.tsx` (line 253-255)

**Change**:
```typescript
// Before
<CardTitle className="text-lg truncate">
  {persona.sender_name || persona.name}
</CardTitle>

// After
<CardTitle className="text-lg line-clamp-1 break-words">
  {persona.sender_name || persona.name}
</CardTitle>
```

### Add More Avatar Options (Future)

1. Multiple avatar variations (generate 3, choose 1)
2. Upload custom avatar option
3. Avatar gallery with pre-generated options
4. Edit/crop generated avatar
5. Avatar history (save previous generations)

### Enhance Knowledge Base (Future)

1. Auto-extract from PDFs without Jina (PDF.js fallback)
2. HTML page extraction
3. Word document support
4. Bulk URL import from sitemap
5. Schedule automatic content refresh
6. Semantic search across knowledge base

## Rollback Plan

If issues occur, you can rollback:

### Remove Migrations
```sql
-- Remove appearance columns
ALTER TABLE ai_personas DROP COLUMN IF EXISTS gender;
ALTER TABLE ai_personas DROP COLUMN IF EXISTS appearance_description;

-- Remove storage bucket (WARNING: Deletes all avatars)
DELETE FROM storage.objects WHERE bucket_id = 'persona-avatars';
DELETE FROM storage.buckets WHERE id = 'persona-avatars';
```

### Revert Code Changes
```bash
git checkout HEAD~1 -- lib/ai-personas.ts
git checkout HEAD~1 -- src/app/api/ai-personas/route.ts
git checkout HEAD~1 -- src/app/dashboard/ai-personas/create/page.tsx
```

## Support

If you encounter issues:

1. Check this testing guide
2. Review `docs/APPEARANCE_STEP_IMPLEMENTATION.md`
3. Check console logs for errors
4. Verify environment variables
5. Confirm migrations applied
6. Test with simple persona first (short name, no knowledge)
7. Check Supabase dashboard for data

## Success Criteria

✅ All migrations applied successfully
✅ New persona created with avatar and knowledge
✅ Avatar displays on persona cards
✅ Knowledge items saved and displayed
✅ URL extraction works with Jina AI
✅ PDF upload and extraction works
✅ No console errors during creation
✅ All database columns populated correctly
