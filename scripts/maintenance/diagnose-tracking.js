#!/usr/bin/env node
/*
 Simple diagnosis for open tracking without starting Next.js.
 - Connects to Supabase using service role
 - Prints recent email_tracking rows and open stats
 - Shows sample pixel URLs to test
*/

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
  process.exit(1)
}

;(async () => {
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  
  const { data: rows, error } = await supabase
    .from('email_tracking')
    .select('id, campaign_id, contact_id, sent_at, delivered_at, opened_at, clicked_at, replied_at, tracking_pixel_id')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }

  const stats = {
    total: rows?.length || 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    missingPixelId: 0,
  }

  for (const r of rows || []) {
    if (r.sent_at || r.delivered_at || r.opened_at || r.clicked_at || r.replied_at) stats.sent++
    if (r.delivered_at || r.opened_at || r.clicked_at || r.replied_at) stats.delivered++
    if (r.opened_at || r.clicked_at || r.replied_at) stats.opened++
    if (!r.tracking_pixel_id) stats.missingPixelId++
  }

  console.log('--- Tracking Diagnosis (Supabase) ---')
  console.log('Rows fetched:', stats.total)
  console.log('Sent:', stats.sent, 'Delivered:', stats.delivered, 'Opened:', stats.opened)
  console.log('Missing pixel IDs:', stats.missingPixelId)
  console.log('Pixel base URL:', `${appUrl}/api/tracking/pixel/`)

  console.log('\nRecent records:')
  for (const r of (rows || []).slice(0, 5)) {
    console.log({ id: r.id, sent_at: r.sent_at, delivered_at: r.delivered_at, opened_at: r.opened_at, tracking_pixel_id: r.tracking_pixel_id, pixel_url: r.tracking_pixel_id ? `${appUrl}/api/tracking/pixel/${r.tracking_pixel_id}` : null })
  }

  // Check schema columns that our server code uses for opens
  const { data: cols, error: colErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, table_schema')
    .eq('table_name', 'email_tracking')
    .eq('table_schema', 'public')

  if (!colErr && cols) {
    const names = cols.map(c => c.column_name)
    const needed = ['opened_at','first_opened_at','last_opened_at','open_count','tracking_pixel_id']
    const missing = needed.filter(n => !names.includes(n))
    console.log('\nSchema check:')
    console.log('Missing columns:', missing)
  }
})().catch((e) => { console.error(e); process.exit(1) })
