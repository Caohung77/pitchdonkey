/**
 * AI Contact Query Service
 *
 * Uses Gemini 2.5 Flash Lite with function calling to intelligently route
 * natural language queries to Supabase database operations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getOutreachAgent } from './outreach-agents'
import { toGeminiFunctionDeclarations } from './contact-query-functions'
import { executeContactQuery, deduplicateContacts, type QueryExecutionResult } from './contact-query-executors'

type Supabase = SupabaseClient<Database>
type Contact = Database['public']['Tables']['contacts']['Row']

export interface AIQueryResult {
  contacts: Contact[]
  reasoning: string
  functionsUsed: Array<{
    name: string
    parameters: Record<string, any>
    resultCount: number
  }>
  tokensUsed: number
  executionTimeMs: number
}

interface GeminiFunctionCall {
  name: string
  args: Record<string, any>
}

/**
 * Process a natural language contact query using AI
 */
export async function processAIContactQuery(
  query: string,
  agentId: string,
  userId: string,
  supabase: Supabase,
  maxResults: number = 100
): Promise<AIQueryResult> {
  const startTime = Date.now()

  // 1. Load agent context
  const agent = await getOutreachAgent(supabase, userId, agentId)
  if (!agent) {
    throw new Error('Outreach agent not found')
  }

  // 2. Build system prompt with agent context
  const systemPrompt = buildSystemPrompt(agent, agentId)

  // 3. Call Gemini with function calling enabled
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY not configured')
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: query }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        tools: [
          {
            functionDeclarations: toGeminiFunctionDeclarations()
          }
        ]
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error response:', errorText)
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  console.log('Gemini API response:', JSON.stringify(data, null, 2))

  // 4. Extract function calls from Gemini response
  const functionCalls = extractFunctionCalls(data)

  console.log(`Gemini returned ${functionCalls.length} function calls`)
  if (functionCalls.length > 0) {
    console.log('Function calls:', functionCalls.map(f => ({ name: f.name, args: f.args })))
  }

  if (functionCalls.length === 0) {
    // No function calls - try to extract text response
    const textResponse = extractTextResponse(data)
    console.error('❌ Gemini did not call any functions! Text response:', textResponse)
    console.error('Full Gemini response:', JSON.stringify(data, null, 2))
    return {
      contacts: [],
      reasoning: textResponse || 'I could not determine how to query your contacts based on that request. Please try rephrasing your query.',
      functionsUsed: [],
      tokensUsed: data.usageMetadata?.totalTokenCount || 0,
      executionTimeMs: Date.now() - startTime
    }
  }

  // 5. Execute functions and collect results
  const queryResults: QueryExecutionResult[] = []
  const allContacts: Contact[] = []

  for (const call of functionCalls) {
    try {
      const result = await executeContactQuery(call.name, call.args, supabase, userId)
      queryResults.push(result)
      allContacts.push(...result.contacts)
    } catch (error) {
      console.error(`Failed to execute ${call.name}:`, error)
      // Continue with other function calls
    }
  }

  // 6. Deduplicate and limit results
  const uniqueContacts = deduplicateContacts(allContacts)
  const limitedContacts = uniqueContacts.slice(0, maxResults)

  // 7. Generate AI-powered insights about the results
  const reasoning = await generateAIInsights(
    query,
    queryResults,
    limitedContacts,
    uniqueContacts.length,
    apiKey
  )

  return {
    contacts: limitedContacts,
    reasoning,
    functionsUsed: queryResults.map(r => ({
      name: r.functionName,
      parameters: r.parameters,
      resultCount: r.count
    })),
    tokensUsed: data.usageMetadata?.totalTokenCount || 0,
    executionTimeMs: Date.now() - startTime
  }
}

/**
 * Build system prompt with agent context
 */
