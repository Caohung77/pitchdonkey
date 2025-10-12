-- Bulk swap first_name and last_name for all contacts from Coldreach import
-- Source: import:Coldreach_05102025.csv
-- This script swaps ALL contacts from this specific import

-- Step 1: Preview ALL contacts BEFORE swap
SELECT
  id,
  email,
  first_name as "current_first_name",
  last_name as "current_last_name",
  source,
  company,
  created_at
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY email;

-- Step 2: Count total contacts to be swapped
SELECT
  COUNT(*) as total_contacts_to_swap,
  source
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
GROUP BY source;

-- Step 3: Show sample of contacts that will be affected
SELECT
  id,
  email,
  first_name || ' ' || last_name as "current_full_name",
  last_name || ' ' || first_name as "will_become",
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
LIMIT 10;

-- Step 4: EXECUTE THE SWAP - Swaps first_name <-> last_name for ALL contacts
UPDATE contacts
SET
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 5: Verify ALL contacts AFTER swap
SELECT
  id,
  email,
  first_name as "new_first_name",
  last_name as "new_last_name",
  source,
  company,
  updated_at
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY email;

-- Step 6: Verify the specific contact mentioned (Alexandra Baldus)
SELECT
  id,
  email,
  first_name as "new_first_name",
  last_name as "new_last_name",
  source,
  company,
  updated_at
FROM contacts
WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1';

-- Step 7: Count verification - should match Step 2 count
SELECT
  COUNT(*) as total_contacts_swapped,
  source
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND updated_at > NOW() - INTERVAL '5 minutes'
GROUP BY source;
