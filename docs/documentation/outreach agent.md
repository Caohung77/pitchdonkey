# Outreach Agent Architecture & Implementation Guide

This document explains how the AI Outreach Agent feature is wired end-to-end: data model, services, API endpoints, front-end workflows, and supporting utilities. It is the canonical reference for maintaining or extending the system.

---

## 1. Product Overview

An Outreach Agent is a configurable AI persona that can:

- Draft inbound replies and outbound openers using company-specific context.
- Auto-fill product messaging from a company website (Perplexity smart fill).
- Auto-generate segmentation rules (Gemini smart segmentation) based on previously entered identity/product data.
- Maintain its own knowledge base to ground drafts.
- Persist configurable segmentation weights/filters that can be previewed or auto-refreshed.
- Support English and German drafts (language stored with the agent).

Users manage agents under **Dashboard → AI Outreach Agents**, where they can create, edit, duplicate, test, or delete agents.

---

## 2. Data Model (Supabase)

All schema lives in `supabase/migrations` and `lib/database-schema.sql`. Key tables:

### `outreach_agents`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `user_id` | UUID FK → users | Ownership |
| `name`, `status` | text | `status`: draft/active/inactive |
| `language` | text | `'en'` (default) or `'de'` |
| Identity fields | `sender_name`, `sender_role`, `company_name`, `tone`, `purpose` |
| Product fields | `product_one_liner`, `product_description`, `unique_selling_points[]`, `target_persona`, `conversation_goal`, `preferred_cta`, `follow_up_strategy` |
| Prompt controls | `custom_prompt`, `prompt_override` |
| Segmentation | `segment_config` JSON, `quality_weights` JSON, `knowledge_summary` JSON |
| Metadata | `settings` JSON (used for draft company URL), timestamps |

### `outreach_agent_knowledge`
Stores uploaded documents, plain text, or links associated with an agent. Columns include `type`, `title`, `content`, `url`, `storage_path`, `embedding_status`, `embedding_metadata`.

### `agent_contact_scores` & `agent_segment_members`
Persist AI scoring runs to provide explainability and maintain membership lists when segment previews are persisted.

### Types
`lib/database.types.ts` mirrors the Supabase schema for type-safe usage. All CRUD logic relies on these generated typings, e.g. `Database['public']['Tables']['outreach_agents']['Row']`.

---

## 3. Server-Side Modules

### 3.1 Outreach Agent Service (`lib/outreach-agents.ts`)
Central helper that wraps Supabase access:

- `listOutreachAgents(supabase, userId)` – returns typed agents with normalized segment config and weights.
- `getOutreachAgent(supabase, userId, agentId)` – fetch single agent or null.
- `createOutreachAgent(supabase, userId, input)` / `updateOutreachAgent(...)` / `deleteOutreachAgent(...)` – persist mutations. Automatically normalizes weights, segment config, defaults language to `'en'`, and ensures `settings.company_url` is kept in sync.
- `duplicateOutreachAgent(...)` – clones agent plus knowledge metadata.
- `addKnowledgeItem`, `updateKnowledgeItem`, `removeKnowledgeItem` – manage documents.
- `previewSegment(...)` – run local segmentation scoring, optionally persisting results to `agent_contact_scores` and `agent_segment_members`.
- `buildAgentPreview(...)` – merges override config (e.g. for draft testing) without mutating persisted state.

### 3.2 AI Integrations

- **Perplexity Smart Fill** (`src/app/api/outreach-agents/smart-fill/route.ts`)
  - Validates and normalizes a company URL.
  - Verifies reachability via `PerplexityService.verifyWebsiteAccessible`.
  - Calls `PerplexityService.analyzeWebsite` (model `sonar`) to return structured data.
  - Maps that data into draft defaults (one-liner, description, USPs, target persona) and returns to the client.

- **Gemini Smart Segmentation** (`src/app/api/outreach-agents/segment/smart-fill/route.ts`)
  - Accepts identity/product/knowledge context from previous wizard steps.
  - Builds a prompt summarizing the agent profile and existing segmentation state.
  - Calls Google Generative Language REST API (`models/gemini-flash-latest:generateContent`) using `GOOGLE_GEMINI_API_KEY`.
  - Parses the JSON payload (filters, weights, threshold, rationale) and sanitizes it before returning.

### 3.3 Draft Preview Endpoint (`src/app/api/outreach-agents/[agentId]/test/route.ts`)

- Validates payload (mode, contact metadata, incoming message snippet).
- Loads the agent, merges overrides via `buildAgentPreview`, and calls `buildDraft`.
- `buildDraft` generates localized (EN/DE) sample emails using stored product context, unique selling points, and CTA. This is a lightweight server-side renderer to give immediate drafts without hitting external models.

### 3.4 CRUD APIs

- `GET/POST /api/outreach-agents` (`route.ts`) – list/create agents.
- `GET/PUT/DELETE /api/outreach-agents/[agentId]` – load, update, delete.
- Knowledge endpoints under `/api/outreach-agents/[agentId]/knowledge` handle file metadata CRUD.
- `/api/outreach-agents/[agentId]/duplicate` duplicates an agent.
- All routes use `withAuth` (token/cookie aware), `withRateLimit`, and respond with the standard `{ success, data, error }` envelope while adding security headers.

---

## 4. Front-End Architecture

The UI lives in `src/app/dashboard/outreach-agents/page.tsx` and is a client component. Major sections:

### 4.1 Listing View
- Fetches agents via `ApiClient.get('/api/outreach-agents')` once auth is ready.
- Displays tone, goal, knowledge summary, and **language** (English/Deutsch).
- Row actions open modals/wizard with pre-filled data or call duplication/deletion endpoints.

