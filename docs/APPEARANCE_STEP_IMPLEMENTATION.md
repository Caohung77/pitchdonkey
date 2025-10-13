# AI Persona Appearance Step Implementation

## Overview

Successfully implemented a new "Appearance" step in the AI Persona creation wizard that allows users to customize their persona's visual appearance and generate professional headshots using Google's Imagen API.

## Implementation Summary

### 1. Persona Creation Wizard Enhancement

**File**: `src/app/dashboard/ai-personas/create/page.tsx`

**Changes**:
- **Updated STEPS array**: Added new step 4 "Appearance" with Camera icon between Personality (step 3) and Context (step 5)
- **Form State**: Added appearance-related fields to formData:
  - `gender`: 'male' | 'female' | 'non-binary' | ''
  - `appearance_description`: Custom text description
  - `avatar_url`: Generated avatar URL
- **State Management**: Added `generatingAvatar` and `generatedAvatarUrl` for UI state
- **Handler Function**: `handleGenerateRandomAvatar()` builds dynamic prompts and calls API

**Step 4 UI Components**:
- Gender selector (Select dropdown with 3 options)
- Appearance description textarea (optional custom details)
- Generate Random Headshot button (disabled until gender selected)
- Avatar preview with re-generate option
- Loading states with spinner during generation

### 2. API Endpoint

**File**: `src/app/api/ai-personas/generate-headshot/route.ts` (NEW)

**Functionality**:
- Accepts `prompt`, `gender`, and `personaType` via POST
- Uses existing `lib/imagen-generator.ts` library
- Generates professional headshot using Google Imagen API
- Uploads image to Supabase `persona-avatars` storage bucket
- Returns public avatar URL to frontend

**Authentication**: Uses `withAuth` middleware from `@/lib/auth-middleware`

**Response Format**:
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://...",
    "storage_path": "avatars/{userId}/{personaId}-{timestamp}.png",
    "prompt": "Professional corporate headshot..."
  }
}
```

### 3. Database Schema Updates

**Migration**: `supabase/migrations/20251013_add_persona_appearance_fields.sql` (NEW)

**Changes to `ai_personas` table**:
- Added `gender` column: VARCHAR(20) with CHECK constraint (male, female, non-binary)
- Added `appearance_description` column: TEXT
- Existing `avatar_url` column already present from previous migration

### 4. Storage Configuration

**Migration**: `supabase/migrations/20251013_create_persona_avatar_storage.sql` (NEW)

**Created `persona-avatars` bucket**:
- Public bucket for avatar images
- Row Level Security (RLS) policies:
  - Users can upload/read/update/delete only their own avatars
  - Public read access for displaying avatars in UI
- Storage path structure: `avatars/{userId}/{personaId}-{timestamp}.png`

### 5. API Schema Validation

**File**: `src/app/api/ai-personas/route.ts`

**Updated `personaCreateSchema`**:
- Added `gender` field: z.enum(['male', 'female', 'non-binary']).optional()
- Added `appearance_description` field: z.string().optional()
- Added `avatar_url` field: z.string().optional()

### 6. Appearance Prompt Generation

**Logic in `handleGenerateRandomAvatar()`**:

```typescript
const personalityDesc = `${formData.personality_traits.communication_style} ${formData.personality_traits.formality}`
const roleDesc = formData.sender_role || formData.custom_persona_name || 'professional'
const genderDesc = formData.gender || 'person'
const appearanceDesc = formData.appearance_description || ''

const prompt = `Professional corporate headshot of a ${genderDesc}, ${roleDesc}, ${personalityDesc} personality, ${appearanceDesc || 'business attire'}, neutral background, high quality, realistic`
```

**Dynamic Elements**:
- Gender from user selection
- Role from previous steps (Basic Info or Custom Persona)
- Personality traits from Step 3
- Custom appearance description from user input

## User Flow

1. **Step 1-3**: User completes Basic Info, Persona Type, and Personality steps
2. **Step 4 (NEW)**: Appearance customization
   - Select gender (required for avatar generation)
   - Optionally provide appearance description
   - Click "Generate Random Headshot"
   - System builds dynamic prompt from previous steps
   - Imagen API generates professional headshot
   - Image uploads to Supabase storage
   - Preview displays with re-generate option
3. **Step 5-6**: Complete Context and Knowledge steps
4. **Submit**: Persona created with avatar_url, gender, and appearance_description

## Technical Architecture

### Frontend (React)
- Multi-step wizard with state management
- Real-time UI updates during avatar generation
- Error handling with user-friendly messages
- Optimistic UI with loading states

### Backend (API Routes)
- Next.js API routes with authentication middleware
- Zod schema validation
- Google Imagen API integration
- Supabase storage management

### Database
- PostgreSQL with Supabase
- New columns for appearance data
- Public storage bucket with RLS policies

### AI Integration
- Google Imagen 3 API for image generation
- Dynamic prompt construction
- Professional corporate headshot style
- Base64 to blob conversion and upload

## Dependencies

### Required Environment Variables
```bash
GOOGLE_GEMINI_API_KEY=your_google_ai_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Existing Libraries Used
- `lib/imagen-generator.ts`: Avatar generation and upload utilities
- `lib/auth-middleware.ts`: Authentication and security
- `lib/api-client.ts`: Frontend API communication
- `@/components/ui/*`: Radix UI components

