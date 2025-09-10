-- Migration: Add Individual LinkedIn Fields to Contacts Table
-- Date: 2024-12-10
-- Purpose: Extract LinkedIn data from JSON blob to individual queryable columns

-- Add individual LinkedIn fields to contacts table (with IF NOT EXISTS for safety)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS linkedin_first_name TEXT,
ADD COLUMN IF NOT EXISTS linkedin_last_name TEXT,
ADD COLUMN IF NOT EXISTS linkedin_headline TEXT,
ADD COLUMN IF NOT EXISTS linkedin_summary TEXT,
ADD COLUMN IF NOT EXISTS linkedin_about TEXT,
ADD COLUMN IF NOT EXISTS linkedin_current_company TEXT,
ADD COLUMN IF NOT EXISTS linkedin_current_position TEXT,
ADD COLUMN IF NOT EXISTS linkedin_industry TEXT,
ADD COLUMN IF NOT EXISTS linkedin_location TEXT,
ADD COLUMN IF NOT EXISTS linkedin_city TEXT,
ADD COLUMN IF NOT EXISTS linkedin_country TEXT,
ADD COLUMN IF NOT EXISTS linkedin_country_code TEXT,
ADD COLUMN IF NOT EXISTS linkedin_follower_count INTEGER,
ADD COLUMN IF NOT EXISTS linkedin_connection_count INTEGER,
ADD COLUMN IF NOT EXISTS linkedin_recommendations_count INTEGER,
ADD COLUMN IF NOT EXISTS linkedin_profile_completeness INTEGER,
ADD COLUMN IF NOT EXISTS linkedin_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_banner_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_experience JSONB,
ADD COLUMN IF NOT EXISTS linkedin_education JSONB,
ADD COLUMN IF NOT EXISTS linkedin_skills JSONB,
ADD COLUMN IF NOT EXISTS linkedin_languages JSONB,
ADD COLUMN IF NOT EXISTS linkedin_certifications JSONB,
ADD COLUMN IF NOT EXISTS linkedin_volunteer_experience JSONB,
ADD COLUMN IF NOT EXISTS linkedin_honors_awards JSONB,
ADD COLUMN IF NOT EXISTS linkedin_projects JSONB,
ADD COLUMN IF NOT EXISTS linkedin_courses JSONB,
ADD COLUMN IF NOT EXISTS linkedin_publications JSONB,
ADD COLUMN IF NOT EXISTS linkedin_patents JSONB,
ADD COLUMN IF NOT EXISTS linkedin_organizations JSONB,
ADD COLUMN IF NOT EXISTS linkedin_posts JSONB,
ADD COLUMN IF NOT EXISTS linkedin_activity JSONB,
ADD COLUMN IF NOT EXISTS linkedin_recommendations JSONB,
ADD COLUMN IF NOT EXISTS linkedin_people_also_viewed JSONB,
ADD COLUMN IF NOT EXISTS linkedin_contact_info JSONB,
ADD COLUMN IF NOT EXISTS linkedin_services JSONB;

-- Add indexes for commonly queried fields (with IF NOT EXISTS for safety)
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_current_company ON contacts (linkedin_current_company);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_industry ON contacts (linkedin_industry);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_location ON contacts (linkedin_location);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_follower_count ON contacts (linkedin_follower_count);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_connection_count ON contacts (linkedin_connection_count);

-- Add GIN indexes for JSONB fields for efficient searching (with IF NOT EXISTS for safety)
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_experience_gin ON contacts USING GIN (linkedin_experience);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_education_gin ON contacts USING GIN (linkedin_education);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_skills_gin ON contacts USING GIN (linkedin_skills);
CREATE INDEX IF NOT EXISTS idx_contacts_linkedin_activity_gin ON contacts USING GIN (linkedin_activity);

-- Create a function to migrate existing LinkedIn data from JSON blob to individual fields
CREATE OR REPLACE FUNCTION migrate_linkedin_profile_data()
RETURNS INTEGER AS $$
DECLARE
  contact_record RECORD;
  linkedin_data JSONB;
  updated_count INTEGER := 0;
