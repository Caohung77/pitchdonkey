// Demo Supabase client for development
// In a real implementation, this would use actual Supabase

interface User {
  id: string
  email: string
  name: string
  plan: string
}

class MockSupabaseClient {
  auth = {
    getUser: async () => {
      // Check for session cookie
      if (typeof window !== 'undefined') {
        const userInfo = document.cookie
          .split('; ')
          .find(row => row.startsWith('user-info='))
          ?.split('=')[1]

        if (userInfo) {
          try {
            const user = JSON.parse(decodeURIComponent(userInfo))
            return { data: { user }, error: null }
          } catch (error) {
            return { data: { user: null }, error: null }
          }
        }
      }

      // For server-side, we'll assume authenticated for demo
      return {
        data: {
          user: {
            id: 'demo-user-1',
            email: 'demo@coldreachpro.com'
          }
        },
        error: null
      }
    }
  }

  from(table: string) {
    return new MockTable(table)
  }
}

class MockTable {
  private table: string
  private selectFields: string = '*'
  private filters: any[] = []
  private orderBy: any = null
  private limitCount: number | null = null

  constructor(table: string) {
    this.table = table
  }

  select(fields: string = '*') {
    this.selectFields = fields
    return this
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true }
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  async single() {
    const result = await this.execute()
    return {
      data: result.data?.[0] || null,
      error: result.error
    }
  }

  private async execute() {
    // Mock data for different tables
    const mockData = this.getMockData()
    
    return {
      data: mockData,
      error: null
    }
  }

  private getMockData() {
    switch (this.table) {
      case 'users':
        return [{
          id: 'demo-user-1',
          email: 'demo@coldreachpro.com',
          name: 'Demo User',
          plan: 'professional',
          subscription_status: 'active',
          stripe_customer_id: 'cus_demo123'
        }]

      case 'subscription_plans':
        return [
          {
            id: 'starter',
            name: 'Starter',
            price: 4900,
            currency: 'usd',
            interval: 'month',
            is_active: true,
            limits: {
              emailsPerMonth: 2000,
              contactsLimit: 1000,
              campaignsLimit: 3
            }
          },
          {
            id: 'professional', 
            name: 'Professional',
            price: 14900,
            currency: 'usd',
            interval: 'month',
            is_active: true,
            limits: {
              emailsPerMonth: 10000,
              contactsLimit: 10000,
              campaignsLimit: 25
            }
          }
        ]

      case 'user_subscriptions':
        return [{
          id: 'sub-demo-1',
          user_id: 'demo-user-1',
          plan_id: 'professional',
          stripe_subscription_id: 'sub_demo123',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }]

      case 'usage_metrics':
        return [{
          user_id: 'demo-user-1',
          plan_id: 'professional',
          period: new Date().toISOString().slice(0, 7),
          emails_sent: 1250,
          contacts_count: 3500,
          campaigns_count: 8,
          templates_count: 12,
          automations_count: 5,
          team_members_count: 2,
          api_calls_count: 450,
          custom_domains_count: 1
        }]

      case 'campaigns':
        return [
          {
            id: 'camp-1',
            name: 'Q1 Sales Outreach',
            description: 'Targeting enterprise prospects for Q1',
            status: 'active',
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            launched_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'camp-2', 
            name: 'Product Launch Campaign',
            description: 'Announcing our new features',
            status: 'draft',
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]

      case 'email_accounts':
        return [
          {
            id: 'email-1',
            user_id: 'demo-user-1',
            email: 'sales@company.com',
            provider: 'gmail',
            is_active: true,
            warmup_status: 'completed',
            daily_limit: 50,
            connection_status: 'connected'
          },
          {
            id: 'email-2',
            user_id: 'demo-user-1', 
            email: 'outreach@company.com',
            provider: 'outlook',
            is_active: true,
            warmup_status: 'in_progress',
            daily_limit: 30,
            connection_status: 'connected'
          }
        ]

      case 'usage_notifications':
        return [
          {
            id: 'notif-1',
            user_id: 'demo-user-1',
            type: 'usage_warning',
            title: 'Approaching Email Limit',
            message: 'You have used 80% of your monthly email limit',
            is_read: false,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          }
        ]

      default:
        return []
    }
  }
}

export function createClient() {
  return new MockSupabaseClient()
}