import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export interface AITemplate {
  id: string
  user_id: string
  name: string
  description: string
  category: 'cold_outreach' | 'follow_up' | 'introduction' | 'meeting_request' | 'custom'
  content: string
  subject?: string
  subject_template?: string
  variables: string[]
  custom_prompt?: string
  is_default: boolean
  usage_count: number
  created_at: string
  updated_at: string
  // Enhanced campaign fields
  sender_name?: string
  email_purpose?: string
  language?: 'English' | 'German'
  generation_options?: {
    generate_for_all: boolean
    use_contact_info: boolean
  }
  template_type?: string
}

export const DEFAULT_TEMPLATES: Omit<AITemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Cold Outreach - Software Sales',
    description: 'Professional cold outreach template for software sales',
    category: 'cold_outreach',
    content: `Subject: Quick question about {{company_name}}'s {{industry}} operations

Hi {{first_name}},

I hope this email finds you well. I came across {{company_name}} and was impressed by your work in {{industry}}.

I'm reaching out because I believe our solution could help {{company_name}} streamline your operations and increase efficiency by up to 30%.

Would you be open to a brief 15-minute call this week to discuss how we've helped similar companies in {{industry}} achieve their goals?

Best regards,
[Your Name]`,
    variables: ['first_name', 'company_name', 'industry'],
    custom_prompt: 'Focus on the specific industry challenges and how our solution addresses them. Make it conversational and not too salesy.',
    is_default: true,
    usage_count: 0,
  },
  {
    name: 'Follow-up - Meeting Request',
    description: 'Follow-up template for meeting requests',
    category: 'follow_up',
    content: `Subject: Following up on our conversation - {{company_name}}

Hi {{first_name}},

I wanted to follow up on our previous conversation about {{company_name}}'s {{industry}} initiatives.

Based on what you shared about your current challenges, I believe our solution could provide significant value, particularly in:
- [Specific benefit 1]
- [Specific benefit 2]
- [Specific benefit 3]

Would you be available for a 30-minute demo next week? I'd love to show you exactly how we've helped companies like {{company_name}} achieve their goals.

Looking forward to hearing from you.

Best,
[Your Name]`,
    variables: ['first_name', 'company_name', 'industry'],
    custom_prompt: 'Reference specific points from previous conversations and focus on concrete benefits.',
    is_default: true,
    usage_count: 0,
  },
  {
    name: 'Introduction - Warm Referral',
    description: 'Template for warm introductions and referrals',
    category: 'introduction',
    content: `Subject: Introduction from [Referrer Name] - {{company_name}}

Hi {{first_name}},

[Referrer Name] suggested I reach out to you regarding {{company_name}}'s upcoming {{industry}} projects.

I understand you're looking to [specific need/challenge], and I believe our solution could be a perfect fit. We've recently helped [similar company] achieve [specific result].

Would you be interested in a brief conversation to explore how we might be able to help {{company_name}} achieve similar results?

I'm available for a quick call this week at your convenience.

Best regards,
[Your Name]`,
    variables: ['first_name', 'company_name', 'industry'],
    custom_prompt: 'Emphasize the referral connection and focus on specific, relevant results.',
    is_default: true,
    usage_count: 0,
  },
  {
    name: 'Meeting Request - Direct',
    description: 'Direct meeting request template',
    category: 'meeting_request',
    content: `Subject: 15-minute chat about {{company_name}}'s {{industry}} strategy?

Hi {{first_name}},

I've been following {{company_name}}'s growth in the {{industry}} space and I'm impressed by your recent achievements.

I'd love to share how we've helped similar companies in {{industry}} overcome common challenges and accelerate their growth.

Would you be open to a brief 15-minute call this week? I promise to keep it concise and valuable.

You can book a time that works for you here: [calendar link]

Best,
[Your Name]

P.S. If this isn't the right time, I completely understand. Feel free to let me know when might be better.`,
    variables: ['first_name', 'company_name', 'industry'],
    custom_prompt: 'Keep it short, respectful, and focused on their success. Include a clear call-to-action.',
    is_default: true,
    usage_count: 0,
  },
]

export class AITemplateService {
  private supabase = createRouteHandlerClient({ cookies })

