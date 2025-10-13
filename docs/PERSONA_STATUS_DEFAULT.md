# AI Persona Status System

**Version:** v0.25.5
**Date:** 2025-10-13
**Status:** ✅ IMPLEMENTED

## Status System Overview

AI Personas have three possible statuses:
- **`inactive`** - Default state, persona is not being used
- **`draft`** - Legacy state for incomplete personas (now treated same as inactive)
- **`active`** - Persona is assigned to an active email account and in use

## Status Workflow

```
┌─────────────────────────────────────────────────────────┐
│  NEW PERSONA CREATED                                    │
│  Default Status: "inactive"                             │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  INACTIVE STATE                                         │
│  - Persona exists but not in use                        │
│  - Can be edited and configured                         │
│  - Not handling any emails                              │
│  - Red badge displayed                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ User assigns to email account
                   │ in Email Account Settings
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  ACTIVE STATE                                           │
│  - Assigned to one or more email accounts              │
│  - Handling emails and responses                        │
│  - Generating AI responses                              │
│  - Green badge + green indicator dot                    │
└─────────────────────────────────────────────────────────┘
```

## Activation Process

Personas are activated through the **Email Account Settings**:

1. Go to Email Accounts page
2. Select an email account
3. Open settings/configuration
4. Assign an AI persona to handle that account
5. Persona status automatically changes to `active`

When persona is removed from all email accounts:
- Status automatically returns to `inactive`
- Persona configuration is preserved
- Can be re-activated anytime

## Default Status Change

### Previous Behavior (Incorrect):
```typescript
status: input.status || 'draft'  // ❌ Wrong default
```
- All new personas created as `'draft'`
- Showed gray badge even though they weren't drafts
- Confusing status naming

### New Behavior (Correct):
```typescript
status: input.status || 'inactive'  // ✅ Correct default
```
- All new personas created as `'inactive'`
- Shows red badge until activated
- Clear status meaning

## Status Display

### Visual Indicators

**Inactive Personas:**
- Badge: Red background (`bg-red-100 text-red-800 border-red-200`)
- No status dot on avatar
- Badge text: "inactive"

**Draft Personas** (legacy, treated as inactive):
- Badge: Gray background (`bg-gray-100 text-gray-800 border-gray-200`)
- No status dot on avatar
- Badge text: "draft"

**Active Personas:**
- Badge: Green background (`bg-green-100 text-green-800 border-green-200`)
- Green status dot on avatar (8px circle, `bg-green-500`)
- Badge text: "active"

### Flip Card Display

**Front Side:**
- Status badge in top-right corner
- Green dot on avatar (only if active)

**Back Side:**
- Status badge in header next to name
- Shows current status from database

## Code Implementation

### File: `lib/ai-personas.ts`

**Line 238 - Create Function:**
```typescript
const payload: any = {
  user_id: userId,
  name: input.name,
  status: input.status || 'inactive',  // ✅ Default to inactive
  // ...
}
```

**Line 418 - Duplicate Function:**
```typescript
const cloned = await createAIPersona(supabase, userId, {
  name: `${original.name} Copy`,
  status: 'inactive',  // ✅ Duplicates are also inactive
  persona_type: original.persona_type,
  // ...
})
```

## Future Features (Postponed)

### Chat Feature
- Currently `chat_enabled` is set to `true` by default
- Chat functionality not yet implemented
- Will be built in future version
- When implemented:
  - Users can enable/disable chat per persona
  - Personas can handle both emails and chat
  - Separate chat history tracking

### Persona-Email Account Integration
- Relationship table: `email_account_personas` (to be created)
- Links email accounts to active personas
- Automatic status management
- Multiple personas can be active on different accounts

## Database Schema

### Current Schema:
```sql
CREATE TABLE ai_personas (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'inactive')),
  -- ... other fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Future Schema (Persona-Email Link):
```sql
-- To be created
CREATE TABLE email_account_personas (
  id UUID PRIMARY KEY,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES ai_personas(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_account_id, persona_id)
);

-- Trigger to auto-update persona status
CREATE OR REPLACE FUNCTION update_persona_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark persona as active if assigned to any email account
  UPDATE ai_personas
  SET status = 'active'
  WHERE id = NEW.persona_id
    AND status = 'inactive';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Testing Scenarios

### Scenario 1: Create New Persona
1. User creates new persona
2. **Expected:** Status = `'inactive'`
3. **Expected:** Red badge displayed
4. **Expected:** No green dot on avatar

### Scenario 2: Duplicate Existing Persona
1. User duplicates any persona (active or inactive)
2. **Expected:** New persona has status = `'inactive'`
3. **Expected:** Red badge displayed
4. **Expected:** Original persona status unchanged

### Scenario 3: Activate Persona (Future)
1. User goes to Email Account Settings
2. User assigns persona to email account
3. **Expected:** Status changes to `'active'`
4. **Expected:** Green badge displayed
5. **Expected:** Green dot appears on avatar

### Scenario 4: Deactivate Persona (Future)
1. User removes persona from all email accounts
2. **Expected:** Status changes to `'inactive'`
3. **Expected:** Red badge displayed
4. **Expected:** Green dot removed from avatar

## Existing Personas

### Updating Existing Data
If you have existing personas with `'draft'` status that should be `'inactive'`:

```sql
-- Update all draft personas to inactive
UPDATE ai_personas
SET status = 'inactive'
WHERE status = 'draft';

-- Or update specific persona
UPDATE ai_personas
SET status = 'inactive'
WHERE id = 'your-persona-id';
```

## Build Status

✅ Build succeeded
✅ Default status changed to `'inactive'`
✅ All functions updated

## Files Modified

1. **`lib/ai-personas.ts`**
   - Line 238: Changed default status from `'draft'` to `'inactive'`
   - Line 418: Changed duplicate status from `'draft'` to `'inactive'`

## Related Documentation

- `docs/PERSONA_FLIP_CARD_DESIGN.md` - Original flip card design
- `docs/PERSONA_FLIP_CARD_REDESIGN.md` - Latest UI improvements
- `docs/PERSONA_API_PARAMS_FIX.md` - API routes fix

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
**Status:** ✅ Production Ready
**Next Steps:** Implement email account-persona assignment system