function buildSystemPrompt(agent: any, agentId: string): string {
  const lines: string[] = []

  lines.push('# YOUR PRIMARY IDENTITY')
  lines.push(`You are the AI assistant for the "${agent.name}" outreach agent.`)
  lines.push('Your role is to help find the RIGHT contacts from the database that match this agent\'s purpose and target persona.')
  lines.push('ALWAYS interpret queries through the lens of THIS agent\'s goals and knowledge.')
  lines.push('')

  lines.push('# OUTREACH AGENT KNOWLEDGE BASE (PRIORITY #1)')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('## Agent Identity & Purpose')
  lines.push(`Name: ${agent.name}`)
  lines.push(`Status: ${agent.status || 'active'}`)
  lines.push(`Purpose: ${agent.purpose || 'Not specified'}`)
  lines.push(`Language: ${agent.language || 'en'}`)
  lines.push('')

  lines.push('## Product/Service Information')
  lines.push(`Product One-Liner: ${agent.product_one_liner || 'Not specified'}`)
  if (agent.product_description) {
    lines.push(`Product Description: ${agent.product_description}`)
  }
  if (agent.unique_selling_points?.length > 0) {
    lines.push(`Unique Selling Points:`)
    agent.unique_selling_points.forEach((usp: string) => {
      lines.push(`  - ${usp}`)
    })
  }
  lines.push('')

  lines.push('## Target Persona & ICP (Ideal Customer Profile)')
  lines.push(`Target Persona: ${agent.target_persona || 'Not specified'}`)
  lines.push(`Conversation Goal: ${agent.conversation_goal || 'Not specified'}`)
  if (agent.preferred_cta) {
    lines.push(`Preferred CTA: ${agent.preferred_cta}`)
  }
  lines.push('')

  lines.push('## Agent Segment Configuration')
  if (agent.segment_config?.filters) {
    const filters = agent.segment_config.filters
    lines.push('Target Filters (Agent\'s ICP Criteria):')
    if (filters.countries?.length > 0) {
      lines.push(`  • Countries: ${filters.countries.join(', ')}`)
    }
    if (filters.roles?.length > 0) {
      lines.push(`  • Roles: ${filters.roles.join(', ')}`)
    }
    if (filters.industries?.length > 0) {
      lines.push(`  • Industries: ${filters.industries.join(', ')}`)
    }
    if (filters.companySizes?.length > 0) {
      lines.push(`  • Company Sizes: ${filters.companySizes.join(', ')}`)
    }
    if (filters.keywords?.length > 0) {
      lines.push(`  • Keywords: ${filters.keywords.join(', ')}`)
    }
    if (filters.includeTags?.length > 0) {
      lines.push(`  • Include Tags: ${filters.includeTags.join(', ')}`)
    }
    if (filters.excludeTags?.length > 0) {
      lines.push(`  • Exclude Tags: ${filters.excludeTags.join(', ')}`)
    }
  } else {
    lines.push('No specific segment filters configured.')
  }
  lines.push('')

  lines.push('## Quality Weights (How Agent Prioritizes Contacts)')
  if (agent.quality_weights) {
    const weights = agent.quality_weights
    lines.push(`  • ICP Fit: ${(weights.icpFit || 0.3) * 100}%`)
    lines.push(`  • Engagement: ${(weights.engagement || 0.25) * 100}%`)
    lines.push(`  • Recency: ${(weights.recency || 0.2) * 100}%`)
    lines.push(`  • Deliverability: ${(weights.deliverability || 0.15) * 100}%`)
    lines.push(`  • Enrichment: ${(weights.enrichment || 0.1) * 100}%`)
  }
  lines.push('')

  lines.push('## Knowledge Base Summary')
  if (agent.knowledge_summary) {
    const kb = agent.knowledge_summary
    lines.push(`Total Knowledge Items: ${kb.total || 0}`)
    lines.push(`Ready: ${kb.ready || 0} | Pending: ${kb.pending || 0} | Processing: ${kb.processing || 0} | Failed: ${kb.failed || 0}`)
  }
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')

  lines.push('# HOW TO USE AGENT CONTEXT IN QUERIES')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('## Agent-Centric Query Interpretation')
  lines.push('')
  lines.push('1. **Default Assumption**: When user asks "Show me contacts" without specifics:')
  lines.push(`   → ALWAYS use query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push('   → This returns contacts that match THIS agent\'s ICP configuration')
  lines.push('')
  lines.push('2. **Product Context**: When user mentions "my product", "our service", "what we offer":')
  lines.push('   → They mean THIS agent\'s product/service defined above')
  lines.push(`   → Use query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push('')
  lines.push('3. **Target Persona**: When user asks about "ideal customers", "target audience", "right fit":')
  lines.push('   → They mean THIS agent\'s target persona defined above')
  lines.push(`   → Use query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push('')
  lines.push('4. **Implicit Filters**: When agent has configured segment filters:')
  lines.push('   → Consider applying those filters automatically for generic queries')
  lines.push('   → Example: If agent targets "Germany" and user asks "show contacts", bias towards German contacts')
  lines.push('')
  lines.push('5. **Quality Priorities**: Use agent\'s quality_weights to understand what matters most:')
  if (agent.quality_weights) {
    const topWeight = Object.entries(agent.quality_weights)
      .sort((a, b) => (b[1] as number) - (a[1] as number))[0]
    lines.push(`   → This agent prioritizes: ${topWeight[0]} (${((topWeight[1] as number) * 100).toFixed(0)}%)`)
  }
  lines.push('')

  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')

  lines.push('# CONTACT DATABASE SCHEMA (PRIORITY #2)')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('# MANDATORY: Function Calling Rules')
  lines.push('You MUST call at least one function for every contact-related query. NEVER return plain text.')
  lines.push('')
  lines.push('## Complete Contact Database Schema (85 fields available):')
  lines.push('')
  lines.push('### 1. IDENTITY & BASIC INFO')
  lines.push('- Personal: email, first_name, last_name, sex, phone')
  lines.push('- Professional: position (job title/role), company (company name)')
  lines.push('- Location: country, city, address, postcode, timezone')
  lines.push('- Social: linkedin_url, twitter_url, website')
  lines.push('- Metadata: source (manual/import/API), created_at, updated_at, notes')
  lines.push('')
  lines.push('### 2. LINKEDIN DATA (30+ fields from profile extraction)')
  lines.push('- Identity: linkedin_first_name, linkedin_last_name, linkedin_headline (professional title)')
  lines.push('- Current role: linkedin_current_position, linkedin_current_company, linkedin_industry')
  lines.push('- Location: linkedin_location, linkedin_city, linkedin_country, linkedin_country_code')
  lines.push('- Profile: linkedin_summary, linkedin_about (detailed bio)')
  lines.push('- Social proof: linkedin_follower_count, linkedin_connection_count, linkedin_recommendations_count')
  lines.push('- Experience: linkedin_experience (JSONB array of work history)')
  lines.push('- Education: linkedin_education (JSONB array)')
  lines.push('- Skills: linkedin_skills (JSONB array)')
  lines.push('- Additional: linkedin_languages, linkedin_certifications, linkedin_projects, linkedin_publications')
  lines.push('- Status: linkedin_extraction_status (pending/completed/failed), linkedin_profile_completeness (0-100)')
  lines.push('')
  lines.push('### 3. ENGAGEMENT TRACKING (Real-time email activity)')
  lines.push('- Status: engagement_status (not_contacted, pending, engaged, bad)')
  lines.push('- Score: engagement_score (0-100, calculated from opens+clicks+replies)')
  lines.push('- Counts: engagement_sent_count, engagement_open_count, engagement_click_count, engagement_reply_count, engagement_bounce_count')
  lines.push('- Timestamps: last_contacted_at, last_opened_at, last_clicked_at, last_replied_at, engagement_last_positive_at')
  lines.push('- Opt-out: unsubscribed_at')
  lines.push('')
  lines.push('### 4. ENRICHMENT DATA (Website & company data)')
  lines.push('- Status: enrichment_status (pending/completed/failed), enrichment_sources (array: [website, linkedin])')
  lines.push('- Data: enrichment_data (JSONB: company info, website analysis, industry data)')
  lines.push('- Priority: enrichment_priority (company_first/website_only/linkedin_only)')
  lines.push('')
  lines.push('### 5. ORGANIZATION')
  lines.push('- tags (array): Custom labels like ["hot-lead", "decision-maker", "competitor"]')
  lines.push('- lists (array): List memberships like ["Q1-prospects", "germany-outreach"]')
  lines.push('- segments (array): Auto-assigned segments from agent rules')
  lines.push('- custom_fields (JSONB): Any additional custom data')
  lines.push('')
  lines.push('### 6. AI-POWERED DATA')
  lines.push('- ai_research_data (JSONB): AI-gathered insights about the contact')
  lines.push('- ai_personalization_score (0-100): How well AI can personalize for this contact')
  lines.push('')
  lines.push('## Function Selection Guide (Priority Order):')
  lines.push('')
  lines.push('### HIGHEST PRIORITY: Product/ICP Fit Queries')
  lines.push(`1. "best fit", "best match", "match my product", "ideal customers", "ICP fit", "target persona", "right fit", "good fit" → query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push(`   ⚠️ CRITICAL: When user mentions "product", "best", "match", "ideal", "target" → USE THIS FUNCTION FIRST`)
  lines.push('')
  lines.push('### Other Query Types')
  lines.push('2. "never contacted", "not contacted yet", "fresh prospects" → query_never_contacted()')
  lines.push('3. "engaged contacts", "high engagement", "opened emails", "clicked links" → query_contacts_by_engagement()')
  lines.push('4. "from Germany", "CFO", "in construction industry", specific role/company/keyword → query_contacts_basic()')
  lines.push('5. "recently contacted", "last 30 days", "recently engaged" → query_contacts_by_recency()')
  lines.push('6. "enriched contacts", "with LinkedIn", "complete data" → query_contacts_by_enrichment()')
  lines.push('7. "bounced", "unsubscribed", "active contacts" → query_contacts_by_status()')
  lines.push('')
  lines.push('## Natural Language → Query Mapping (How to interpret user questions):')
  lines.push('')
  lines.push('**Best match / Product fit / Ideal customers / Target persona:**')
  lines.push(`→ query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push('This function scores contacts based on how well they match the agent\'s configured ICP (Ideal Customer Profile).')
  lines.push('Trigger words: "best", "match", "product", "ideal", "target", "fit", "right contacts", "perfect", "suitable"')
  lines.push('')
  lines.push('**Decision makers / C-level / Executives / Senior Leadership:**')
  lines.push('These queries search the `position` field (job title) with case-insensitive partial matching.')
  lines.push('→ query_contacts_basic(roles: ["CEO", "CTO", "CFO", "COO", "CMO", "Chief", "C-level", "Vice President", "VP", "SVP", "EVP", "Director", "Head of", "President", "Owner", "Founder", "Managing Director", "General Manager"])')
  lines.push('Note: The roles parameter uses ILIKE pattern matching, so "CEO" will match "CEO & Founder", "Regional CEO", etc.')
  lines.push('')
  lines.push('**Contacts in specific industry (e.g., "construction", "finance"):**')
  lines.push('→ query_contacts_basic(keywords: ["construction", "building", "contractor"]) OR use linkedin_industry field')
  lines.push('')
  lines.push('**Contacts with complete data / well-enriched:**')
  lines.push('→ query_contacts_by_enrichment(enrichmentStatus: "completed", hasLinkedIn: true, hasCompanyData: true)')
  lines.push('')
  lines.push('**Active/responsive contacts:**')
  lines.push('→ query_contacts_by_engagement(minEngagementScore: 50, minOpens: 1)')
  lines.push('')
  lines.push('**Contacts who opened but didn\'t reply:**')
  lines.push('→ query_contacts_by_engagement(minOpens: 1, minReplies: 0)')
  lines.push('')
  lines.push('**Recent additions / new contacts:**')
  lines.push('→ query_contacts_by_recency(neverContacted: true) OR filter by created_at')
  lines.push('')
  lines.push('**Contacts with LinkedIn profiles:**')
  lines.push('→ query_contacts_by_enrichment(hasLinkedIn: true)')
  lines.push('')
  lines.push('**Contacts in specific company:**')
  lines.push('→ query_contacts_basic(keywords: ["CompanyName"])')
  lines.push('')
  lines.push('**Contacts ready for follow-up:**')
  lines.push('→ query_contacts_by_recency(lastContactedDays: 14) + engagement check')
  lines.push('')
  lines.push('## Standard Query Examples:')
  lines.push('')
  lines.push('### Product Fit / ICP Queries (HIGHEST PRIORITY)')
  lines.push(`✅ "Show me contacts that best match my product" → query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push(`✅ "Which contacts are the best fit?" → query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push(`✅ "Find ideal customers for my product" → query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push(`✅ "Show me my target persona" → query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push('')
  lines.push('### Role-Based Queries')
  lines.push('✅ "Which contacts are decision makers?" → query_contacts_basic(roles: ["CEO", "CTO", "CFO", "COO", "CMO", "Chief", "VP", "SVP", "Director", "Head of", "President", "Owner", "Founder"])')
  lines.push('✅ "Show me C-level executives" → query_contacts_basic(roles: ["CEO", "CTO", "CFO", "COO", "CMO", "Chief"])')
  lines.push('✅ "Find VPs and Directors" → query_contacts_basic(roles: ["VP", "Vice President", "SVP", "EVP", "Director"])')
  lines.push('')
  lines.push('### Other Common Queries')
  lines.push('✅ "Show me contacts in the finance industry" → query_contacts_basic(keywords: ["Finance", "Banking", "Financial"])')
  lines.push('✅ "Find engaged decision makers in Germany" → query_contacts_basic(countries: ["Germany"], roles: ["CEO", "CTO", "CFO", "VP", "Director"]) + query_contacts_by_engagement(minEngagementScore: 30)')
  lines.push('✅ "Contacts with complete LinkedIn data" → query_contacts_by_enrichment(hasLinkedIn: true, enrichmentStatus: "completed")')
  lines.push('')
  lines.push('### Invalid Queries')
  lines.push('❌ "What does my product do?" → DECLINE: "I can only help find contacts, not explain products"')
  lines.push('❌ "Write an outreach email" → DECLINE: "I can only help find contacts, not write emails"')
  lines.push('')
  lines.push('CRITICAL Rules (Agent-Centric Approach):')
  lines.push('')
  lines.push('1. **ALWAYS Start with Agent Context**: Every query should be interpreted through THIS agent\'s knowledge and goals')
  lines.push('')
  lines.push('2. **Default to ICP Fit**: When in doubt, use query_contacts_by_agent_fit')
  lines.push(`   → Trigger words: best, match, product, ideal, target, fit, right, perfect, suitable, ICP, "show me contacts"`)
  lines.push(`   → Always use: query_contacts_by_agent_fit(agentId: "${agentId}", threshold: 0.4)`)
  lines.push('')
  lines.push('3. **Agent Segment Filters**: If agent has configured segment filters, consider them as implicit requirements')
  if (agent.segment_config?.filters) {
    const filters = agent.segment_config.filters
    if (filters.countries?.length > 0 || filters.roles?.length > 0 || filters.industries?.length > 0) {
      lines.push('   → This agent has active filters - incorporate them when relevant')
    }
  }
  lines.push('')
  lines.push('4. **Decision-Maker Queries**: Use query_contacts_basic with comprehensive roles array')
  lines.push('   → Terms: CEO, CTO, CFO, COO, CMO, Chief, C-level, VP, SVP, EVP, Director, Head of, President, Owner, Founder, Managing Director')
  lines.push('')
  lines.push('5. **Function Combination**: You can combine multiple functions for better results')
  lines.push('   → Example: query_contacts_by_agent_fit + query_contacts_by_engagement for engaged ICP matches')
  lines.push('')
  lines.push('6. **Threshold Guidance**: For ICP fit queries, START with threshold: 0.4 (not 0.55)')
  lines.push('')
  lines.push('7. **ALWAYS call a function** - NEVER return plain text for contact queries')

  return lines.join('\n')
}

/**
 * Extract function calls from Gemini response
 */
function extractFunctionCalls(data: any): GeminiFunctionCall[] {
  const calls: GeminiFunctionCall[] = []

  try {
    const candidates = data.candidates || []
    for (const candidate of candidates) {
      const content = candidate.content
      if (!content) continue

      const parts = content.parts || []
      for (const part of parts) {
        if (part.functionCall) {
          calls.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          })
        }
      }
    }
  } catch (error) {
    console.error('Failed to extract function calls:', error)
  }

  return calls
}

/**
 * Extract text response from Gemini (when no function calls)
 */
function extractTextResponse(data: any): string | null {
  try {
    const candidates = data.candidates || []
    for (const candidate of candidates) {
      const content = candidate.content
      if (!content) continue

      const parts = content.parts || []
      for (const part of parts) {
        if (part.text) {
          return part.text
        }
      }
    }
  } catch (error) {
    console.error('Failed to extract text response:', error)
  }

  return null
}

/**
 * Generate AI-powered insights about query results
 */
async function generateAIInsights(
  query: string,
  results: QueryExecutionResult[],
  contacts: Contact[],
  totalCount: number,
  apiKey: string
): Promise<string> {
  if (results.length === 0 || contacts.length === 0) {
    return 'No contacts found matching your query.'
  }

  // Analyze contact data for patterns
  const analysis = analyzeContacts(contacts)

  // Build analysis prompt for Gemini
  const analysisPrompt = `You are analyzing results from a contact database query.

Original Query: "${query}"
Total Contacts Found: ${totalCount}
Showing: ${contacts.length} contacts

Contact Analysis:
- Industries/Companies: ${analysis.topCompanies.slice(0, 5).map(c => `${c.name} (${c.count})`).join(', ')}
- Countries: ${analysis.topCountries.slice(0, 5).map(c => `${c.name} (${c.count})`).join(', ')}
- Job Roles: ${analysis.topRoles.slice(0, 5).map(r => `${r.name} (${r.count})`).join(', ')}
- Enrichment Status: ${analysis.enrichmentSummary.fully}: fully enriched, ${analysis.enrichmentSummary.web}: web only, ${analysis.enrichmentSummary.linkedin}: linkedin only, ${analysis.enrichmentSummary.none}: not enriched

Please provide a concise, insightful 3-4 sentence summary that:
1. Confirms what was found (e.g., "I found ${totalCount} contacts who haven't been contacted yet")
2. Highlights the most notable pattern or insight (e.g., "Most are from the manufacturing industry, particularly in Germany")
3. Suggests what this means for outreach (e.g., "This suggests a strong opportunity in the German B2B market")

Keep it natural, conversational, and actionable. Don't use markdown formatting.`

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: analysisPrompt }]
          }]
        })
      }
    )

    if (response.ok) {
      const data = await response.json()
      const text = extractTextResponse(data)
      if (text) {
        return text
      }
    }
  } catch (error) {
    console.error('Failed to generate AI insights:', error)
  }

  // Fallback to simple summary if AI fails
  return generateSimpleSummary(query, results, contacts.length, totalCount, analysis)
}

