-- Swap ALL 327 contacts from Coldreach_05102025.csv import
-- This will swap first_name <-> last_name for all contacts

-- Step 1: Verify we have 327 contacts
SELECT COUNT(*) as total_contacts
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 2: Preview first 50 contacts BEFORE swap
SELECT 
  id,
  email,
  first_name as "current_first_name",
  last_name as "current_last_name",
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY created_at
LIMIT 50;

-- Step 3: PERFORM THE SWAP for ALL 327 contacts
-- This swaps first_name <-> last_name (including NULL values)
UPDATE contacts
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 4: Verify swap was successful - check count
SELECT COUNT(*) as swapped_count
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 5: Preview first 50 contacts AFTER swap
SELECT 
  id,
  email,
  first_name as "new_first_name",
  last_name as "new_last_name",
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY created_at
LIMIT 50;

-- Step 6: Check specific examples
SELECT 
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND email IN (
    'claudia.polsterer@lukaslang.com',
    'einkauf@plastcontrol.de',
    'dieter.krause@saxas.biz'
  );
