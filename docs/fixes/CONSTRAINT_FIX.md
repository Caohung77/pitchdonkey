# 🚨 DATABASE CONSTRAINT FIX REQUIRED

## The Issue
The campaign creation is failing because the database constraint `campaigns_status_check` doesn't allow the `'sending'` status value.

**Error:** `new row for relation "campaigns" violates check constraint "campaigns_status_check"`

## Quick Fix - Run this SQL in Supabase Dashboard:

```sql
-- Drop the existing constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

-- Add the updated constraint with 'sending' and 'scheduled' statuses
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check CHECK (
    status IN ('draft', 'active', 'paused', 'completed', 'archived', 'sending', 'scheduled')
);
```

## What This Does:
- ✅ Allows `'sending'` status (for "Send Now")  
- ✅ Allows `'scheduled'` status (for "Schedule for Later")
- ✅ Keeps all existing status values

## Steps:
1. Go to **Supabase Dashboard** → **SQL Editor**
2. **Copy and paste** the SQL above
3. **Click Run**
4. **Test your campaign creation** - it should work now!

This is a simple constraint update and is completely safe.