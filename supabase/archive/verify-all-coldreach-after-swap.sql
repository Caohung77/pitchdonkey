-- Comprehensive verification of all 327 contacts after swap

-- 1. Total count
SELECT COUNT(*) as total_contacts
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- 2. Show ALL contacts (use LIMIT to paginate if needed)
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

-- 3. Count by name status after swap
SELECT 
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 'Both names'
    WHEN first_name IS NOT NULL AND last_name IS NULL THEN 'Only first name'
    WHEN first_name IS NULL AND last_name IS NOT NULL THEN 'Only last name'
    ELSE 'No names'
  END as name_status,
  COUNT(*) as count
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
GROUP BY name_status;

-- 4. Sample 20 random contacts
SELECT 
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
ORDER BY RANDOM()
LIMIT 20;
