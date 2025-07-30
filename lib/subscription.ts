import { z } from 'zod'
import Stripe from 'stripe'

// Subscription interfaces
export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number // in cents
  currency: string
  interval: 'month' | 'year'
  features: string[]
  limits: PlanLimits
  stripePriceId: string
  isPopular?: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlanLimits {
  emailAccounts: number
  contacts: number
  emailsPerMonth: number
  campaigns: number
  aiPersonalizations: number
  teamMembers: number
  customDomains: number
  apiCalls: number
  storage: number // in GB
  features: {
    abTesting: boolean
    advancedAnalytics: boolean
    customBranding: boolean
    prioritySupport: boolean
    webhooks: boolean
    sso: boolean
    whiteLabel: boolean
  }
}

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'incomplete'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt?: string
  trialStart?: string
  trialEnd?: string
  usage: UsageMetrics
  billingHistory: BillingRecord[]
  createdAt: string
  updatedAt: string
}

export interface UsageMetrics {
  period: string // YYYY-MM format
  emailAccounts: number
  contacts: number
  emailsSent: number
  campaigns: number
  aiPersonalizations: number
  teamMembers: number
  customDomains: number
  apiCalls: number
  storageUsed: number // in GB
  lastUpdated: string
}

export interface BillingRecord {
  id: string
  subscriptionId: string
  stripeInvoiceId: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  description: string
  periodStart: string
  periodEnd: string
  paidAt?: string
  createdAt: string
}

export interface PlanChangeRequest {
  userId: string
  currentPlanId: string
  newPlanId: string
  changeType: 'upgrade' | 'downgrade'
  effectiveDate: string
  prorationAmount?: number
  reason?: string
}

// Validation schemas
const planLimitsSchema = z.object({
  emailAccounts: z.number().min(1),
  contacts: z.number().min(1),
  emailsPerMonth: z.number().min(1),
  campaigns: z.number().min(1),
  aiPersonalizations: z.number().min(0),
  teamMembers: z.number().min(1),
  customDomains: z.number().min(0),
  apiCalls: z.number().min(0),
  storage: z.number().min(1),
  features: z.object({
    abTesting: z.boolean(),
    advancedAnalytics: z.boolean(),
    customBranding: z.boolean(),
    prioritySupport: z.boolean(),
    webhooks: z.boolean(),
    sso: z.boolean(),
    whiteLabel: z.boolean()
  })
})

const subscriptionPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().min(0),
  currency: z.string().length(3),
  interval: z.enum(['month', 'year']),
  features: z.array(z.string()),
  limits: planLimitsSchema,
  stripePriceId: z.string().min(1),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().default(true)
})

/**
 * Subscription management system
 */
export class SubscriptionManager {
  private supabase: any
  private stripe: Stripe
  private redis: any

