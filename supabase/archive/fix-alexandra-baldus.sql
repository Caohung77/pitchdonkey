-- Fix Alexandra Baldus name order
-- Current: first_name="Baldus", last_name="Alexandra"
-- Fixed: first_name="Alexandra", last_name="Baldus"

UPDATE contacts 
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE email = 'a.baldus@alwitra.de'
  AND first_name = 'Baldus'
  AND last_name = 'Alexandra';

-- Verify the fix
SELECT 
  email,
  first_name,
  last_name,
  company
FROM contacts
WHERE email = 'a.baldus@alwitra.de';
