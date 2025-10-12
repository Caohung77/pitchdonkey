# Simple AI Composer v1

## Wireframe Overview
- Location: existing “New email” modal used for manual messages.
- Header Row:
  - Left: avatar + dropdown selector labeled `Agent` showing default outreach agent (e.g., `Agent: Alex Rivera ▾`).
  - Right: segmented control with two options `Improve` and `Generate`; default to `Improve`.
- Core Fields (top to bottom):
  1. `From` (read-only account info as today).
  2. `To` input.
  3. `Subject` textarea with inline “Improve with {AgentName}” button when mode = Improve.
  4. Toolbar containing formatting icons (bold, italic, headings, list, link, undo/redo).
  5. Body editor (rich text).
  6. Mode-specific action row.
     - Improve: secondary button `Review changes` (disabled until agent response) and primary button `Improve with {AgentName}`.
     - Generate: prompt textarea placeholder “Describe what you need {AgentName} to write…”, `Generate draft` primary button, `Clear` secondary.
  7. Footer retains `Cancel` / `Send`.
- Status feedback: lightweight toast-style strip directly under toolbar showing progress (`{AgentName} is polishing your draft…`) and success (`{AgentName} suggested updates`). Includes `Undo` link after acceptance.

```
┌─────────────────────────────────────────────────────────────┐
│ Agent: Alex Rivera ▾                  Improve | Generate    │
├─────────────────────────────────────────────────────────────┤
│ To: [________________________________________]              │
│ Subject: [_____________________________] [Improve…]         │
│ ───────────────── toolbar icons ─────────────────────────── │
│                                                             │
│  Rich text body area                                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Improve with Alex Rivera   (Review changes)                 │
│ Cancel                                      Send            │
└─────────────────────────────────────────────────────────────┘
```

Interaction Notes:
- Switching agents updates button labels and future AI calls; if an interaction is in-flight, warn the user before switching.
- Switching to `Generate` replaces the action row with prompt input and `Generate draft` button; generated content populates both subject and body.
- `Review changes` opens a simple diff overlay with original vs improved text (if added in later iteration; for v1 it can act as `Revert`).

## API Contracts

### `POST /agent/improve`
- Purpose: Polish an existing draft using selected agent persona.
- Request body:
  ```json
  {
    "agent_id": "uuid",
    "subject": "string",
    "body": "string",
    "context": {
      "recipient_email": "string|null",
      "notes": "string|null"
    }
  }
  ```
- Response success:
  ```json
  {
    "subject": "string",
    "body": "string",
    "explanation": "string",
    "latency_ms": 1234,
    "agent_version": "v2025.03.12"
  }
  ```
- Error cases:
  - `400` validation (missing body/agent).
  - `403` user lacks access to agent.
  - `429` rate limited (include retry-after).
  - `500` agent failure (surface generic message, log full details internally).

### `POST /agent/generate`
- Purpose: Generate subject/body from a short brief using agent persona.
- Request body:
  ```json
  {
    "agent_id": "uuid",
    "prompt": "string",
    "context": {
      "recipient_email": "string|null",
      "notes": "string|null"
    },
    "hints": {
      "length": "short|medium|long|null"
    }
  }
  ```
- Response success:
  ```json
  {
    "subject": "string",
    "body": "string",
    "reasoning_highlights": [
      "string"
    ],
    "latency_ms": 2150,
    "agent_version": "v2025.03.12"
  }
  ```
- Error cases mirror `/agent/improve`; add `422` for unusable prompt (e.g., policy violation).

## Latency Prototype Plan

### Objective
Validate v1 latency targets (Improve ≤3s P95, Generate ≤5s P95) using a single representative agent before full rollout.

### Approach
- Implement lightweight CLI script (e.g., `scripts/probe-agent-latency.ts`) that:
  1. Accepts `agent_id`, `mode`, sample payload file.
  2. Sends 20 sequential requests to staging endpoints.
  3. Logs per-call latency and aggregates P50/P90/P95.
- Sample pseudo-code:
  ```ts
  const start = Date.now();
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
  const end = Date.now();
  latencies.push(end - start);
  ```
- Provide two fixture payloads:
  - `fixtures/improve-sample.json` (150-word draft).
  - `fixtures/generate-brief.json` (“Follow up after introductory call”).
- Run script during off-peak and peak hours to observe variance; record results in shared sheet.
- If P95 exceeds targets, capture response metadata, compare against provider telemetry, and flag to infra team for tuning (prompt adjustments, caching).

### Deliverables
- Script committed under `scripts/`.
- README section describing execution (`pnpm ts-node scripts/probe-agent-latency.ts --mode improve --payload fixtures/improve-sample.json`).
- Initial latency report posted to team channel.
