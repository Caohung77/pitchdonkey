-- ============================================
-- DIAGNOSTIC QUERIES FOR AUTO-REPLY SYSTEM
-- Run these in Supabase SQL Editor
-- ============================================

-- 1. CHECK: Are the emails from your screenshot in the database?
-- Look for emails from "Cao Hung Nguyen" and "postmaster@profluss.de"
SELECT
  id,
  from_address,
  to_address,
  subject,
  date_received,
  classification_status,
  processing_status,
  created_at
FROM incoming_emails
WHERE
  from_address ILIKE '%caohung%'
  OR from_address ILIKE '%profluss%'
  OR subject ILIKE '%KI-Lösung%'
  OR subject ILIKE '%Philipp Szparaga%'
ORDER BY date_received DESC
LIMIT 10;

-- 2. CHECK: Which email accounts exist and do they have assigned agents?
SELECT
  ea.id,
  ea.email,
  ea.provider,
  ea.assigned_agent_id,
  oa.name as agent_name,
  oa.status as agent_status,
  oa.language as agent_language
FROM email_accounts ea
LEFT JOIN outreach_agents oa ON ea.assigned_agent_id = oa.id
WHERE ea.email = 'hung@theaiwhisperer.de'  -- This is the receiving mailbox
ORDER BY ea.created_at DESC;

-- 3. CHECK: Are there any active outreach agents?
SELECT
  id,
  name,
  status,
  language,
  tone,
  sender_name,
  created_at,
  updated_at
FROM outreach_agents
ORDER BY updated_at DESC;

-- 4. CHECK: Were these emails classified?
SELECT
  ie.id,
  ie.from_address,
  ie.subject,
  ie.classification_status,
  ie.processing_status,
  ie.date_received,
  ie.processed_at
FROM incoming_emails ie
WHERE
  ie.to_address ILIKE '%hung@theaiwhisperer%'
  AND ie.date_received >= NOW() - INTERVAL '7 days'
ORDER BY ie.date_received DESC
LIMIT 20;

-- 5. CHECK: Were any reply jobs created?
SELECT
  rj.id,
  rj.draft_subject,
  rj.status,
  rj.risk_score,
  rj.scheduled_at,
  rj.created_at,
  ie.from_address as replying_to,
  ie.subject as original_subject,
  oa.name as agent_name
FROM reply_jobs rj
LEFT JOIN incoming_emails ie ON rj.incoming_email_id = ie.id
LEFT JOIN outreach_agents oa ON rj.agent_id = oa.id
ORDER BY rj.created_at DESC
LIMIT 10;

-- 6. CHECK: Email classification breakdown
SELECT
  classification_status,
  processing_status,
  COUNT(*) as count
FROM incoming_emails
WHERE to_address ILIKE '%hung@theaiwhisperer%'
  AND date_received >= NOW() - INTERVAL '7 days'
GROUP BY classification_status, processing_status
ORDER BY count DESC;

-- 7. CHECK: Recent email_replies (actions taken)
SELECT
  er.id,
  er.reply_type,
  er.action_taken,
  er.created_at,
  ie.from_address,
  ie.subject
FROM email_replies er
LEFT JOIN incoming_emails ie ON er.incoming_email_id = ie.id
WHERE ie.to_address ILIKE '%hung@theaiwhisperer%'
ORDER BY er.created_at DESC
LIMIT 10;

-- 8. CHECK: IMAP connection status
SELECT
  ic.email_account_id,
  ea.email,
  ic.status,
  ic.last_sync_at,
  ic.next_sync_at,
  ic.consecutive_failures,
  ic.last_error
FROM imap_connections ic
JOIN email_accounts ea ON ic.email_account_id = ea.id
WHERE ea.email = 'hung@theaiwhisperer.de'
ORDER BY ic.last_sync_at DESC;

-- ============================================
-- EXPECTED RESULTS FOR WORKING SYSTEM:
-- ============================================
-- Query 1: Should show the emails from screenshot
-- Query 2: Should show assigned_agent_id IS NOT NULL
-- Query 3: Should show at least one agent with status='active'
-- Query 4: Should show classification_status='human_reply' for real emails
-- Query 5: Should show reply_jobs records if auto-reply triggered
-- Query 6: Should show mostly 'human_reply' and 'completed' status
-- Query 7: Should show 'autonomous_draft_created' actions
-- Query 8: Should show status='active' with recent last_sync_at