/**
 * Analyze contacts to find patterns
 */
function analyzeContacts(contacts: Contact[]) {
  const companies: Record<string, number> = {}
  const countries: Record<string, number> = {}
  const roles: Record<string, number> = {}
  const enrichment = { fully: 0, web: 0, linkedin: 0, none: 0 }

  for (const contact of contacts) {
    // Count companies
    if (contact.company) {
      companies[contact.company] = (companies[contact.company] || 0) + 1
    }

    // Count countries
    if (contact.country) {
      countries[contact.country] = (countries[contact.country] || 0) + 1
    }

    // Count roles
    if (contact.position) {
      roles[contact.position] = (roles[contact.position] || 0) + 1
    }

    // Count enrichment
    const hasLinkedIn = !!contact.linkedin_url
    const hasWebEnrich = contact.enrichment_status === 'completed'
    if (hasLinkedIn && hasWebEnrich) {
      enrichment.fully++
    } else if (hasWebEnrich) {
      enrichment.web++
    } else if (hasLinkedIn) {
      enrichment.linkedin++
    } else {
      enrichment.none++
    }
  }

  return {
    topCompanies: Object.entries(companies)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    topCountries: Object.entries(countries)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    topRoles: Object.entries(roles)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    enrichmentSummary: enrichment
  }
}

