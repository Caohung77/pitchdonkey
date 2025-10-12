-- Step 1: Find the source of the problematic contact
SELECT 
  id,
  email,
  first_name,
  last_name,
  source,
  created_at
FROM contacts
WHERE id = 'c7b53f98-efca-4737-99ed-f0671fd4bdf9';

-- Step 2: Check all contacts from the same source
-- Replace 'REPLACE_WITH_SOURCE_VALUE' with the actual source value from Step 1
SELECT 
  id,
  email,
  first_name,
  last_name,
  company,
  source
FROM contacts
WHERE source = 'REPLACE_WITH_SOURCE_VALUE'
ORDER BY created_at DESC
LIMIT 100;

-- Step 3: Count how many contacts will be affected
SELECT COUNT(*) as total_contacts_to_swap
FROM contacts
WHERE source = 'REPLACE_WITH_SOURCE_VALUE'
  AND first_name IS NOT NULL
  AND last_name IS NOT NULL;

-- Step 4: Perform the swap for all contacts from this source
-- IMPORTANT: Review Step 2 results before running this!
-- This will swap first_name and last_name for all contacts from the source

UPDATE contacts
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'REPLACE_WITH_SOURCE_VALUE'
  AND first_name IS NOT NULL
  AND last_name IS NOT NULL;

-- Step 5: Verify the fix
SELECT 
  id,
  email,
  first_name,
  last_name,
  company,
  source
FROM contacts
WHERE source = 'REPLACE_WITH_SOURCE_VALUE'
ORDER BY created_at DESC
LIMIT 20;
