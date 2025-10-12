-- Analyze Coldreach contacts to identify last names in first_name field

-- Check contacts where first_name might actually be last_name
-- German last names are usually capitalized and appear in email addresses
SELECT 
  id,
  email,
  first_name,
  last_name,
  company,
  -- Check if first_name appears in email (common pattern for last names)
  CASE 
    WHEN LOWER(first_name) = ANY(string_to_array(LOWER(email), '@.')) THEN 'Name in email'
    WHEN first_name = UPPER(SUBSTRING(first_name, 1, 1)) || LOWER(SUBSTRING(first_name, 2)) THEN 'Capitalized'
    ELSE 'Other'
  END as pattern
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND first_name IS NOT NULL
  AND last_name IS NULL
ORDER BY pattern, email;

-- Count by pattern
SELECT 
  CASE 
    WHEN email ILIKE '%' || LOWER(first_name) || '%' THEN 'Last name (in email)'
    WHEN LENGTH(first_name) > 2 AND first_name ~ '^[A-ZÄÖÜ][a-zäöüß]+$' THEN 'Likely last name'
    WHEN LENGTH(first_name) <= 2 THEN 'Abbreviation'
    ELSE 'Unclear'
  END as classification,
  COUNT(*) as count
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv'
  AND first_name IS NOT NULL
  AND last_name IS NULL
GROUP BY classification;