## File Changes Summary

### Created Files (4)
1. `src/app/api/ai-personas/generate-headshot/route.ts` - API endpoint
2. `supabase/migrations/20251013_add_persona_appearance_fields.sql` - Database schema
3. `supabase/migrations/20251013_create_persona_avatar_storage.sql` - Storage bucket
4. `docs/APPEARANCE_STEP_IMPLEMENTATION.md` - This documentation

### Modified Files (2)
1. `src/app/dashboard/ai-personas/create/page.tsx` - Wizard enhancement
2. `src/app/api/ai-personas/route.ts` - Schema validation update

## Testing Checklist

### Manual Testing
- [ ] Navigate to AI Personas → Create New Persona
- [ ] Complete steps 1-3 (Basic Info, Persona Type, Personality)
- [ ] Verify Step 4 "Appearance" displays correctly
- [ ] Test gender selector (male, female, non-binary)
- [ ] Verify "Generate" button disabled until gender selected
- [ ] Test appearance description (optional field)
- [ ] Click "Generate Random Headshot"
- [ ] Verify loading state shows spinner
- [ ] Confirm avatar generates and displays in preview
- [ ] Test "Generate New Headshot" button
- [ ] Complete steps 5-6 and submit
- [ ] Verify persona created with avatar_url in database

### Error Scenarios
- [ ] Missing GOOGLE_GEMINI_API_KEY → User-friendly error message
- [ ] Network timeout during generation → Retry option
- [ ] Invalid gender value → Validation error
- [ ] Supabase storage failure → Fallback behavior

### Database Verification
```sql
-- Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_personas'
  AND column_name IN ('gender', 'appearance_description', 'avatar_url');

-- Verify storage bucket
SELECT id, name, public FROM storage.buckets WHERE id = 'persona-avatars';

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```

## Performance Considerations

- **Avatar Generation**: 5-15 seconds per request (Imagen API latency)
- **Storage Upload**: <2 seconds for typical images
- **Total Step 4 Time**: ~7-17 seconds for complete generation
- **Image Size**: ~200-500KB per avatar (PNG format)
- **Storage Cost**: Minimal (Supabase free tier includes 1GB)

## Security Measures

- **Authentication**: All API routes protected with `withAuth` middleware
- **RLS Policies**: Users can only access their own avatars
- **Input Validation**: Zod schemas prevent invalid data
- **Rate Limiting**: Inherited from auth middleware
- **Public Storage**: Read-only public access for avatar display
- **API Key Security**: Google API key never exposed to client

## Future Enhancements

1. **Multiple Avatar Options**: Generate 3 variations, let user choose
2. **Avatar Editing**: Crop, resize, or adjust generated images
3. **Upload Custom Avatar**: Alternative to AI generation
4. **Avatar Gallery**: Pre-generated avatars for quick selection
5. **Advanced Customization**: Age, ethnicity, attire options
6. **Avatar History**: Save and reuse previous generations
7. **Batch Generation**: Generate avatars for multiple personas
8. **Style Presets**: Business formal, casual, creative styles

## Troubleshooting

### "Imagen API error"
- Verify `GOOGLE_GEMINI_API_KEY` is set correctly
- Check API quota at https://aistudio.google.com/apikey
- Ensure API key has Imagen access enabled

### "Failed to upload avatar"
- Run storage migration: `supabase migration run 20251013_create_persona_avatar_storage`
- Verify Supabase credentials are correct
- Check storage bucket exists in Supabase dashboard

### "Avatar not displaying"
- Verify avatar URL is publicly accessible
- Check RLS policies allow public read access
- Confirm `persona-avatars` bucket is marked as public

### "Build errors"
- Import `withAuth` from `@/lib/auth-middleware`, not `@/lib/auth`
- Ensure all new dependencies are installed
- Run `npm run build` to verify TypeScript compilation

## Version History

- **v0.24.0** (2025-10-13): Initial implementation of Appearance step
  - Added Step 4 to persona creation wizard
  - Integrated Google Imagen API for avatar generation
  - Created database schema and storage infrastructure
  - Updated API validation schemas

## References

- Google Imagen API: https://ai.google.dev/gemini-api/docs/imagen
- Supabase Storage: https://supabase.com/docs/guides/storage
- Next.js API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Radix UI Components: https://www.radix-ui.com/
