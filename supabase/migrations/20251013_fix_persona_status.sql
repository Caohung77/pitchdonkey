-- Fix AI Persona Status
-- Date: 2025-10-13
-- Purpose: Set all personas to inactive since they are not assigned to email accounts yet

-- Update all personas to inactive
-- Since the email account assignment system is not yet implemented,
-- all personas should be inactive by default
UPDATE ai_personas
SET status = 'inactive',
    updated_at = NOW()
WHERE status IN ('active', 'draft');

-- Add comment explaining status system
COMMENT ON COLUMN ai_personas.status IS
'Persona status: inactive (default, not assigned), active (assigned to email account), draft (legacy)';
