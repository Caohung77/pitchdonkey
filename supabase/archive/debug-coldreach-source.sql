-- Debug: Check all possible source values that might match

-- 1. Exact match with the source we're looking for
SELECT COUNT(*) as exact_match_count
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';

-- 2. Check all unique source values in the database
SELECT DISTINCT source, COUNT(*) as count
FROM contacts
WHERE source IS NOT NULL
GROUP BY source
ORDER BY count DESC;

-- 3. Check for similar source values (case-insensitive, partial match)
SELECT DISTINCT source, COUNT(*) as count
FROM contacts
WHERE source ILIKE '%coldreach%' OR source ILIKE '%05102025%'
GROUP BY source;

-- 4. Check contacts created around the same time as our target contact
SELECT 
  id,
  email,
  first_name,
  last_name,
  source,
  created_at
FROM contacts
WHERE created_at BETWEEN '2025-10-06 08:00:00' AND '2025-10-06 08:10:00'
ORDER BY created_at;

-- 5. Check if there are variations in the source field
SELECT 
  source,
  LENGTH(source) as source_length,
  COUNT(*) as count
FROM contacts
WHERE source LIKE 'import:%2025.csv'
GROUP BY source, LENGTH(source);
