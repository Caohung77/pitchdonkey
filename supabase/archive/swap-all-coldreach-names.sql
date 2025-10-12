-- Swap ALL first_name and last_name for Coldreach import
-- This will swap the fields regardless of whether they are NULL or not

-- Step 1: Preview ALL contacts before swap
SELECT 
  id,
  email,
  first_name as "current_first_name",
  last_name as "current_last_name",
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY email;

-- Step 2: Count total contacts to swap
SELECT COUNT(*) as total_contacts_to_swap
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 3: Perform the swap for ALL contacts from this source
-- Swaps first_name <-> last_name (including NULL values)
UPDATE contacts
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 4: Verify the swap - show all contacts after swap
SELECT 
  id,
  email,
  first_name as "new_first_name",
  last_name as "new_last_name",
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY email;

-- Step 5: Verify the specific contact we started with
SELECT 
  id,
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE id = 'c7b53f98-efca-4737-99ed-f0671fd4bdf9';
