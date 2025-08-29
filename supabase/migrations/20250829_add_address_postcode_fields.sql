-- Migration: Add address and postcode fields to contacts table
-- Created: 2025-08-29
-- Description: Add address and postcode columns to support complete address information

-- Add address column
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS address TEXT NULL;

-- Add postcode column  
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS postcode TEXT NULL;

-- Add indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_contacts_address ON contacts(address);
CREATE INDEX IF NOT EXISTS idx_contacts_postcode ON contacts(postcode);

-- Add comments for documentation
COMMENT ON COLUMN contacts.address IS 'Street address or full address line';
COMMENT ON COLUMN contacts.postcode IS 'Postal code, ZIP code, or equivalent for the contact address';

-- Update the updated_at trigger to include new columns
-- This ensures that changes to address/postcode update the timestamp
-- Note: This assumes the trigger already exists and handles all columns