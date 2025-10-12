-- Find ALL contacts from Coldreach import (including those with null names)

-- Step 1: Count total contacts from this source
SELECT COUNT(*) as total_contacts
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- Step 2: Show all contacts (including those with null first_name or last_name)
SELECT 
  id,
  email,
  first_name,
  last_name,
  company,
  created_at
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY created_at DESC;

-- Step 3: Count contacts by name completeness
SELECT 
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 'Both names present'
    WHEN first_name IS NOT NULL AND last_name IS NULL THEN 'Only first name'
    WHEN first_name IS NULL AND last_name IS NOT NULL THEN 'Only last name'
    ELSE 'No names'
  END as name_status,
  COUNT(*) as count
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
GROUP BY name_status;

-- Step 4: Show contacts with missing names
SELECT 
  id,
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND (first_name IS NULL OR last_name IS NULL);