### 4.2 Agent Wizard
Six-step modal built with local React state:

1. **Identity** – agent name, status, tone, language (default English), sender info, purpose.
2. **Product & Goals** – product positioning plus Smart Fill (Perplexity) CTA. Stores smart-fill rationale and prevents overwriting manual inputs.
3. **Knowledge Base** – upload links/text, view existing docs; uses knowledge APIs for persistence when editing.
4. **Segment Definition** – manual filters + Gemini “Suggest segment” button. Applies sanitized AI output (filters, thresholds, normalized weights) and shows rationale.
5. **Prompt Customization** – adjust system instructions or override entirely.
6. **Preview & Test** – configure a sample contact, localized helper text, optional incoming message. Calls draft-test endpoint for instant response preview.

State helpers:
- `AgentFormState` mirrors DB fields, including `language` and `company_url` (stored in `settings`).
- Smart fill/segment functions update state carefully to avoid clobbering existing entries.
- Submission builds payload with normalized weights, trimmed values, and cleans empty settings.

### Language-Aware UX
- Wizard defaults to English but toggles to German in Step 1. This choice flows through:
  - Draft preview placeholders & helper text (Step 6).
  - Smart segmentation prompt (passes language cue to Gemini).
  - Draft test copy (English or German phrase templates).
  - Listing badges showing the stored language.

### API Client (`lib/api-client.ts`)
Handles authenticated fetches, adds JWT, and surfaces structured errors for consistent toast messaging.

---

## 5. Supporting Utilities

- **Perplexity Service** (`lib/perplexity-service.ts`) – wraps Perplexity API with request prompts, HTML hint extraction, response parsing, and fallback logic.
- **Auth Middleware** (`lib/auth-middleware.ts`) – consistent authentication and rate limiting for API routes.
- **Supabase Helpers** (`lib/supabase-server.ts`, `lib/supabase-unified.ts`) – create client/server Supabase instances.
- **Segment Scoring Utilities** in `lib/outreach-agents.ts` – compute ICP/engagement/recency/deliverability/enrichment scores and clamp weights.

---

## 6. Environment Requirements

- `GOOGLE_GEMINI_API_KEY` – required for segmentation smart-fill.
- `PERPLEXITY_API_KEY` – required for product smart-fill.
- Standard Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

The API endpoints return 503 with helpful messaging when AI keys are missing, so UX surfaces guidance.

---

## 7. Typical Flows

### 7.1 Creating an Agent
1. User completes wizard steps; optional smart fills assist on steps 2 and 4.
2. Clicking **Save agent** sends payload via `POST /api/outreach-agents`.
3. Backend creates row in `outreach_agents`, stores `language`, `segment_config`, `quality_weights`, etc.
4. When editing, new knowledge items are uploaded after agent creation to maintain FK integrity.

### 7.2 Generating Draft Preview
1. Step 6 form collects contact context.
2. Client `POST`s to `/api/outreach-agents/:id/test` with sample scenario.
3. Server assembles preview agent and renders localized draft string.
4. Response is displayed with subject, body, and highlight chips.

### 7.3 Smart Segmentation
1. Step 4 user clicks **Suggest segment**.
2. Client sends identity/product/knowledge context (and current config) to `/api/outreach-agents/segment/smart-fill`.
3. Endpoint builds prompt, calls Gemini REST API, parses JSON.
4. Response updates form state; rationale is shown for transparency.

### 7.4 Smart Product Fill
1. User enters company URL in Step 2 and clicks **Smart fill**.
2. Client calls `/api/outreach-agents/smart-fill`.
3. Endpoint verifies URL, uses Perplexity to extract messaging, returns suggestions.
4. Fields are pre-populated only when currently blank (to avoid overwriting manual edits).

---

## 8. Extending the System

- **Add new languages**: extend `language` enum constraint in database, update types and front-end selects, and adapt draft templates/prompts.
- **Additional AI Providers**: wrap new endpoints similar to Perplexity/Gemini modules and expose them via the wizard.
- **Campaign Integration**: The agent `language` and messaging can be read inside campaign processors (`lib/campaign-processor.ts`) to send localized sequences.
- **Analytics**: tie agent ID into tracking events to compute KPI dashboards per agent.

---

## 9. File Map

| Path | Purpose |
| --- | --- |
| `lib/outreach-agents.ts` | Core service: CRUD, segment scoring, knowledge helpers |
| `lib/perplexity-service.ts` | Perplexity API integration for smart fill |
| `src/app/api/outreach-agents/route.ts` | List/create agents |
| `src/app/api/outreach-agents/[agentId]/route.ts` | Get/update/delete single agent |
| `src/app/api/outreach-agents/[agentId]/knowledge/*` | Knowledge CRUD |
| `src/app/api/outreach-agents/smart-fill/route.ts` | Product smart fill via Perplexity |
| `src/app/api/outreach-agents/segment/smart-fill/route.ts` | Segmentation smart fill via Gemini |
| `src/app/api/outreach-agents/[agentId]/test/route.ts` | Draft preview endpoint |
| `src/app/dashboard/outreach-agents/page.tsx` | Front-end listing + wizard |
| `outreach agent.md` | Architecture documentation |

---

## 10. Glossary

- **ICP** – Ideal Customer Profile; used to describe target segmentation criteria.
- **Quality Weights** – Weights applied to ICP fit, engagement, recency, deliverability, enrichment when scoring contacts.
- **Smart Fill** – AI-powered helper to auto-populate form fields (Perplexity for product messaging, Gemini for segmentation).
- **Draft Preview** – On-the-fly agent response generation using saved configuration (no external model call).

---

With this overview you can safely extend the Outreach Agent feature—whether adding languages, tweaking AI prompts, or integrating deeper with campaign processing.
