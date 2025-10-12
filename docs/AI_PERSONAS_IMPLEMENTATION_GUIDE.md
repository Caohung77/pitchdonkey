# AI Personas Implementation Guide

## Overview
This document guides the transformation of "Outreach Agents" to "AI Personas" with personality customization, AI-generated headshots, and interactive chat capabilities.

## ✅ Completed Work

### 1. Database Migration (`supabase/migrations/20251012_transform_to_ai_personas.sql`)
- ✅ Renamed tables: `outreach_agents` → `ai_personas`
- ✅ Added personality columns: `personality_traits`, `persona_type`
- ✅ Added avatar columns: `avatar_url`, `avatar_prompt`, `avatar_generation_status`, `avatar_metadata`
- ✅ Added chat columns: `chat_enabled`, `chat_history`, `total_chats`, performance metrics
- ✅ Created `ai_persona_chat_sessions` table for persistent chat history
- ✅ Created `ai_persona_email_interactions` table for tracking email performance
- ✅ Updated all foreign key references
- ✅ Created necessary indexes

### 2. Core Libraries

#### `lib/imagen-generator.ts` ✅
- Professional headshot generation using Google Imagen 3
- Customizable avatar options (age, gender, ethnicity, attire)
- Personality-driven prompt generation
- Multiple variation generation
- NOTE: Requires actual Vertex AI Imagen API integration (placeholder currently)

#### `lib/persona-personality.ts` ✅
- Complete personality traits framework
- Default personality profiles for all persona types
- Personality-to-prompt conversion
- Trait validation and recommendations
- Communication style guidelines

#### `lib/persona-chat.ts` ✅
- Chat session management (create, load, end, delete)
- Real-time message exchange with personas
- Conversation history management (last 10 messages for context)
- Chat statistics tracking
- Personality-aware responses

#### `lib/ai-personas.ts` ✅
- Core persona CRUD operations
- Backward compatibility with outreach-agents
- Personality trait integration
- Avatar management hooks
- Type-safe persona handling

## 🚧 Remaining Work

### Phase 1: API Routes (HIGH PRIORITY)

#### 1. Create `/api/ai-personas/route.ts`
```typescript
// GET - List personas
// POST - Create persona
// Replace current /api/outreach-agents/route.ts
```

#### 2. Create `/api/ai-personas/[personaId]/route.ts`
```typescript
// GET - Get single persona
// PUT - Update persona
// DELETE - Delete persona
```

#### 3. Create `/api/ai-personas/[personaId]/generate-avatar/route.ts`
```typescript
// POST - Generate avatar using Imagen 3
// Body: { age, gender, ethnicity, attire, customPrompt }
// Returns: { imageUrl, prompt, status }
```

#### 4. Create `/api/ai-personas/[personaId]/chat/route.ts`
```typescript
// POST - Send chat message
// Body: { message, sessionId? }
// Returns: { response, messageId, sessionId }
// Consider WebSocket for real-time streaming
```

#### 5. Create `/api/ai-personas/[personaId]/personality/route.ts`
```typescript
// PUT - Update personality traits
// Body: { traits: Partial<PersonalityTraits> }
```

### Phase 2: UI Components (HIGH PRIORITY)

#### 1. `components/personas/PersonaCard.tsx`
```typescript
interface PersonaCardProps {
  persona: AIPersona
  onEdit: (persona: AIPersona) => void
  onDelete: (personaId: string) => void
  onChat: (personaId: string) => void
  onClick?: (persona: AIPersona) => void
}

// Features:
// - Avatar display with generation status indicator
// - Persona type badge
// - Personality trait pills
// - Quick actions (chat, edit, test, delete)
// - Stats: total chats, emails handled, satisfaction score
```

#### 2. `components/personas/AvatarGenerator.tsx`
```typescript
interface AvatarGeneratorProps {
  personaId: string
  personaType: string
  currentAvatarUrl?: string
  onGenerate: (options: AvatarGenerationOptions) => Promise<void>
}

// Features:
// - Avatar customization form (age, gender, ethnicity, attire)
// - Preset options by persona type
// - Custom prompt input
// - Generation progress indicator
// - Preview and regenerate
```

