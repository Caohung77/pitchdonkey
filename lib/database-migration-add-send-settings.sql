-- Migration: Add send_settings column to campaigns table
-- This migration adds the send_settings JSONB column to properly store batch size and rate limiting configuration

-- Add send_settings column to store rate limiting and batch configuration
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_settings JSONB DEFAULT '{}';

-- Update existing campaigns to have proper send_settings structure
-- Convert existing daily_send_limit to send_settings format
UPDATE campaigns
SET send_settings = jsonb_build_object(
  'rate_limiting', jsonb_build_object(
    'daily_limit', COALESCE(daily_send_limit, 50),
    'hourly_limit', 10,
    'domain_limit', 10,
    'account_rotation', true,
    'warmup_mode', false,
    'batch_size', COALESCE(daily_send_limit, 50),
    'batch_delay_minutes', 5
  ),
  'send_immediately', COALESCE(send_immediately, false),
  'avoid_weekends', true,
  'avoid_holidays', true,
  'holiday_list', '[]'::jsonb,
  'time_windows', '[]'::jsonb
)
WHERE send_settings IS NULL OR send_settings = '{}'::jsonb;

-- Add index for send_settings column for faster queries
CREATE INDEX IF NOT EXISTS idx_campaigns_send_settings ON campaigns USING GIN(send_settings);

-- Add comment for documentation
COMMENT ON COLUMN campaigns.send_settings IS 'JSONB object containing rate limiting, batch size, and scheduling settings for campaign sending';