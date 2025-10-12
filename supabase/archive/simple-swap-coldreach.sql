-- Simple swap: ALL contacts with source = 'import:Coldreach_05102025.csv'
-- No limits, no filters, just swap first_name <-> last_name for all 327 contacts

UPDATE contacts
SET 
  first_name = last_name,
  last_name = first_name,
  updated_at = NOW()
WHERE source = 'import:Coldreach_05102025.csv';

-- Check how many rows were updated
SELECT 'Update completed' as status, COUNT(*) as total_swapped
FROM contacts
WHERE source = 'import:Coldreach_05102025.csv';
