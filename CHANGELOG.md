## v0.3.1 - Open tracking fixes and diagnostics

- Track opens via pixel reliably: set `opened_at`, increment `open_count`, and log `email_events`.
- Campaign stats update on first open to reflect unique/total opens.
- Analytics counts opens from timestamps (opened_at/clicked_at/replied_at), not only status.
- Pixel URL generation hardened: uses `NEXT_PUBLIC_APP_URL` or falls back to `https://${VERCEL_URL}`.
- Added `scripts/diagnose-tracking.js` for quick Supabase-based verification.