#### 3. `components/personas/PersonalityEditor.tsx`
```typescript
interface PersonalityEditorProps {
  traits: PersonalityTraits
  personaType: string
  onChange: (traits: Partial<PersonalityTraits>) => void
  showRecommendations?: boolean
}

// Features:
// - All trait controls (sliders, selects)
// - Recommended traits for persona type
// - Real-time preview of personality prompt
// - Trait compatibility warnings
```

#### 4. `components/personas/PersonaChatDialog.tsx`
```typescript
interface PersonaChatDialogProps {
  persona: AIPersona
  open: boolean
  onClose: () => void
}

// Features:
// - Full chat interface with message history
// - Real-time streaming (consider EventSource/WebSocket)
// - Message timestamps and metadata
// - Session management (new, continue, end)
// - Export chat history
// - Typing indicators
```

### Phase 3: Pages (MEDIUM PRIORITY)

#### 1. Update `src/app/dashboard/ai-personas/page.tsx`
Replace existing outreach-agents page with:
- Gallery view (grid of PersonaCards)
- Filters: status, persona type, chat enabled
- Search by name
- Create persona wizard button
- Bulk actions (activate, deactivate, delete)
- Quick stats dashboard

#### 2. Create `src/app/dashboard/ai-personas/[personaId]/chat/page.tsx`
Dedicated chat page with:
- Full-screen chat interface
- Session history sidebar
- Persona info panel
- Performance metrics
- Export options

#### 3. Refactor Persona Creation Wizard
Update the existing wizard to 6 steps:

**Step 1: Persona Identity**
- Name, type, basic info
- Avatar generation (integrated AvatarGenerator)
- Visual preview

**Step 2: Personality Configuration**
- PersonalityEditor component
- Trait selection with recommendations
- Preview personality prompt

**Step 3: Expertise & Knowledge**
- Existing knowledge base functionality
- Domain expertise selection
- Training data upload

**Step 4: Customer Segmentation**
- Existing segment configuration
- Target audience rules
- Quality weights

**Step 5: Testing & Preview**
- Email testing (existing)
- NEW: Chat testing (PersonaChatDialog)
- Side-by-side comparison

**Step 6: Deployment Settings**
- Activation settings
- Email account assignment
- Auto-reply rules
- Performance monitoring

### Phase 4: Integration Updates (MEDIUM PRIORITY)

#### Update All References
Search and replace across codebase:
- `outreach_agents` → `ai_personas` (table references)
- `outreach-agents` → `ai-personas` (API routes)
- Import paths: `./outreach-agents` → `./ai-personas`
- Component names: `OutreachAgent` → `AIPersona`

#### Key Files to Update:
```
lib/reply-processor.ts
lib/reply-job-processor.ts
lib/scheduled-replies.ts
lib/outreach-agent-compose.ts (rename to persona-compose.ts)
lib/outreach-agent-draft.ts (rename to persona-draft.ts)
components/email-accounts/AssignAgentDialog.tsx → AssignPersonaDialog.tsx
src/app/api/email-accounts/[id]/assign-agent/route.ts
src/app/dashboard/layout.tsx (navigation update)
```

### Phase 5: Google Imagen 3 Integration (LOW PRIORITY - Can use placeholder)

#### Option 1: Vertex AI Integration (Recommended)
```bash
npm install @google-cloud/aiplatform
```

Create `lib/vertex-ai-imagen.ts`:
```typescript
import { PredictionServiceClient } from '@google-cloud/aiplatform'

// Use Vertex AI Imagen 3 API
// Requires Google Cloud project and service account
```

#### Option 2: Use Placeholder Avatars
For MVP, use:
- Generated gradients with initials
- Stock professional photos
- Third-party avatar services (UI Avatars, DiceBear)

### Phase 6: Testing (HIGH PRIORITY)

#### Unit Tests
```typescript
// lib/__tests__/persona-personality.test.ts
// lib/__tests__/persona-chat.test.ts
// lib/__tests__/ai-personas.test.ts
```