  async createTemplate(userId: string, templateData: Partial<AITemplate>) {
    // Extract variables from content
    const variables = this.extractVariables(templateData.content || '')
    
    const { data, error } = await this.supabase
      .from('ai_templates')
      .insert({
        user_id: userId,
        ...templateData,
        variables,
        usage_count: 0,
        is_default: false,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateTemplate(templateId: string, userId: string, updates: Partial<AITemplate>) {
    // Update variables if content changed
    if (updates.content) {
      updates.variables = this.extractVariables(updates.content)
    }

    const { data, error } = await this.supabase
      .from('ai_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteTemplate(templateId: string, userId: string) {
    const { error } = await this.supabase
      .from('ai_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId)
      .eq('is_default', false) // Prevent deletion of default templates

    if (error) throw error
  }

  async getTemplate(templateId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('ai_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  }

  async getUserTemplates(userId: string, category?: string) {
    let query = this.supabase
      .from('ai_templates')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  async incrementUsage(templateId: string, userId: string) {
    // First get the current usage count
    const { data: template, error: fetchError } = await this.supabase
      .from('ai_templates')
      .select('usage_count')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single()

    if (fetchError) throw fetchError

    // Then update with incremented count
    const { error } = await this.supabase
      .from('ai_templates')
      .update({
        usage_count: (template?.usage_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async createDefaultTemplates(userId: string) {
    const templates = DEFAULT_TEMPLATES.map(template => ({
      ...template,
      user_id: userId,
      variables: this.extractVariables(template.content),
    }))

    const { data, error } = await this.supabase
      .from('ai_templates')
      .insert(templates)
      .select()

    if (error) throw error
    return data
  }

  private extractVariables(content: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim()
      if (!variables.includes(variable)) {
        variables.push(variable)
      }
    }

    return variables
  }

  validateTemplate(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!content || content.trim().length === 0) {
      errors.push('Template content cannot be empty')
    }

    if (content.length > 5000) {
      errors.push('Template content is too long (max 5000 characters)')
    }

    // Check for balanced braces
    const openBraces = (content.match(/\{\{/g) || []).length
    const closeBraces = (content.match(/\}\}/g) || []).length
    
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced variable braces - make sure all {{variables}} are properly closed')
    }

    // Check for empty variables
    const emptyVariables = content.match(/\{\{\s*\}\}/g)
    if (emptyVariables) {
      errors.push('Empty variable placeholders found - {{}} should contain variable names')
    }

    // Check for nested variables
    const nestedVariables = content.match(/\{\{[^}]*\{\{[^}]*\}\}[^}]*\}\}/g)
    if (nestedVariables) {
      errors.push('Nested variables are not supported')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  previewTemplate(content: string, variables: Record<string, string>): string {
    let preview = content

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      preview = preview.replace(regex, value || `{{${key}}}`)
    })

    return preview
  }

  async getTemplateStats(userId: string) {
    const { data, error } = await this.supabase
      .from('ai_templates')
      .select('id, name, category, usage_count, is_default, created_at')
      .eq('user_id', userId)

    if (error) throw error

    const stats = {
      total: data?.length || 0,
      custom: data?.filter(t => !t.is_default).length || 0,
      default: data?.filter(t => t.is_default).length || 0,
      by_category: {} as Record<string, number>,
      total_usage: 0,
      most_used: null as { id: string; name: string; usage_count: number } | null,
      least_used: null as { id: string; name: string; usage_count: number } | null,
      recent_templates: [] as Array<{ id: string; name: string; created_at: string }>,
      usage_trend: {
        high_usage: [] as Array<{ id: string; name: string; usage_count: number }>,
        unused: [] as Array<{ id: string; name: string; created_at: string }>
      }
    }

    if (!data || data.length === 0) return stats

    // Calculate category distribution
    data.forEach(template => {
      stats.by_category[template.category] = (stats.by_category[template.category] || 0) + 1
      stats.total_usage += template.usage_count
    })

    // Find most and least used templates
    const sortedByUsage = data.sort((a, b) => b.usage_count - a.usage_count)
    if (sortedByUsage.length > 0) {
      stats.most_used = {
        id: sortedByUsage[0].id,
        name: sortedByUsage[0].name,
        usage_count: sortedByUsage[0].usage_count
      }
      
      const leastUsed = sortedByUsage[sortedByUsage.length - 1]
      stats.least_used = {
        id: leastUsed.id,
        name: leastUsed.name,
        usage_count: leastUsed.usage_count
      }
    }

    // Recent templates (last 5)
    const sortedByDate = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    stats.recent_templates = sortedByDate.slice(0, 5).map(t => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at
    }))

    // Usage trends
    stats.usage_trend.high_usage = sortedByUsage
      .filter(t => t.usage_count > 5)
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        name: t.name,
        usage_count: t.usage_count
      }))

    stats.usage_trend.unused = data
      .filter(t => t.usage_count === 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        name: t.name,
        created_at: t.created_at
      }))

    return stats
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(templateId: string, userId: string, newName?: string) {
    const originalTemplate = await this.getTemplate(templateId, userId)
    if (!originalTemplate) {
      throw new Error('Template not found')
    }

    const duplicatedTemplate = {
      name: newName || `${originalTemplate.name} (Copy)`,
      description: originalTemplate.description,
      category: originalTemplate.category,
      content: originalTemplate.content,
      custom_prompt: originalTemplate.custom_prompt,
    }

    return this.createTemplate(userId, duplicatedTemplate)
  }

