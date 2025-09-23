-- Remove status column from contacts table
-- This migration removes the contact status functionality since we now have engagement status

-- First, let's check what values exist in the status column
-- SELECT DISTINCT status, COUNT(*) FROM contacts GROUP BY status;

-- Remove the status column
ALTER TABLE contacts DROP COLUMN IF EXISTS status;

-- Note: The engagement system now handles contact state through:
-- - engagement_status: 'not_contacted' | 'pending' | 'engaged' | 'bad'
-- - engagement_score: numeric score for prioritization
-- - engagement tracking counts for emails sent, opened, clicked, replied

-- If you need to recreate contact filtering based on engagement instead of status:
-- Active contacts: engagement_status IN ('not_contacted', 'pending', 'engaged')
-- Problem contacts: engagement_status = 'bad'
-- Engaged contacts: engagement_status = 'engaged'
-- New contacts: engagement_status = 'not_contacted'