  constructor(supabaseClient?: any, redisClient?: any) {
    this.supabase = supabaseClient
    this.redis = redisClient
    
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    })
  }

  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data: plans, error } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })

      if (error) throw error

      return plans || []

    } catch (error) {
      console.error('Error getting subscription plans:', error)
      throw error
    }
  }

  /**
   * Get a specific subscription plan
   */
  async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    try {
      const { data: plan, error } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }

      return plan

    } catch (error) {
      console.error('Error getting subscription plan:', error)
      throw error
    }
  }

  /**
   * Create a new subscription plan
   */
  async createPlan(planData: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    try {
      // Validate plan data
      const validatedData = subscriptionPlanSchema.parse(planData)

      // Create Stripe price if not exists
      let stripePriceId = planData.stripePriceId
      if (!stripePriceId) {
        const stripePrice = await this.stripe.prices.create({
          unit_amount: planData.price,
          currency: planData.currency,
          recurring: {
            interval: planData.interval
          },
          product_data: {
            name: planData.name,
            description: planData.description
          }
        })
        stripePriceId = stripePrice.id
      }

      // Store in database
      const { data: plan, error } = await this.supabase
        .from('subscription_plans')
        .insert({
          ...validatedData,
          stripe_price_id: stripePriceId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return plan

    } catch (error) {
      console.error('Error creating subscription plan:', error)
      throw error
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const { data: subscription, error } = await this.supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }

      return subscription

    } catch (error) {
      console.error('Error getting user subscription:', error)
      throw error
    }
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId?: string,
    trialDays?: number
  ): Promise<UserSubscription> {
    try {
      // Get plan details
      const plan = await this.getPlan(planId)
      if (!plan) {
        throw new Error('Subscription plan not found')
      }

      // Get or create Stripe customer
      const stripeCustomer = await this.getOrCreateStripeCustomer(userId)

      // Attach payment method if provided
      if (paymentMethodId) {
        await this.stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomer.id
        })

        // Set as default payment method
        await this.stripe.customers.update(stripeCustomer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        })
      }

      // Create Stripe subscription
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomer.id,
        items: [{ price: plan.stripePriceId }],
        metadata: {
          userId,
          planId
        }
      }

      if (trialDays && trialDays > 0) {
        subscriptionParams.trial_period_days = trialDays
      }

      const stripeSubscription = await this.stripe.subscriptions.create(subscriptionParams)

      // Store subscription in database
      const { data: subscription, error } = await this.supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: stripeCustomer.id,
          status: stripeSubscription.status,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
          trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
          usage: this.initializeUsageMetrics(),
          billing_history: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return subscription

    } catch (error) {
      console.error('Error creating subscription:', error)
      throw error
    }
  }

  /**
   * Change user's subscription plan
   */
  async changePlan(
    userId: string,
    newPlanId: string,
    prorationBehavior: 'create_prorations' | 'none' = 'create_prorations'
  ): Promise<UserSubscription> {
    try {
      // Get current subscription
      const currentSubscription = await this.getUserSubscription(userId)
      if (!currentSubscription) {
        throw new Error('No active subscription found')
      }

      // Get new plan
      const newPlan = await this.getPlan(newPlanId)
      if (!newPlan) {
        throw new Error('New subscription plan not found')
      }

      // Update Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.update(
        currentSubscription.stripeSubscriptionId,
        {
          items: [{
            id: (await this.stripe.subscriptions.retrieve(currentSubscription.stripeSubscriptionId)).items.data[0].id,
            price: newPlan.stripePriceId
          }],
          proration_behavior: prorationBehavior
        }
      )

      // Update database
      const { data: updatedSubscription, error } = await this.supabase
        .from('user_subscriptions')
        .update({
          plan_id: newPlanId,
          status: stripeSubscription.status,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id)
        .select()
        .single()

      if (error) throw error

      // Log plan change
      await this.logPlanChange(userId, currentSubscription.planId, newPlanId)

      return updatedSubscription

    } catch (error) {
      console.error('Error changing subscription plan:', error)
      throw error
    }
  }

  /**
   * Cancel user's subscription
   */
  async cancelSubscription(
    userId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<UserSubscription> {
    try {
      // Get current subscription
      const currentSubscription = await this.getUserSubscription(userId)
      if (!currentSubscription) {
        throw new Error('No active subscription found')
      }

      // Update Stripe subscription
      let stripeSubscription
      if (cancelAtPeriodEnd) {
        stripeSubscription = await this.stripe.subscriptions.update(
          currentSubscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
            metadata: {
              cancellation_reason: reason || 'User requested'
            }
          }
        )
      } else {
        stripeSubscription = await this.stripe.subscriptions.cancel(
          currentSubscription.stripeSubscriptionId
        )
      }

      // Update database
      const { data: updatedSubscription, error } = await this.supabase
        .from('user_subscriptions')
        .update({
          status: stripeSubscription.status,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          canceled_at: cancelAtPeriodEnd ? null : new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id)
        .select()
        .single()

      if (error) throw error

      return updatedSubscription

    } catch (error) {
      console.error('Error canceling subscription:', error)
      throw error
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(userId: string): Promise<UserSubscription> {
    try {
      // Get current subscription
      const currentSubscription = await this.getUserSubscription(userId)
      if (!currentSubscription) {
        throw new Error('No subscription found')
      }

      if (currentSubscription.status !== 'canceled' && !currentSubscription.cancelAtPeriodEnd) {
        throw new Error('Subscription is not canceled')
      }

      // Update Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.update(
        currentSubscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false
        }
      )

      // Update database
      const { data: updatedSubscription, error } = await this.supabase
        .from('user_subscriptions')
        .update({
          status: stripeSubscription.status,
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id)
        .select()
        .single()

      if (error) throw error

      return updatedSubscription

    } catch (error) {
      console.error('Error reactivating subscription:', error)
      throw error
    }
  }

  /**
   * Update usage metrics for a user
   */
  async updateUsage(userId: string, usageData: Partial<UsageMetrics>): Promise<void> {
    try {
      const currentPeriod = new Date().toISOString().substring(0, 7) // YYYY-MM

      // Get current subscription
      const subscription = await this.getUserSubscription(userId)
      if (!subscription) {
        throw new Error('No active subscription found')
      }

      // Update usage metrics
      const currentUsage = subscription.usage || this.initializeUsageMetrics()
      const updatedUsage = {
        ...currentUsage,
        ...usageData,
        period: currentPeriod,
        lastUpdated: new Date().toISOString()
      }

      // Store in database
      await this.supabase
        .from('user_subscriptions')
        .update({
          usage: updatedUsage,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)

      // Cache usage data in Redis for quick access
      if (this.redis) {
        await this.redis.setex(
          `usage:${userId}:${currentPeriod}`,
          3600, // 1 hour TTL
          JSON.stringify(updatedUsage)
        )
      }

    } catch (error) {
      console.error('Error updating usage:', error)
      throw error
    }
  }

  /**
   * Check if user has exceeded plan limits
   */
  async checkLimits(userId: string): Promise<{
    withinLimits: boolean
    exceededLimits: string[]
    usage: UsageMetrics
    limits: PlanLimits
  }> {
    try {
      // Get subscription and plan
      const subscription = await this.getUserSubscription(userId)
      if (!subscription) {
        throw new Error('No active subscription found')
      }

      const plan = await this.getPlan(subscription.planId)
      if (!plan) {
        throw new Error('Subscription plan not found')
      }

      const usage = subscription.usage || this.initializeUsageMetrics()
      const limits = plan.limits
      const exceededLimits: string[] = []

      // Check each limit
      if (usage.emailAccounts > limits.emailAccounts) {
        exceededLimits.push('emailAccounts')
      }
      if (usage.contacts > limits.contacts) {
        exceededLimits.push('contacts')
      }
      if (usage.emailsSent > limits.emailsPerMonth) {
        exceededLimits.push('emailsPerMonth')
      }
      if (usage.campaigns > limits.campaigns) {
        exceededLimits.push('campaigns')
      }
      if (usage.aiPersonalizations > limits.aiPersonalizations) {
        exceededLimits.push('aiPersonalizations')
      }
      if (usage.teamMembers > limits.teamMembers) {
        exceededLimits.push('teamMembers')
      }
      if (usage.customDomains > limits.customDomains) {
        exceededLimits.push('customDomains')
      }
      if (usage.apiCalls > limits.apiCalls) {
        exceededLimits.push('apiCalls')
      }
      if (usage.storageUsed > limits.storage) {
        exceededLimits.push('storage')
      }

      return {
        withinLimits: exceededLimits.length === 0,
        exceededLimits,
        usage,
        limits
      }

    } catch (error) {
      console.error('Error checking limits:', error)
      throw error
    }
  }

  /**
   * Get billing history for a user
   */
  async getBillingHistory(userId: string, limit: number = 10): Promise<BillingRecord[]> {
    try {
      const subscription = await this.getUserSubscription(userId)
      if (!subscription) {
        return []
      }

      const { data: billingHistory, error } = await this.supabase
        .from('billing_records')
        .select('*')
        .eq('subscription_id', subscription.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return billingHistory || []

    } catch (error) {
      console.error('Error getting billing history:', error)
      throw error
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
          break
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
          break
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice)
          break
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice)
          break
        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    } catch (error) {
      console.error('Error handling Stripe webhook:', error)
      throw error
    }
  }

  // Private helper methods

  private async getOrCreateStripeCustomer(userId: string): Promise<Stripe.Customer> {
    try {
      // Check if customer already exists
      const { data: user, error } = await this.supabase
        .from('users')
        .select('email, stripe_customer_id')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (user.stripe_customer_id) {
        return await this.stripe.customers.retrieve(user.stripe_customer_id) as Stripe.Customer
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: {
          userId
        }
      })

      // Update user record
      await this.supabase
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId)

      return customer

    } catch (error) {
      console.error('Error getting or creating Stripe customer:', error)
      throw error
    }
  }

  private initializeUsageMetrics(): UsageMetrics {
    const currentPeriod = new Date().toISOString().substring(0, 7) // YYYY-MM
    
    return {
      period: currentPeriod,
      emailAccounts: 0,
      contacts: 0,
      emailsSent: 0,
      campaigns: 0,
      aiPersonalizations: 0,
      teamMembers: 1, // User themselves
      customDomains: 0,
      apiCalls: 0,
      storageUsed: 0,
      lastUpdated: new Date().toISOString()
    }
  }

  private async logPlanChange(userId: string, oldPlanId: string, newPlanId: string): Promise<void> {
    try {
      await this.supabase
        .from('plan_changes')
        .insert({
          user_id: userId,
          old_plan_id: oldPlanId,
          new_plan_id: newPlanId,
          change_type: 'manual',
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error logging plan change:', error)
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId
    if (!userId) return

    await this.supabase
      .from('user_subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id)
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id)
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return

    // Record successful payment
    await this.supabase
      .from('billing_records')
      .insert({
        stripe_invoice_id: invoice.id,
        subscription_id: invoice.subscription as string,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        description: invoice.description || 'Subscription payment',
        period_start: new Date(invoice.period_start * 1000).toISOString(),
        period_end: new Date(invoice.period_end * 1000).toISOString(),
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return

    // Record failed payment
    await this.supabase
      .from('billing_records')
      .insert({
        stripe_invoice_id: invoice.id,
        subscription_id: invoice.subscription as string,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        description: invoice.description || 'Subscription payment',
        period_start: new Date(invoice.period_start * 1000).toISOString(),
        period_end: new Date(invoice.period_end * 1000).toISOString(),
        created_at: new Date().toISOString()
      })

    // Update subscription status
    await this.supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)
  }
}

// Export default instance
export const subscriptionManager = new SubscriptionManager()