  /**
   * Search templates by content or name
   */
  async searchTemplates(userId: string, query: string, options: {
    category?: string
    limit?: number
  } = {}) {
    const { category, limit = 20 } = options

    let queryBuilder = this.supabase
      .from('ai_templates')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,content.ilike.%${query}%`)
      .order('usage_count', { ascending: false })
      .limit(limit)

    if (category) {
      queryBuilder = queryBuilder.eq('category', category)
    }

    const { data, error } = await queryBuilder

    if (error) throw error
    return data || []
  }

  /**
   * Get template suggestions based on usage patterns
   */
  async getTemplateSuggestions(userId: string) {
    const { data, error } = await this.supabase
      .from('ai_templates')
      .select('*')
      .eq('user_id', userId)
      .order('usage_count', { ascending: false })

    if (error) throw error

    const suggestions = {
      most_popular: [] as AITemplate[],
      recently_created: [] as AITemplate[],
      underutilized: [] as AITemplate[],
      by_category: {} as Record<string, AITemplate[]>
    }

    if (!data || data.length === 0) return suggestions

    // Most popular (top 3)
    suggestions.most_popular = data.slice(0, 3)

    // Recently created (last 3)
    const sortedByDate = [...data].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    suggestions.recently_created = sortedByDate.slice(0, 3)

    // Underutilized (usage_count < 2, but not 0)
    suggestions.underutilized = data
      .filter(t => t.usage_count > 0 && t.usage_count < 2)
      .slice(0, 3)

    // Group by category (top template per category)
    const categoryGroups = data.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    }, {} as Record<string, AITemplate[]>)

    Object.keys(categoryGroups).forEach(category => {
      suggestions.by_category[category] = categoryGroups[category]
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 2)
    })

    return suggestions
  }

  /**
   * Bulk operations for templates
   */
  async bulkUpdateTemplates(userId: string, templateIds: string[], updates: Partial<AITemplate>) {
    const { data, error } = await this.supabase
      .from('ai_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .in('id', templateIds)
      .eq('user_id', userId)
      .eq('is_default', false) // Prevent bulk updates to default templates
      .select()

    if (error) throw error
    return data
  }

  async bulkDeleteTemplates(userId: string, templateIds: string[]) {
    const { error } = await this.supabase
      .from('ai_templates')
      .delete()
      .in('id', templateIds)
      .eq('user_id', userId)
      .eq('is_default', false) // Prevent deletion of default templates

    if (error) throw error
  }

  /**
   * Export templates to JSON
   */
  async exportTemplates(userId: string, templateIds?: string[]) {
    let query = this.supabase
      .from('ai_templates')
      .select('name, description, category, content, variables, custom_prompt')
      .eq('user_id', userId)

    if (templateIds && templateIds.length > 0) {
      query = query.in('id', templateIds)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      exported_at: new Date().toISOString(),
      templates: data || [],
      count: data?.length || 0
    }
  }

  /**
   * Import templates from JSON
   */
  async importTemplates(userId: string, templates: Array<Omit<AITemplate, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'usage_count' | 'is_default'>>) {
    const templatesWithDefaults = templates.map(template => ({
      ...template,
      user_id: userId,
      variables: this.extractVariables(template.content),
      usage_count: 0,
      is_default: false,
    }))

    const { data, error } = await this.supabase
      .from('ai_templates')
      .insert(templatesWithDefaults)
      .select()

    if (error) throw error
    return data
  }

  /**
   * Get variable suggestions based on existing templates
   */
  async getVariableSuggestions(userId: string): Promise<{
    common_variables: Array<{ variable: string; usage_count: number }>
    recent_variables: string[]
    category_variables: Record<string, string[]>
  }> {
    const { data, error } = await this.supabase
      .from('ai_templates')
      .select('variables, category, created_at')
      .eq('user_id', userId)
    
    if (error) throw error

        const variableCount: Record<string, number> = {}
        const categoryVariables: Record<string, Set<string>> = {}
        const allVariables: Array<{ variable: string; created_at: string }> = []

        data?.forEach(template => {
          template.variables.forEach((variable: string) => {
            variableCount[variable] = (variableCount[variable] || 0) + 1
            allVariables.push({ variable, created_at: template.created_at })

            if (!categoryVariables[template.category]) {
              categoryVariables[template.category] = new Set()
            }
            categoryVariables[template.category].add(variable)
          })
        })

        // Sort by usage count
        const commonVariables = Object.entries(variableCount)
          .map(([variable, usage_count]) => ({ variable, usage_count }))
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, 10)

        // Get recent variables (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const recentVariables = Array.from(new Set(
          allVariables
            .filter(v => new Date(v.created_at) > thirtyDaysAgo)
            .map(v => v.variable)
        )).slice(0, 10)

        // Convert category variables to arrays
        const categoryVariablesArray: Record<string, string[]> = {}
        Object.entries(categoryVariables).forEach(([category, variables]) => {
          categoryVariablesArray[category] = Array.from(variables)
        })

    return {
      common_variables: commonVariables,
      recent_variables: recentVariables,
      category_variables: categoryVariablesArray
    }
  }
}