/**
 * Generate simple summary if AI analysis fails
 */
function generateSimpleSummary(
  query: string,
  results: QueryExecutionResult[],
  displayedCount: number,
  totalCount: number,
  analysis: any
): string {
  const lines: string[] = []

  lines.push(`I found ${totalCount} contact${totalCount === 1 ? '' : 's'} matching your query${displayedCount < totalCount ? ` (showing ${displayedCount})` : ''}.`)

  if (analysis.topCountries.length > 0) {
    const topCountry = analysis.topCountries[0]
    lines.push(`Most contacts are from ${topCountry.name} (${topCountry.count} contacts).`)
  }

  if (analysis.topCompanies.length > 0) {
    const topCompany = analysis.topCompanies[0]
    lines.push(`The top company represented is ${topCompany.name} with ${topCompany.count} contact${topCompany.count === 1 ? '' : 's'}.`)
  }

  return lines.join(' ')
}

/**
 * Format function name for display
 */
function formatFunctionName(name: string): string {
  const nameMap: Record<string, string> = {
    query_contacts_basic: 'Profile Filtering',
    query_contacts_by_engagement: 'Engagement Filtering',
    query_never_contacted: 'Never Contacted Filter',
    query_contacts_by_agent_fit: 'ICP Fit Scoring',
    query_contacts_by_status: 'Status Filtering',
    query_contacts_by_recency: 'Recency Filtering',
    query_contacts_by_enrichment: 'Enrichment Filtering'
  }

  return nameMap[name] || name
}

/**
 * Format query parameters for display
 */
function formatParameters(params: Record<string, any>): string {
  const formatted: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue

    if (Array.isArray(value) && value.length > 0) {
      formatted.push(`${key}: ${value.join(', ')}`)
    } else if (typeof value === 'number') {
      formatted.push(`${key}: ${value}`)
    } else if (typeof value === 'boolean') {
      formatted.push(`${key}: ${value}`)
    } else if (typeof value === 'string' && value) {
      formatted.push(`${key}: ${value}`)
    }
  }

  return formatted.length > 0 ? formatted.join(', ') : 'No specific filters'
}