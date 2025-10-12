-- Find the source of the contact with swapped names
SELECT 
  id,
  email,
  first_name,
  last_name,
  source,
  created_at,
  company
FROM contacts
WHERE id = 'c7b53f98-efca-4737-99ed-f0671fd4bdf9';

-- If source is found, check how many contacts from same source
-- (Run this after you see the source value from above query)
-- SELECT 
--   COUNT(*) as total_contacts,
--   source
-- FROM contacts
-- WHERE source = 'YOUR_SOURCE_HERE'
-- GROUP BY source;
