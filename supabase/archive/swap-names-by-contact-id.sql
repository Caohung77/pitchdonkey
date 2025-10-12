-- Swap first_name and last_name for contact ID and all contacts with same source
-- Target Contact ID: 0a44e3ce-e90d-41f4-afa6-dcbf995a76e1

-- Step 1: Find the source of the target contact
SELECT
  id,
  email,
  first_name as "current_first_name",
  last_name as "current_last_name",
  source,
  company,
  created_at
FROM contacts
WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1';

-- Step 2: Preview ALL contacts with the same source BEFORE swap
-- (Run this after you see the source value from Step 1)
-- Replace 'YOUR_SOURCE_HERE' with the actual source value
SELECT
  id,
  email,
  first_name as "current_first_name",
  last_name as "current_last_name",
  source,
  company
FROM contacts
WHERE source = (
  SELECT source
  FROM contacts
  WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1'
)
ORDER BY email;

-- Step 3: Count total contacts to swap
SELECT
  COUNT(*) as total_contacts_to_swap,
  source
FROM contacts
WHERE source = (
  SELECT source
  FROM contacts
  WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1'
)
GROUP BY source;

-- Step 4: Perform the swap for ALL contacts from the same source
-- This swaps first_name <-> last_name (including NULL values)
UPDATE contacts
SET
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = (
  SELECT source
  FROM contacts
  WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1'
);

-- Step 5: Verify the swap - show all contacts AFTER swap
SELECT
  id,
  email,
  first_name as "new_first_name",
  last_name as "new_last_name",
  source,
  company
FROM contacts
WHERE source = (
  SELECT source
  FROM contacts
  WHERE id = '0a44e3ce-e90d-41f4-afa6-dcbf995a76e1'
)
ORDER BY email;

-- Step 6: Verify the specific target contact
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