#### Integration Tests
```typescript
// Test API routes
// Test persona CRUD operations
// Test chat functionality
// Test avatar generation workflow
```

#### E2E Tests
```typescript
// Test persona creation wizard
// Test chat interface
// Test email-persona integration
```

## 📋 Implementation Checklist

### Immediate Next Steps
1. ☐ Run database migration: `npx supabase db push`
2. ☐ Regenerate database types: `npm run update-types`
3. ☐ Create API routes (Phase 1)
4. ☐ Build UI components (Phase 2)
5. ☐ Update personas page (Phase 3)
6. ☐ Test basic CRUD operations
7. ☐ Test chat functionality
8. ☐ Update all references (Phase 4)
9. ☐ Deploy and test

### Environment Variables Required
```env
# Existing
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# New (for Vertex AI Imagen, optional)
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## 🎯 Success Criteria

### MVP Requirements
- [ ] Database migration successful
- [ ] All personas CRUD operations working
- [ ] Basic personality trait configuration
- [ ] Chat functionality operational (even if simple)
- [ ] Avatar placeholder system (can skip image generation initially)
- [ ] Email integration still works
- [ ] No breaking changes to existing features

### Full Feature Set
- [ ] Professional avatar generation working
- [ ] Advanced personality customization
- [ ] Real-time chat with streaming
- [ ] Chat history persistence
- [ ] Performance metrics tracking
- [ ] A/B testing personality variations
- [ ] Integration with email campaigns

## 🔍 Testing Plan

### Manual Testing
1. Create a new persona with custom personality
2. Generate avatar (or assign placeholder)
3. Test chat interaction
4. Send test email with persona
5. Verify personality applied correctly
6. Check performance metrics
7. Test persona duplication
8. Test persona deletion

### Automated Testing
```bash
npm run test -- persona-personality
npm run test -- persona-chat
npm run test -- ai-personas
npm run test -- api/ai-personas
```

## 📚 Documentation Updates

- [ ] Update CLAUDE.md with new persona system
- [ ] Create PERSONAS_USER_GUIDE.md
- [ ] Update API documentation
- [ ] Add personality trait reference
- [ ] Document avatar generation workflow
- [ ] Add chat integration guide

## 🚀 Deployment Steps

1. **Database Migration**
   ```bash
   # Test locally first
   npx supabase db reset
   npx supabase db push

   # Then production
   npx supabase db push --remote
   ```

2. **Deploy Code**
   ```bash
   git add .
   git commit -m "feat: transform to AI Personas system (v0.23.0)"
   git push origin main
   ```

3. **Verify**
   - Check all personas loaded
   - Test persona creation
   - Test chat
   - Verify email integration still works

## 💡 Tips & Best Practices

1. **Backward Compatibility**: Keep `lib/outreach-agents.ts` until all references updated
2. **Gradual Migration**: Users can continue using existing personas during transition
3. **Feature Flags**: Consider feature flags for chat and avatar generation
4. **Performance**: Monitor database query performance with new columns
5. **Caching**: Cache personality prompts and avatar URLs
6. **Rate Limiting**: Implement rate limits for avatar generation and chat

## 🐛 Common Issues & Solutions

### Issue: Migration Fails
```sql
-- Check existing table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'outreach_agents';

-- Manually rename if needed
ALTER TABLE outreach_agents RENAME TO ai_personas;
```

### Issue: Type Errors After Migration
```bash
# Regenerate types from new schema
npm run update-types
# or
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts
```

### Issue: Persona Not Found Errors
```typescript
// Update API clients
// Change: /api/outreach-agents/${id}
// To: /api/ai-personas/${id}
```

## 📞 Support

For issues or questions:
1. Check this implementation guide
2. Review database migration logs
3. Check API route implementations
4. Review component examples
5. Test with minimal persona configuration first

---

**Version**: v0.23.0
**Last Updated**: 2025-10-12
**Status**: 🚧 In Progress - Core infrastructure complete, UI implementation pending