BEGIN
  -- Loop through contacts that have LinkedIn profile data
  FOR contact_record IN 
    SELECT id, linkedin_profile_data 
    FROM contacts 
    WHERE linkedin_profile_data IS NOT NULL 
    AND linkedin_profile_data != 'null'::jsonb
  LOOP
    linkedin_data := contact_record.linkedin_profile_data;
    
    -- Update the contact with individual LinkedIn fields
    UPDATE contacts SET
      linkedin_first_name = COALESCE(linkedin_data->>'first_name', linkedin_data->>'name'),
      linkedin_last_name = linkedin_data->>'last_name',
      linkedin_headline = linkedin_data->>'headline',
      linkedin_summary = linkedin_data->>'summary',
      linkedin_about = linkedin_data->>'about',
      linkedin_current_company = CASE
        WHEN jsonb_typeof(linkedin_data->'current_company') = 'object' THEN linkedin_data->'current_company'->>'name'
        ELSE linkedin_data->>'current_company'
      END,
      linkedin_current_position = linkedin_data->>'position',
      linkedin_industry = linkedin_data->>'industry',
      linkedin_location = CASE
        WHEN linkedin_data->>'city' IS NOT NULL AND linkedin_data->>'country' IS NOT NULL 
        THEN CONCAT(linkedin_data->>'city', ', ', linkedin_data->>'country')
        WHEN linkedin_data->>'city' IS NOT NULL THEN linkedin_data->>'city'
        WHEN linkedin_data->>'country' IS NOT NULL THEN linkedin_data->>'country'
        ELSE NULL
      END,
      linkedin_city = linkedin_data->>'city',
      linkedin_country = linkedin_data->>'country',
      linkedin_country_code = linkedin_data->>'country_code',
      linkedin_follower_count = COALESCE(
        (linkedin_data->>'followers')::INTEGER,
        (linkedin_data->>'follower_count')::INTEGER
      ),
      linkedin_connection_count = COALESCE(
        (linkedin_data->>'connections')::INTEGER,
        (linkedin_data->>'connection_count')::INTEGER
      ),
      linkedin_recommendations_count = (linkedin_data->>'recommendations_count')::INTEGER,
      linkedin_profile_completeness = (linkedin_data->>'profile_completeness')::INTEGER,
      linkedin_avatar_url = COALESCE(linkedin_data->>'avatar', linkedin_data->>'avatar_url'),
      linkedin_banner_url = COALESCE(linkedin_data->>'banner_image', linkedin_data->>'banner_url'),
      linkedin_experience = linkedin_data->'experience',
      linkedin_education = linkedin_data->'education',
      linkedin_skills = linkedin_data->'skills',
      linkedin_languages = linkedin_data->'languages',
      linkedin_certifications = linkedin_data->'certifications',
      linkedin_volunteer_experience = linkedin_data->'volunteer_experience',
      linkedin_honors_awards = COALESCE(linkedin_data->'honors_and_awards', linkedin_data->'honors_awards'),
      linkedin_projects = linkedin_data->'projects',
      linkedin_courses = linkedin_data->'courses',
      linkedin_publications = linkedin_data->'publications',
      linkedin_patents = linkedin_data->'patents',
      linkedin_organizations = linkedin_data->'organizations',
      linkedin_posts = linkedin_data->'posts',
      linkedin_activity = linkedin_data->'activity',
      linkedin_recommendations = linkedin_data->'recommendations',
      linkedin_people_also_viewed = linkedin_data->'people_also_viewed',
      linkedin_contact_info = linkedin_data->'contact_info',
      linkedin_services = linkedin_data->'services'
    WHERE id = contact_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function to populate existing data
SELECT migrate_linkedin_profile_data() as migrated_contacts;

-- Drop the migration function (cleanup)
DROP FUNCTION migrate_linkedin_profile_data();

-- Add comments to document the new fields
COMMENT ON COLUMN contacts.linkedin_first_name IS 'LinkedIn profile first name';
COMMENT ON COLUMN contacts.linkedin_last_name IS 'LinkedIn profile last name';
COMMENT ON COLUMN contacts.linkedin_headline IS 'LinkedIn profile headline/professional title';
COMMENT ON COLUMN contacts.linkedin_summary IS 'LinkedIn profile summary section';
COMMENT ON COLUMN contacts.linkedin_about IS 'LinkedIn profile about/info section - critical for personalization';
COMMENT ON COLUMN contacts.linkedin_current_company IS 'Current company name from LinkedIn';
COMMENT ON COLUMN contacts.linkedin_current_position IS 'Current job position from LinkedIn';
COMMENT ON COLUMN contacts.linkedin_industry IS 'Industry classification from LinkedIn';
COMMENT ON COLUMN contacts.linkedin_location IS 'Combined location string (city, country)';
COMMENT ON COLUMN contacts.linkedin_city IS 'City from LinkedIn profile';
COMMENT ON COLUMN contacts.linkedin_country IS 'Country from LinkedIn profile';
COMMENT ON COLUMN contacts.linkedin_country_code IS 'Country code from LinkedIn profile';
COMMENT ON COLUMN contacts.linkedin_follower_count IS 'Number of LinkedIn followers';
COMMENT ON COLUMN contacts.linkedin_connection_count IS 'Number of LinkedIn connections';
COMMENT ON COLUMN contacts.linkedin_recommendations_count IS 'Number of LinkedIn recommendations';
COMMENT ON COLUMN contacts.linkedin_profile_completeness IS 'LinkedIn profile completeness score (0-100)';
COMMENT ON COLUMN contacts.linkedin_avatar_url IS 'LinkedIn profile picture URL';
COMMENT ON COLUMN contacts.linkedin_banner_url IS 'LinkedIn profile banner image URL';
COMMENT ON COLUMN contacts.linkedin_experience IS 'Work experience history from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_education IS 'Education history from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_skills IS 'Skills list from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_languages IS 'Languages from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_certifications IS 'Certifications from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_volunteer_experience IS 'Volunteer experience from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_honors_awards IS 'Honors and awards from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_projects IS 'Projects from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_courses IS 'Courses from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_publications IS 'Publications from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_patents IS 'Patents from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_organizations IS 'Organizations from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_posts IS 'Recent posts from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_activity IS 'Recent LinkedIn activity/interactions (JSONB array) - for personalization insights';
COMMENT ON COLUMN contacts.linkedin_recommendations IS 'Recommendations from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_people_also_viewed IS 'People also viewed section from LinkedIn (JSONB array)';
COMMENT ON COLUMN contacts.linkedin_contact_info IS 'Contact information from LinkedIn (JSONB object)';
COMMENT ON COLUMN contacts.linkedin_services IS 'Services/Serviceleistungen from LinkedIn (JSONB array) - important for German profiles';