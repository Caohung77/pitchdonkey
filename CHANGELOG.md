## v0.3.1 - Open tracking fixes and diagnostics

- Track opens via pixel reliably: set `opened_at`, increment `open_count`, and log `email_events`.
- Campaign stats update on first open to reflect unique/total opens.
- Analytics counts opens from timestamps (opened_at/clicked_at/replied_at), not only status.
- Pixel URL generation hardened: uses `NEXT_PUBLIC_APP_URL` or falls back to `https://${VERCEL_URL}`.
- Added `scripts/diagnose-tracking.js` for quick Supabase-based verification.
## v0.3.2 - Campaign Analytics fixes

- Analytics derives sent/delivered/opened metrics from timestamps (not only `status`).
- Daily stats, pipeline, and recent activity now reflect real openings and deliveries.
- Added API: `GET /api/campaigns/[id]/email-details` to return real email rows (with contact info + timestamps).
- UI: EmailDetailsTable now fetches from the new endpoint (removed mock data).
## v0.3.3 - Define Delivered (Reached) as SMTP accepted

- Mark `delivered_at` at send time for SMTP success in both execution paths.
- Ensures Analytics “Delivered/Reached” > 0 even if no separate delivery webhook exists.

