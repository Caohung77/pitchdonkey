# Outreach Agent System Documentation

## Overview

The Outreach Agent System is an AI-powered contact segmentation and personalization engine that intelligently identifies and scores contacts based on multiple quality signals, enabling highly targeted outreach campaigns.

## Table of Contents

1. [Architecture](#architecture)
2. [Core Concepts](#core-concepts)
3. [Data Models](#data-models)
4. [Scoring Algorithm](#scoring-algorithm)
5. [API Reference](#api-reference)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  Outreach Agent System                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Agent      │◄────►│  Segment     │                │
│  │ Configuration│      │  Filters     │                │
│  └──────────────┘      └──────────────┘                │
│         │                      │                         │
│         ▼                      ▼                         │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Quality    │      │   Contact    │                │
│  │   Weights    │◄────►│   Scoring    │                │
│  └──────────────┘      └──────────────┘                │
│         │                      │                         │
│         ▼                      ▼                         │
│  ┌──────────────┐      ┌──────────────┐                │
│  │  Knowledge   │      │   Segment    │                │
│  │   Base       │      │   Preview    │                │
│  └──────────────┘      └──────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### File Structure

```
lib/
  └── outreach-agents.ts          # Core business logic

src/app/
  ├── api/
  │   └── outreach-agents/        # API endpoints
  │       ├── route.ts            # List/Create agents
  │       └── [agentId]/
  │           └── route.ts        # Get/Update/Delete agent
  └── dashboard/
      └── outreach-agents/        # UI components
          └── page.tsx            # Agent management page

database/
  ├── outreach_agents             # Agent configurations
  ├── outreach_agent_knowledge    # Knowledge base items
  ├── agent_contact_scores        # Historical scoring data
  └── agent_segment_members       # Segment membership
```

---

## Core Concepts

### 1. Outreach Agent

An **Outreach Agent** is a configured AI entity that:
- Defines your ideal customer profile (ICP)
- Scores contacts based on multiple quality signals
- Generates personalized outreach content
- Maintains a knowledge base for context-aware messaging

**Key Properties:**
- **Identity**: Name, purpose, tone, language (en/de)
- **Company Context**: Sender details, product description, USPs
- **Messaging**: Conversation goals, CTAs, follow-up strategy
- **Segmentation**: Filters, data signals, quality weights
- **Knowledge Base**: Documents, links, and context for AI personalization

### 2. Contact Scoring

The system uses a **weighted multi-factor scoring algorithm** to rank contacts from 0.0 to 1.0:

```
Score = (w₁ × ICP_Fit) + (w₂ × Engagement) + (w₃ × Recency) + (w₄ × Deliverability) + (w₅ × Enrichment)
```

**Default Weights:**
- ICP Fit: 40%
- Engagement: 25%
- Recency: 20%
- Deliverability: 10%
- Enrichment: 5%

### 3. Segment Configuration

A **Segment Configuration** defines:
- **Filters**: Hard requirements (industry, role, tags, custom fields)
- **Data Signals**: Quality thresholds (engagement, deliverability)
- **Advanced Rules**: Exclusions, cooldown periods, opt-out handling
- **Schedule**: Manual, daily, weekly, or webhook-triggered
- **Limits**: Score threshold (default 0.55), max contacts (default 100)

### 4. Knowledge Base

Agents can be enriched with domain-specific knowledge:
- **PDF/DOC**: Product documentation, case studies
- **Text/HTML**: Company information, value propositions
- **Links**: Web resources, competitor analysis
- **Embeddings**: Vector-based semantic search (future enhancement)

---

## Data Models

### OutreachAgent

```typescript
interface OutreachAgent {
  id: string
  user_id: string
  name: string
  status: 'draft' | 'active' | 'inactive'
  language: 'en' | 'de'

  // Company Context
  purpose?: string
  tone?: string
  sender_name?: string
  sender_role?: string
  company_name?: string
  product_one_liner?: string
  product_description?: string
  unique_selling_points: string[]

  // Messaging Strategy
  target_persona?: string
  conversation_goal?: string
  preferred_cta?: string
  follow_up_strategy?: string
  custom_prompt?: string
  prompt_override?: string

  // Segmentation
  segment_config: SegmentConfig
  quality_weights: QualityWeights

  // Knowledge
  knowledge_summary: KnowledgeSummary

  // Metadata
  created_at: string
  updated_at: string
}
```

### SegmentConfig

```typescript
interface SegmentConfig {
  filters: {
    industries?: string[]
    companySizes?: string[]
    countries?: string[]
    roles?: string[]
    keywords?: string[]
    includeTags?: string[]
    excludeTags?: string[]
    customFields?: Array<{ key: string; values: string[] }>
  }

  dataSignals: {
    minEngagementScore?: number
    minOpens?: number
    minClicks?: number
    minReplies?: number
    maxBounceRate?: number
    recencyDays?: number
    deliverabilityScore?: number
  }

  advancedRules: {
    excludeOptedOut?: boolean
    excludeStatuses?: string[]
    cooldownDays?: number
    excludeWithoutEmail?: boolean
    excludeMissingCompany?: boolean
  }

  schedule?: {
    mode: 'manual' | 'daily' | 'weekly' | 'webhook'
    time?: string // HH:MM
    timezone?: string
    dayOfWeek?: number // 0 (Sunday) - 6 (Saturday)
    webhookUrl?: string
  }

  threshold?: number // Default: 0.55
  limit?: number // Default: 100
  qualityWeights?: QualityWeights
}
```

### QualityWeights

```typescript
interface QualityWeights {
  icpFit: number        // Default: 0.4
  engagement: number    // Default: 0.25
  recency: number       // Default: 0.2
  deliverability: number // Default: 0.1
  enrichment: number    // Default: 0.05
}
```

---

## Scoring Algorithm

### 1. ICP Fit Score (0.0 - 1.0)

Measures how well a contact matches your ideal customer profile based on:
- **Country Match**: Contact's country in allowed list
- **Role Match**: Contact's position contains target role keywords
- **Keyword Match**: Company/position contains target keywords
- **Tag Match**: Contact has required tags
- **Custom Fields**: Contact's custom fields match criteria

**Formula:**
```
ICP_Fit = (matching_criteria / total_criteria)
```

**Example:**
```typescript
// Agent targeting German CTOs in SaaS companies
filters: {
  countries: ['Germany'],
  roles: ['CTO', 'Chief Technology Officer'],
  keywords: ['saas', 'software'],
  includeTags: ['enterprise']
}

// Contact matches 3/4 criteria → ICP_Fit = 0.75
```

### 2. Engagement Score (0.0 - 1.0)

Measures historical interaction quality:
- **Engagement Score**: From contact's engagement tracking (0-100)
- **Opens**: Email open count (weight: 0.05 per open)
- **Clicks**: Link click count (weight: 0.1 per click)
- **Replies**: Email reply count (weight: 0.2 per reply)

**Formula:**
```
Engagement = clamp((engagement_score / 100) + (opens × 0.05) + (clicks × 0.1) + (replies × 0.2))
```

**Example:**
```typescript
// High-engagement contact
engagement_score: 75
opens: 5
clicks: 2
replies: 1

// Score = 0.75 + 0.25 + 0.2 + 0.2 = 1.0 (clamped to 1.0)
```

### 3. Recency Score (0.0 - 1.0)

Measures how recently the contact engaged:
- **Recent Reply**: Last positive engagement within recency window (max score: 1.0)
- **Recent Open**: Last email open within recency window (max score: 0.7)
- **Recent Contact**: Last contact within recency window (max score: 0.5)
- **Stale**: No engagement → fallback score 0.25

**Formula:**
```
Recency = {
  1.0 - (days_since_reply / recency_window)     if recent reply
  0.7 - (days_since_open / (recency_window × 1.5))  if recent open
  0.5 - (days_since_contact / (recency_window × 2)) if recent contact
  0.25                                           otherwise
}
```

**Default recency window**: 180 days

### 4. Deliverability Score (0.0 - 1.0)

Measures email deliverability likelihood:
- **Bounced Previously**: 0.1 (very low priority)
- **Unsubscribed**: 0.05 (do not contact)
- **Clean History**: Configured deliverability threshold (default: 0.7)

**Formula:**
```
Deliverability = {
  0.1 if bounce_count > 0
  0.05 if status == 'unsubscribed'
  deliverability_threshold otherwise
}
```

### 5. Enrichment Score (0.0 - 1.0)

Measures data quality and completeness:
- **Complete Enrichment**: 1.0 (full company data available)
- **Partial Enrichment**: 0.6 (some data available)
- **Failed Enrichment**: 0.2 (attempted but failed)
- **Not Enriched**: 0.4 (neutral baseline)

**Formula:**
```
Enrichment = {
  1.0 if status == 'complete' or 'enriched'
  0.6 if status == 'partial'
  0.2 if status == 'failed'
  0.4 otherwise
}
```

### Overall Score Calculation

```typescript
function computeOverallScore(contact: Contact, agent: OutreachAgent): number {
  const { segment_config, quality_weights } = agent

  const reasons: string[] = []
  const icpFit = computeIcpFit(contact, segment_config.filters, reasons)
  const engagement = computeEngagementScore(contact, segment_config.dataSignals, reasons)
  const recency = computeRecencyScore(contact, segment_config.dataSignals, reasons)
  const deliverability = computeDeliverabilityScore(contact, segment_config.dataSignals, reasons)
  const enrichment = computeEnrichmentScore(contact, reasons)

  return clamp(
    quality_weights.icpFit * icpFit +
    quality_weights.engagement * engagement +
    quality_weights.recency * recency +
    quality_weights.deliverability * deliverability +
    quality_weights.enrichment * enrichment
  )
}
```

---

## API Reference

### List Outreach Agents

```typescript
async function listOutreachAgents(
  supabase: Supabase,
  userId: string
): Promise<OutreachAgent[]>
```

**Returns**: Array of all agents for the user, ordered by `updated_at` descending

### Get Outreach Agent

```typescript
async function getOutreachAgent(
  supabase: Supabase,
  userId: string,
  agentId: string
): Promise<OutreachAgent | null>
```

**Returns**: Single agent or null if not found

### Create Outreach Agent

```typescript
async function createOutreachAgent(
  supabase: Supabase,
  userId: string,
  input: OutreachAgentUpsertInput
): Promise<OutreachAgent>
```

**Input**:
```typescript
{
  name: string                              // Required
  status?: 'draft' | 'active' | 'inactive' // Default: 'draft'
  language?: 'en' | 'de'                   // Default: 'en'
  purpose?: string
  tone?: string
  sender_name?: string
  sender_role?: string
  company_name?: string
  product_one_liner?: string
  product_description?: string
  unique_selling_points?: string[]
  target_persona?: string
  conversation_goal?: string
  preferred_cta?: string
  follow_up_strategy?: string
  custom_prompt?: string
  prompt_override?: string
  segment_config?: Partial<SegmentConfig>
  quality_weights?: Partial<QualityWeights>
  settings?: Record<string, any>
}
```

### Update Outreach Agent

```typescript
async function updateOutreachAgent(
  supabase: Supabase,
  userId: string,
  agentId: string,
  input: Partial<OutreachAgentUpsertInput>
): Promise<OutreachAgent>
```

**Input**: Same as create, but all fields optional (only provided fields are updated)

### Delete Outreach Agent

```typescript
async function deleteOutreachAgent(
  supabase: Supabase,
  userId: string,
  agentId: string
): Promise<void>
```

### Duplicate Outreach Agent

```typescript
async function duplicateOutreachAgent(
  supabase: Supabase,
  userId: string,
  agentId: string
): Promise<OutreachAgent>
```

**Behavior**:
- Creates new agent with name suffix " Copy"
- Status set to 'draft'
- Copies all configuration including segment config and quality weights
- Copies knowledge base metadata (not binary content)
- Embeddings set to 'pending' for re-processing

### Preview Segment

```typescript
async function previewSegment(
  supabase: Supabase,
  userId: string,
  agent: OutreachAgent,
  options?: {
    persist?: boolean  // Save scores to database
    limit?: number     // Override agent's limit
    threshold?: number // Override agent's threshold
  }
): Promise<SegmentPreviewResult>
```

**Returns**:
```typescript
{
  agent_id: string
  run_id: string
  limit: number
  threshold: number
  total_candidates: number // Total contacts evaluated
  total_matched: number    // Contacts above threshold
  contacts: SegmentPreviewContact[] // Top matches sorted by score
}
```

**SegmentPreviewContact**:
```typescript
{
  id: string
  contact_id: string
  full_name: string
  email: string
  company?: string
  position?: string
  country?: string
  score: number // 0.0 - 1.0
  reasons: string[] // Why this contact scored well/poorly
  engagement: {
    score?: number
    opens?: number
    clicks?: number
    replies?: number
    lastPositiveAt?: string
  }
  enrichment: {
    status?: string
    updated_at?: string
  }
}
```

### Knowledge Base Management

```typescript
// Add knowledge item
async function addKnowledgeItem(
  supabase: Supabase,
  userId: string,
  agentId: string,
  input: KnowledgeItemInput
)

// Update knowledge item
async function updateKnowledgeItem(
  supabase: Supabase,
  userId: string,
  agentId: string,
  knowledgeId: string,
  updates: Partial<KnowledgeItemInput>
)

// Remove knowledge item
async function removeKnowledgeItem(
  supabase: Supabase,
  userId: string,
  agentId: string,
  knowledgeId: string
)
```

---

## Usage Examples

### Example 1: Create Agent for SaaS Sales

```typescript
const agent = await createOutreachAgent(supabase, userId, {
  name: 'Enterprise SaaS Outreach',
  status: 'active',
  language: 'en',

  // Company Context
  sender_name: 'John Doe',
  sender_role: 'VP of Sales',
  company_name: 'Acme SaaS',
  product_one_liner: 'AI-powered CRM that 10x's sales productivity',
  product_description: 'Our platform uses machine learning to automate lead scoring...',
  unique_selling_points: [
    '95% customer satisfaction rate',
    'Integrates with 500+ tools',
    'Enterprise-grade security (SOC2, GDPR compliant)'
  ],

  // Messaging Strategy
  target_persona: 'VP Sales / CRO at B2B SaaS companies with 50-500 employees',
  conversation_goal: 'Book a 30-minute product demo',
  preferred_cta: 'Would you be open to a quick call next week?',
  follow_up_strategy: '3-touch sequence: value-first → case study → final call',

  // Segmentation
  segment_config: {
    filters: {
      countries: ['United States', 'Canada', 'United Kingdom'],
      roles: ['VP Sales', 'CRO', 'Head of Sales'],
      keywords: ['saas', 'b2b', 'software'],
      excludeTags: ['competitor', 'not-interested']
    },
    dataSignals: {
      minEngagementScore: 30,
      minOpens: 2,
      maxBounceRate: 0.1,
      recencyDays: 90,
      deliverabilityScore: 0.8
    },
    advancedRules: {
      excludeOptedOut: true,
      excludeStatuses: ['bounced', 'unsubscribed'],
      cooldownDays: 14,
      excludeWithoutEmail: true,
      excludeMissingCompany: true
    },
    threshold: 0.65, // Higher threshold for quality
    limit: 50
  },

  quality_weights: {
    icpFit: 0.45,        // Prioritize ICP fit
    engagement: 0.30,    // Second priority: engagement
    recency: 0.15,
    deliverability: 0.08,
    enrichment: 0.02
  }
})
```

### Example 2: Preview Segment Before Campaign

```typescript
// Preview top 100 matches
const preview = await previewSegment(supabase, userId, agent, {
  limit: 100,
  threshold: 0.6,
  persist: true // Save scores for historical tracking
})

console.log(`Found ${preview.total_matched} contacts above threshold 0.6`)
console.log(`Top contact: ${preview.contacts[0].full_name} (score: ${preview.contacts[0].score})`)
console.log(`Reasons: ${preview.contacts[0].reasons.join(', ')}`)

// Top contact might show:
// "Score: 0.87"
// "Reasons: Country match (United States), Role match (VP Sales), Keyword match, Engagement score 0.68, Recent contact 45 days ago"
```

### Example 3: Adjust Weights for Different Campaigns

```typescript
// Scenario: Re-engagement campaign for cold contacts
const reengagementAgent = await updateOutreachAgent(supabase, userId, agentId, {
  name: 'Re-engagement Campaign',
  quality_weights: {
    icpFit: 0.35,
    engagement: 0.10,    // De-prioritize engagement (targeting cold leads)
    recency: 0.40,       // Prioritize recency (contacted recently but no engagement)
    deliverability: 0.10,
    enrichment: 0.05
  },
  segment_config: {
    dataSignals: {
      minEngagementScore: 0,  // Allow cold contacts
      minOpens: 0,
      recencyDays: 30,         // Only recently contacted
      deliverabilityScore: 0.9 // High deliverability required
    }
  }
})
```

### Example 4: Add Knowledge Base for Context

```typescript
// Add product documentation
await addKnowledgeItem(supabase, userId, agentId, {
  type: 'pdf',
  title: 'Product Overview 2024',
  description: 'Comprehensive product documentation',
  storage_path: '/storage/agents/abc-123/product-overview.pdf',
  embedding_status: 'pending'
})

// Add competitor analysis
await addKnowledgeItem(supabase, userId, agentId, {
  type: 'text',
  title: 'Competitive Positioning',
  content: 'Our key differentiators vs Salesforce: ...',
  embedding_status: 'ready'
})

// Add case study
await addKnowledgeItem(supabase, userId, agentId, {
  type: 'link',
  title: 'Enterprise Customer Success Story',
  url: 'https://acme.com/case-studies/fortune-500',
  embedding_status: 'ready'
})
```

---

## Best Practices

### 1. Agent Configuration

**✅ DO:**
- Use descriptive, specific agent names
- Define clear ICP criteria in filters
- Set realistic quality thresholds (0.5-0.7 range)
- Provide detailed product context for better personalization
- Start with small segment limits (50-100) and scale up

**❌ DON'T:**
- Create overlapping agents targeting the same audience
- Set threshold too high (>0.8) unless ICP is very narrow
- Ignore deliverability signals - respect opt-outs and bounces
- Override all quality weights to favor one dimension

### 2. Quality Weights Tuning

**For New Product/Market:**
```typescript
{
  icpFit: 0.50,         // Prioritize fit first
  engagement: 0.10,     // Low engagement expected
  recency: 0.20,
  deliverability: 0.15,
  enrichment: 0.05
}
```

**For Re-engagement:**
```typescript
{
  icpFit: 0.30,
  engagement: 0.05,     // Don't penalize low engagement
  recency: 0.50,        // Prioritize recent contacts
  deliverability: 0.10,
  enrichment: 0.05
}
```

**For High-Intent Leads:**
```typescript
{
  icpFit: 0.35,
  engagement: 0.40,     // Prioritize engaged contacts
  recency: 0.15,
  deliverability: 0.08,
  enrichment: 0.02
}
```

### 3. Segmentation Strategy

**Start Broad, Then Narrow:**
1. Begin with minimal filters to see total addressable contacts
2. Preview segment to see score distribution
3. Gradually add filters and adjust threshold
4. Monitor match rate (aim for >20 contacts minimum)

**Use Advanced Rules Wisely:**
- Always enable `excludeOptedOut: true`
- Set reasonable `cooldownDays` (7-30 days typical)
- Consider `excludeMissingCompany` for B2B outreach
- Leverage `excludeStatuses` to avoid bad contacts

### 4. Knowledge Base Best Practices

**Content Types by Use Case:**
- **Product Docs**: PDF/DOC for technical details
- **Value Props**: Text for quick reference
- **Case Studies**: Links to published content
- **Competitor Analysis**: Text or HTML for positioning

**Embedding Strategy:**
- Start with high-quality, evergreen content
- Keep documents focused and well-structured
- Update embedding status as content changes
- Monitor embedding success rate

### 5. Performance Optimization

**Database Queries:**
- Segment preview loads 4x limit contacts for filtering
- Filters apply before scoring (more efficient)
- Index frequently filtered fields (country, status, tags)
- Consider caching segment results for active agents

**Scoring Performance:**
- Scoring is O(n) per contact (n = total contacts)
- Filters reduce n before scoring begins
- Weight normalization happens once per agent load
- Use `persist: true` to save historical scores

### 6. Testing and Validation

**Before Launching:**
1. Preview segment with `persist: false` (dry run)
2. Review top 10-20 contacts manually
3. Check reasons array for scoring logic validation
4. Adjust weights if scores don't match expectations
5. Run final preview with `persist: true`

**After Launch:**
- Monitor engagement metrics per agent
- A/B test different messaging strategies
- Refine weights based on conversion rates
- Archive inactive agents to reduce clutter

---

## Database Schema

### outreach_agents

```sql
CREATE TABLE outreach_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text CHECK (status IN ('draft', 'active', 'inactive')) DEFAULT 'draft',
  language text CHECK (language IN ('en', 'de')) DEFAULT 'en',

  -- Company Context
  purpose text,
  tone text,
  sender_name text,
  sender_role text,
  company_name text,
  product_one_liner text,
  product_description text,
  unique_selling_points text[],

  -- Messaging Strategy
  target_persona text,
  conversation_goal text,
  preferred_cta text,
  follow_up_strategy text,
  custom_prompt text,
  prompt_override text,

  -- Configuration
  segment_config jsonb NOT NULL DEFAULT '{}',
  quality_weights jsonb NOT NULL DEFAULT '{}',
  knowledge_summary jsonb DEFAULT '{}',
  settings jsonb DEFAULT '{}',

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_outreach_agents_user_id ON outreach_agents(user_id);
CREATE INDEX idx_outreach_agents_status ON outreach_agents(status);
```

### outreach_agent_knowledge

```sql
CREATE TABLE outreach_agent_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type text CHECK (type IN ('pdf', 'doc', 'text', 'link', 'html')) NOT NULL,
  title text NOT NULL,
  description text,
  content text,
  url text,
  storage_path text,

  embedding_status text CHECK (embedding_status IN ('pending', 'processing', 'ready', 'failed')) DEFAULT 'pending',
  embedding_metadata jsonb DEFAULT '{}',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_knowledge_agent_id ON outreach_agent_knowledge(agent_id);
CREATE INDEX idx_agent_knowledge_status ON outreach_agent_knowledge(embedding_status);
```

### agent_contact_scores

```sql
CREATE TABLE agent_contact_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,

  score numeric(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  reasons jsonb DEFAULT '[]',

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agent_scores_agent_contact ON agent_contact_scores(agent_id, contact_id);
CREATE INDEX idx_agent_scores_run_id ON agent_contact_scores(run_id);
CREATE INDEX idx_agent_scores_score ON agent_contact_scores(score DESC);
```

### agent_segment_members

```sql
CREATE TABLE agent_segment_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  status text CHECK (status IN ('selected', 'contacted', 'replied', 'bounced', 'unsubscribed')) DEFAULT 'selected',
  score numeric(5,4) NOT NULL,
  reasons jsonb DEFAULT '[]',
  run_id uuid NOT NULL,

  added_at timestamptz DEFAULT now(),
  contacted_at timestamptz,
  metadata jsonb DEFAULT '{}',

  UNIQUE(agent_id, contact_id)
);

CREATE INDEX idx_segment_members_agent_id ON agent_segment_members(agent_id);
CREATE INDEX idx_segment_members_contact_id ON agent_segment_members(contact_id);
CREATE INDEX idx_segment_members_status ON agent_segment_members(status);
```

---

## Troubleshooting

### Issue: Low Match Rate

**Symptoms**: Preview returns <10 contacts

**Solutions**:
1. Lower quality threshold (try 0.45-0.50)
2. Reduce filter strictness (remove optional filters)
3. Increase recencyDays window
4. Check if contacts have required fields (email, company, etc.)
5. Review reasons array for failing contacts

### Issue: All Contacts Score Similarly

**Symptoms**: All scores between 0.48-0.52

**Solutions**:
1. Increase weight spread (e.g., ICP 0.5, others 0.1-0.15)
2. Add more specific filters to increase ICP variance
3. Enrich more contacts to improve enrichment score variance
4. Check if engagement data is being tracked properly

### Issue: Top Contacts Don't Match Expectations

**Symptoms**: High scores but contacts don't fit ICP

**Solutions**:
1. Review filters - may need to add exclusions
2. Adjust quality weights to prioritize ICP fit
3. Check reasons array to see why contacts scored high
4. Add custom fields for more granular filtering

### Issue: Knowledge Base Not Used in Personalization

**Symptoms**: Generated content doesn't reference knowledge items

**Solutions**:
1. Ensure embedding_status is 'ready'
2. Check embedding_metadata for processing errors
3. Verify content format is compatible (text-based)
4. Update agent's custom_prompt to reference knowledge base

---

## Future Enhancements

### Planned Features

1. **Vector Embeddings**
   - Semantic search across knowledge base
   - AI-powered content retrieval for personalization

2. **A/B Testing**
   - Test multiple agent configurations simultaneously
   - Track conversion rates per variant

3. **Auto-Optimization**
   - Machine learning to suggest weight adjustments
   - Predictive scoring based on historical conversions

4. **Multi-Channel Support**
   - LinkedIn messaging integration
   - SMS/WhatsApp outreach

5. **Team Collaboration**
   - Shared agents across team members
   - Role-based permissions

6. **Advanced Scheduling**
   - Time-based segment refreshes
   - Webhook triggers from external systems

---

## Support

For questions or issues with the Outreach Agent System:
- **Documentation**: This file
- **API Reference**: `lib/outreach-agents.ts`
- **Examples**: See Usage Examples section above
- **Support**: Create an issue in the project repository

---

*Last Updated: October 7, 2025*
*Version: 1.0*
