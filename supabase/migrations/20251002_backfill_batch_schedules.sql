-- Backfill batch schedules for existing campaigns that don't have one
-- This migration creates batch schedules for campaigns created before v0.16.0

DO $$
DECLARE
  campaign_record RECORD;
  batch_size INT;
  total_contacts INT;
  total_batches INT;
  start_time TIMESTAMP;
  batch_interval_minutes INT := 20;
  batch_schedule JSONB;
  batches JSONB := '[]'::JSONB;
  batch_num INT;
  batch_time TIMESTAMP;
  contacts_remaining INT;
  batch_contact_count INT;
BEGIN
  -- Only process campaigns that are 'sending' or 'scheduled' and don't have batch_schedule
  FOR campaign_record IN
    SELECT id, total_contacts, daily_send_limit, scheduled_date, created_at, status
    FROM campaigns
    WHERE status IN ('sending', 'scheduled')
      AND batch_schedule IS NULL
      AND total_contacts > 0
  LOOP
    -- Determine batch size (default to daily_send_limit or 5)
    batch_size := COALESCE(campaign_record.daily_send_limit, 5);
    total_contacts := campaign_record.total_contacts;
    total_batches := CEIL(total_contacts::FLOAT / batch_size::FLOAT)::INT;

    -- Determine start time (use scheduled_date if exists, otherwise created_at)
    start_time := COALESCE(campaign_record.scheduled_date, campaign_record.created_at);

    -- Build batches array
    batches := '[]'::JSONB;
    contacts_remaining := total_contacts;

    FOR batch_num IN 1..total_batches LOOP
      batch_time := start_time + ((batch_num - 1) * batch_interval_minutes || ' minutes')::INTERVAL;
      batch_contact_count := LEAST(batch_size, contacts_remaining);

      batches := batches || jsonb_build_array(
        jsonb_build_object(
          'batch_number', batch_num,
          'scheduled_time', batch_time,
          'contact_ids', '[]'::JSONB,  -- Empty for backfill, will be populated on next send
          'contact_count', batch_contact_count,
          'status', CASE
            WHEN batch_num = 1 THEN 'sent'::TEXT  -- First batch already sent for 'sending' campaigns
            ELSE 'pending'::TEXT
          END
        )
      );

      contacts_remaining := contacts_remaining - batch_contact_count;
    END LOOP;

    -- Build complete batch_schedule object
    batch_schedule := jsonb_build_object(
      'batches', batches,
      'batch_size', batch_size,
      'batch_interval_minutes', batch_interval_minutes,
      'total_batches', total_batches,
      'total_contacts', total_contacts,
      'estimated_completion', (start_time + ((total_batches - 1) * batch_interval_minutes || ' minutes')::INTERVAL)::TEXT
    );

    -- Update campaign with batch schedule
    UPDATE campaigns
    SET
      batch_schedule = batch_schedule,
      next_batch_send_time = CASE
        WHEN status = 'sending' THEN (start_time + (batch_interval_minutes || ' minutes')::INTERVAL)::TIMESTAMP
        ELSE scheduled_date
      END,
      updated_at = NOW()
    WHERE id = campaign_record.id;

    RAISE NOTICE 'Backfilled batch schedule for campaign % (% batches)', campaign_record.id, total_batches;
  END LOOP;
END $$;
