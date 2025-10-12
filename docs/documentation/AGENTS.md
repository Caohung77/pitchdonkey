# Codebase Status (Agents Overview)

This document summarizes the current working state of the ColdReach Pro codebase to help agents and collaborators reason about what is implemented, what changed recently, and what remains to be done.

## Highlights

- Campaign creation (simple):
  - Choose an email account per campaign (`from_email_account_id`).
  - Set per-campaign daily send limit (10/20/30/40/50).
  - Processor honors chosen account and daily quota.
- Email accounts:
  - Support for SMTP accounts (username/password).
  - Gmail/Outlook OAuth registration flows are implemented (see “OAuth” below).
  - Delete flow: soft-delete if supported, falls back to hard delete; prevents deletion when active/scheduled campaigns are using the account.
- Enrichment:
  - Website enrichment via Perplexity `sonar` model.
  - Derives website from email domain if missing; verifies accessibility; persists website in contact.
  - Prompt grounded with site hints; avoids over-classification (e.g., “Digital Marketing” without evidence).
- Domain auth:
  - Verifies SPF/DKIM/DMARC via DNS; persists verification states; UI shows status.
  - Status endpoint reads correct DKIM fields; delete and list views filter logically.
- API client:
  - Better error surfacing (handles envelope `{ success, data, error, message }` and text bodies).

## Campaigns

- UI: `src/app/dashboard/campaigns/simple/page.tsx`
  - Step 3 shows:
    - Email account dropdown (required).
    - Daily send limit buttons (10/20/30/40/50).
- Create API: `POST /api/campaigns/simple`
  - Validates account availability; enforces one running/scheduled campaign per account.
  - Stores `from_email_account_id` and `daily_send_limit`.
- Processor: `lib/campaign-processor.ts`
  - Uses campaign’s `from_email_account_id` if provided; otherwise first active account.
  - Enforces per-campaign daily quota by counting `email_tracking.sent_at` per day.
  - SMTP sending implemented; OAuth sending currently stubbed with log.
  - Tracking pixel injection on send; tracking records in `email_tracking`.

## Email Accounts

- List/CRUD:
  - GET `/api/email-accounts` returns accounts (filters soft-deleted in-memory when present).
  - POST `/api/email-accounts` supports SMTP creation (host/port/secure/username/password) and stores domain.
  - GET/PUT/DELETE `/api/email-accounts/[id]` implemented.
  - Delete prevents removal if active/scheduled campaigns use the account (supports legacy/new column names), then soft-deletes; hard-deletes if `deleted_at` column absent.
- UI components:
  - AddEmailAccountDialog (OAuth + SMTP), EditEmailAccountDialog, DeleteEmailAccountDialog.

## OAuth (Gmail / Outlook)

- Gmail flow:
  - Start: `GET /api/email-accounts/oauth/gmail` (uses `withAuth`; builds redirect URL from request origin).
  - Callback: `GET /api/email-accounts/oauth/gmail/callback` exchanges code, gets profile, stores tokens in `email_accounts` (`access_token`, `refresh_token`, `token_expires_at`).
  - Env needed: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  - Google Cloud: enable Gmail API; set OAuth consent; add authorized redirect URI(s): `${ORIGIN}/api/email-accounts/oauth/gmail/callback`.
  - Workspace Admin: API access ON; allowlist the app in “Manage third‑party app access” or set consent to Internal.
- Outlook flow files present and patterned similarly (tokens storage, not detailed here).
- Sending via Gmail/Outlook:
  - Not yet wired into campaign send path. Next step is to use Gmail API (preferred) or SMTP XOAUTH2 with our stored tokens.

## Enrichment

- `lib/perplexity-service.ts`
  - Model: `sonar` (Perplexity) for web analysis.
  - `verifyWebsiteAccessible`, `fetchSiteHints` to ground prompts and avoid misclassification.
- `lib/contact-enrichment.ts`
  - Strategy: use contact.website if valid; else derive from email domain; verify; persist website; analyze; save `enrichment_data`.
- `src/app/api/contacts/[id]/enrich/route.ts`
  - Returns 200 with `success: false` on business-rule failures to avoid hard client errors; success includes rich data.

## Domain Auth

- `lib/domain-auth.ts` + `lib/domain-verification-engine.ts`
  - Verifies SPF/DKIM/DMARC with DNS lookups; saves verification flags, last_checked, records, and error messages.
- Status endpoint: `GET /api/domains/[domain]/status`
  - Reads `dkim_public_key` (or raw) and `dkim_selector`; reports overall status.
- UI: DomainAuthDialog — shows status, lets you verify now, and shows generated records.

## Known gaps / TODOs

1) Gmail/Outlook sending
- Implement Gmail API send in `lib/campaign-processor.ts` for `provider === 'gmail'`:
  - Refresh tokens via `OAuthTokenManager`.
  - Build MIME + tracking pixel; call `gmail.users.messages.send`.
  - Handle quota/rate errors with retry/backoff.

2) Outlook sending
- Similar to Gmail (Graph API or SMTP XOAUTH2). Tokens stored; need send path.

3) DNS lookup resiliency
- Optionally set resolvers (e.g., Cloudflare/Google) for TXT lookups to reduce timeouts; current retries/timeouts exist.

4) API consistency
- Some endpoints accept/return `{ success, data, error }`; ensure all new endpoints follow this.

## Environment

- Required keys:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for Gmail OAuth)
  - Optional: `NEXT_PUBLIC_APP_URL` (fallback base URL)
  - Perplexity: `PERPLEXITY_API_KEY`

## Recent tags

- v0.8.1: Perplexity model fix (`sonar`) + error surfacing
- v0.8.2: Enrichment hardening (site hints, stricter rules, persist website)
- v0.8.3: Enrichment control‑flow fix (no false “no website/email”)
- v0.8.4: Campaign email account selection + daily limit (per-campaign) and processor support

## Quick verification

- Gmail OAuth: add a Gmail account → consent → returns `success=gmail_connected`.
- Campaign creation: Step 3 shows account dropdown + daily limit; enforce one active campaign per account.
- Delete account: removes card; blocks when campaigns are active.
- Enrichment: website or derived domain gets analyzed; `enrichment_data` populated on success.
- Domain auth: Verify Now updates SPF/DKIM/DMARC; status persists and shows in UI.

