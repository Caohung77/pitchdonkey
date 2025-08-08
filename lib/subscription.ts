import { z } from 'zod'
// import Stripe from 'stripe' // TODO: Install stripe package

// Subscription interfaces
export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  intervalCount: number
  features: string[]
  limits: PlanLimits
  stripePriceId: string
  trialDays?: number
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
  sequences: number
  aiPersonalization: boolean
  advancedAnalytics: boolean
  prioritySupport: boolean
}

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  plan?: SubscriptionPlan
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'incomplete'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialStart?: string
  trialEnd?: string
  createdAt: string
  updatedAt: string
}

export interface UsageMetrics {
  id: string
  userId: string
  period: string // YYYY-MM format
  emailsSent: number
  contactsAdded: number
  campaignsCreated: number
  sequencesCreated: number
  aiPersonalizationsUsed: number
  createdAt: string
  updatedAt: string
}

export interface BillingRecord {
  id: string
  subscriptionId: string
  stripeInvoiceId: string
  period: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed'
  description: string
  createdAt: string
}

// Validation schemas
const planLimitsSchema = z.object({
  emailAccounts: z.number().min(1),
  contacts: z.number().min(1),
  emailsPerMonth: z.number().min(1),
  campaigns: z.number().min(1),
  sequences: z.number().min(1),
  aiPersonalization: z.boolean(),
  advancedAnalytics: z.boolean(),
  prioritySupport: z.boolean()
})

const subscriptionPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  price: z.number().min(0),
  currency: z.string().length(3),
  interval: z.enum(['month', 'year']),
  intervalCount: z.number().min(1).max(12),
  features: z.array(z.string()),
  limits: planLimitsSchema,
  stripePriceId: z.string().min(1),
  trialDays: z.number().min(0).max(365).optional(),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().default(true)
})

// TODO: Enable when Stripe is installed
export class SubscriptionManager {
  constructor(supabaseClient?: any, redisClient?: any) {
    // Stub implementation
  }
  
  async getPlans() { throw new Error('Stripe not installed') }
  async getPlan() { throw new Error('Stripe not installed') }
  async createPlan() { throw new Error('Stripe not installed') }
  async getUserSubscription() { throw new Error('Stripe not installed') }
  async createSubscription() { throw new Error('Stripe not installed') }
  async changePlan() { throw new Error('Stripe not installed') }
  async cancelSubscription() { throw new Error('Stripe not installed') }
  async reactivateSubscription() { throw new Error('Stripe not installed') }
  async updateUsage() { throw new Error('Stripe not installed') }
  async checkLimits() { throw new Error('Stripe not installed') }
  async getBillingHistory() { throw new Error('Stripe not installed') }
  async handleStripeWebhook() { throw new Error('Stripe not installed') }
}

// Export default instance
export const subscriptionManager = new SubscriptionManager()