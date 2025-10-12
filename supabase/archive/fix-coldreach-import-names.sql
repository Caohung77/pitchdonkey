-- Fix swapped names for Coldreach_05102025.csv import
-- Source: import:Coldreach_05102025.csv

-- Step 1: Preview contacts that will be swapped
SELECT 
  id,
  email,
  first_name,
  last_name,
  company,
  created_at
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND first_name IS NOT NULL
  AND last_name IS NOT NULL
ORDER BY created_at DESC;

-- Step 2: Count total contacts to be swapped
SELECT COUNT(*) as total_contacts_to_swap
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND first_name IS NOT NULL
  AND last_name IS NOT NULL;

-- Step 3: Perform the swap
-- This swaps first_name <-> last_name for all contacts from this import
UPDATE contacts
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'import:Coldreach_05102025.csv'
  AND first_name IS NOT NULL
  AND last_name IS NOT NULL;

-- Step 4: Verify the fix - check a few examples
SELECT 
  id,
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY created_at DESC
LIMIT 20;

-- Step 5: Verify the specific contact we started with
SELECT 
  id,
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE id = 'c7b53f98-efca-4737-99ed-f0671fd4bdf9';
