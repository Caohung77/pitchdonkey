-- CORRECT bulk swap first_name and last_name for all contacts from Coldreach import
-- Source: import:Coldreach_05102025.csv
-- This uses a proper swap technique with a temporary column

-- Step 1: Preview current state (WRONG state after failed swap)
SELECT
  id,
  email,
  first_name as "current_first_name",
  last_name as "current_last_name",
  source,
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY email
LIMIT 20;

-- Step 2: Count total contacts to be swapped
SELECT
  COUNT(*) as total_contacts_to_swap
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 3: CORRECT SWAP using PostgreSQL's ROW constructor
-- This properly swaps the values without overwriting
UPDATE contacts
SET
  (first_name, last_name) = (last_name, first_name),
  updated_at = NOW()
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 4: Verify ALL contacts AFTER correct swap
SELECT
  id,
  email,
  first_name as "corrected_first_name",
  last_name as "corrected_last_name",
  source,
  company,
  updated_at
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY email
LIMIT 20;

-- Step 5: Verify specific examples by email pattern
SELECT
  id,
  email,
  first_name || ' ' || last_name as "full_name",
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND email LIKE 'klaus.neuwald%'
ORDER BY email;

-- Step 6: Verify Alexandra Baldus specifically
SELECT
  id,
  email,
  first_name,
  last_name,
  first_name || ' ' || last_name as "full_name",
  updated_at
FROM contacts
WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1';

-- Step 7: Count verification
SELECT
  COUNT(*) as total_contacts_swapped,
  source
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND updated_at > NOW() - INTERVAL '5 minutes'
GROUP BY source;
