-- Check contacts where first_name looks like a last name (all caps or starts with multiple capitals)
SELECT 
  id,
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE 
  first_name IS NOT NULL 
  AND last_name IS NOT NULL
  AND (
    -- First name is all uppercase (likely surname)
    first_name = UPPER(first_name)
    -- Or first name has multiple capital letters (compound surnames)
    OR first_name ~ '^[A-Z][a-z]+-[A-Z]'
  )
ORDER BY created_at DESC
LIMIT 20;
