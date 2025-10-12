-- Step 1: Find the source of this contact
SELECT 
  id,
  email,
  first_name,
  last_name,
  source,
  created_at,
  company
FROM contacts
WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1';

-- Step 2: Count contacts from the same source
-- Replace 'REPLACE_WITH_SOURCE' with the source value from Step 1
SELECT COUNT(*) as total_contacts
FROM contacts
WHERE source = 'REPLACE_WITH_SOURCE';

-- Step 3: Swap ALL contacts from that source
UPDATE contacts
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'REPLACE_WITH_SOURCE';

-- Step 4: Verify the swap
SELECT 'Update completed' as status, COUNT(*) as total_swapped
FROM contacts
WHERE source = 'REPLACE_WITH_SOURCE';
