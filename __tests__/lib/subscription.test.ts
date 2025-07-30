import { SubscriptionManager } from '../../lib/subscription'
import Stripe from 'stripe'

// Mock Stripe
jest.mock('stripe')
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
    then: jest.fn()
  }))
}

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager
  let mockStripe: jest.Mocked<Stripe>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockStripe = {
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn()
      },
      customers: {
        create: jest.fn(),
        update: jest.fn()
      },
      paymentMethods: {
        attach: jest.fn(),
        retrieve: jest.fn(),
        detach: jest.fn()
      }
    } as any

    MockedStripe.mockImplementation(() => mockStripe)
    subscriptionManager = new SubscriptionManager(mockSupabase, 'test_key')
  })

  describe('getPlans', () => {
    it('should return all active subscription plans', async () => {
      const mockPlans = [
        {
          id: 'starter',
          name: 'Starter',
          price: 4900,
          currency: 'usd',
          interval: 'month',
          is_active: true
        },
        {
          id: 'pro',
          name: 'Professional',
          price: 14900,
          currency: 'usd',
          interval: 'month',
          is_active: true
        }
      ]

      mockSupabase.from().single.mockResolvedValue({ data: mockPlans, error: null })

      const plans = await subscriptionManager.getPlans()

      expect(mockSupabase.from).toHaveBeenCalledWith('subscription_plans')
      expect(plans).toEqual(mockPlans)
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.from().single.mockResolvedValue({ data: null, error: mockError })

      await expect(subscriptionManager.getPlans()).rejects.toThrow('Database error')
    })
  })

  describe('getUserSubscription', () => {
    it('should return user subscription with plan details', async () => {
      const mockSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan_id: 'starter',
        stripe_subscription_id: 'sub_stripe_123',
        status: 'active',
        subscription_plans: {
          name: 'Starter',
          price: 4900
        }
      }

      mockSupabase.from().single.mockResolvedValue({ data: mockSubscription, error: null })

      const subscription = await subscriptionManager.getUserSubscription('user_123')

      expect(mockSupabase.from).toHaveBeenCalledWith('user_subscriptions')
      expect(subscription).toEqual(mockSubscription)
    })

    it('should return null when no subscription found', async () => {
      mockSupabase.from().single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      })

      const subscription = await subscriptionManager.getUserSubscription('user_123')

      expect(subscription).toBeNull()
    })
  })

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      const mockPlan = {
        id: 'starter',
        name: 'Starter',
        stripe_price_id: 'price_123'
      }

      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        stripe_customer_id: null
      }

      const mockStripeCustomer = {
        id: 'cus_123'
      }

      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'trialing',
        current_period_start: 1640995200,
        current_period_end: 1643673600,
        cancel_at_period_end: false,
        trial_end: 1642204800
      }

      const mockSubscription = {
        id: 'sub_db_123',
        user_id: 'user_123',
        plan_id: 'starter',
        stripe_subscription_id: 'sub_123',
        status: 'trialing'
      }

      // Mock database calls
      mockSupabase.from().single
        .mockResolvedValueOnce({ data: mockPlan, error: null }) // Get plan
        .mockResolvedValueOnce({ data: mockUser, error: null }) // Get user
        .mockResolvedValueOnce({ data: mockSubscription, error: null }) // Insert subscription

      // Mock Stripe calls
      mockStripe.customers.create.mockResolvedValue(mockStripeCustomer as any)
      mockStripe.paymentMethods.attach.mockResolvedValue({} as any)
      mockStripe.customers.update.mockResolvedValue({} as any)
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription as any)

      const result = await subscriptionManager.createSubscription(
        'user_123',
        'starter',
        'pm_123',
        {
          line1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'US'
        }
      )

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        address: {
          line1: '123 Main St',
          line2: undefined,
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'US'
        }
      })

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        items: [{ price: 'price_123' }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        trial_period_days: 14
      })

      expect(result).toEqual(mockSubscription)
    })

    it('should throw error when plan not found', async () => {
      mockSupabase.from().single.mockResolvedValue({ data: null, error: new Error('Not found') })

      await expect(
        subscriptionManager.createSubscription('user_123', 'invalid_plan', 'pm_123')
      ).rejects.toThrow('Plan not found')
    })
  })

  describe('updateSubscription', () => {
    it('should update subscription plan successfully', async () => {
      const mockCurrentSub = {
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_123',
        planId: 'starter'
      }

      const mockNewPlan = {
        id: 'pro',
        name: 'Professional',
        stripe_price_id: 'price_456'
      }

      const mockStripeSubscription = {
        id: 'sub_123',
        items: {
          data: [{ id: 'si_123' }]
        }
      }

      const mockUpdatedStripeSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_start: 1640995200,
        current_period_end: 1643673600
      }

      const mockUpdatedSubscription = {
        id: 'sub_db_123',
        plan_id: 'pro',
        status: 'active'
      }

      // Mock getUserSubscription
      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockCurrentSub as any)

      // Mock database calls
      mockSupabase.from().single
        .mockResolvedValueOnce({ data: mockNewPlan, error: null }) // Get new plan
        .mockResolvedValueOnce({ data: mockUpdatedSubscription, error: null }) // Update subscription

      // Mock Stripe calls
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any)
      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedStripeSubscription as any)

      const result = await subscriptionManager.updateSubscription('user_123', 'pro')

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        items: [{
          id: 'si_123',
          price: 'price_456'
        }],
        proration_behavior: 'create_prorations'
      })

      expect(result).toEqual(mockUpdatedSubscription)
    })

    it('should throw error when no active subscription found', async () => {
      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(null)

      await expect(
        subscriptionManager.updateSubscription('user_123', 'pro')
      ).rejects.toThrow('No active subscription found')
    })
  })

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const mockCurrentSub = {
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_123'
      }

      const mockUpdatedStripeSubscription = {
        id: 'sub_123',
        status: 'active',
        cancel_at_period_end: true
      }

      const mockUpdatedSubscription = {
        id: 'sub_db_123',
        status: 'active',
        cancel_at_period_end: true
      }

      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockCurrentSub as any)

      mockSupabase.from().single.mockResolvedValue({ 
        data: mockUpdatedSubscription, 
        error: null 
      })

      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedStripeSubscription as any)

      const result = await subscriptionManager.cancelSubscription('user_123', true)

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true
      })

      expect(result).toEqual(mockUpdatedSubscription)
    })

    it('should cancel subscription immediately', async () => {
      const mockCurrentSub = {
        id: 'sub_db_123',
        stripeSubscriptionId: 'sub_123'
      }

      const mockCanceledStripeSubscription = {
        id: 'sub_123',
        status: 'canceled',
        cancel_at_period_end: false
      }

      const mockUpdatedSubscription = {
        id: 'sub_db_123',
        status: 'canceled',
        cancel_at_period_end: false
      }

      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockCurrentSub as any)

      mockSupabase.from().single.mockResolvedValue({ 
        data: mockUpdatedSubscription, 
        error: null 
      })

      mockStripe.subscriptions.cancel.mockResolvedValue(mockCanceledStripeSubscription as any)

      const result = await subscriptionManager.cancelSubscription('user_123', false)

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123')
      expect(result).toEqual(mockUpdatedSubscription)
    })
  })

  describe('getUsageMetrics', () => {
    it('should return existing usage metrics', async () => {
      const mockUsage = {
        user_id: 'user_123',
        plan_id: 'starter',
        period: '2024-01',
        emails_sent: 150,
        contacts_count: 500,
        campaigns_count: 3
      }

      mockSupabase.from().single.mockResolvedValue({ data: mockUsage, error: null })

      const usage = await subscriptionManager.getUsageMetrics('user_123', '2024-01')

      expect(mockSupabase.from).toHaveBeenCalledWith('usage_metrics')
      expect(usage).toEqual(mockUsage)
    })

    it('should create new usage record if none exists', async () => {
      const mockSubscription = {
        planId: 'starter'
      }

      const mockNewUsage = {
        user_id: 'user_123',
        plan_id: 'starter',
        period: '2024-01',
        emails_sent: 0,
        contacts_count: 0,
        campaigns_count: 0
      }

      mockSupabase.from().single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // No existing usage
        .mockResolvedValueOnce({ data: mockNewUsage, error: null }) // Created usage

      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockSubscription as any)

      const usage = await subscriptionManager.getUsageMetrics('user_123', '2024-01')

      expect(usage).toEqual(mockNewUsage)
    })
  })

  describe('updateUsage', () => {
    it('should increment usage metric', async () => {
      const mockUsage = {
        user_id: 'user_123',
        emails_sent: 100,
        contacts_count: 500
      }

      jest.spyOn(subscriptionManager, 'getUsageMetrics')
        .mockResolvedValue(mockUsage as any)

      mockSupabase.from().single.mockResolvedValue({ data: null, error: null })

      await subscriptionManager.updateUsage('user_123', 'emailsSent', 5)

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        emails_sent: 105,
        last_updated: expect.any(String)
      })
    })
  })

  describe('checkLimits', () => {
    it('should return within limits when usage is below thresholds', async () => {
      const mockSubscription = {
        planId: 'starter'
      }

      const mockUsage = {
        emailsSent: 500,
        contactsCount: 800,
        campaignsCount: 2
      }

      const mockPlan = {
        id: 'starter',
        limits: {
          emailsPerMonth: 1000,
          contactsLimit: 1000,
          campaignsLimit: 5
        }
      }

      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockSubscription as any)
      
      jest.spyOn(subscriptionManager, 'getUsageMetrics')
        .mockResolvedValue(mockUsage as any)

      mockSupabase.from().single.mockResolvedValue({ data: mockPlan, error: null })

      const result = await subscriptionManager.checkLimits('user_123')

      expect(result.withinLimits).toBe(true)
      expect(result.exceededLimits).toEqual([])
    })

    it('should return exceeded limits when usage is above thresholds', async () => {
      const mockSubscription = {
        planId: 'starter'
      }

      const mockUsage = {
        emailsSent: 1200,
        contactsCount: 1100,
        campaignsCount: 2
      }

      const mockPlan = {
        id: 'starter',
        limits: {
          emailsPerMonth: 1000,
          contactsLimit: 1000,
          campaignsLimit: 5
        }
      }

      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockSubscription as any)
      
      jest.spyOn(subscriptionManager, 'getUsageMetrics')
        .mockResolvedValue(mockUsage as any)

      mockSupabase.from().single.mockResolvedValue({ data: mockPlan, error: null })

      const result = await subscriptionManager.checkLimits('user_123')

      expect(result.withinLimits).toBe(false)
      expect(result.exceededLimits).toContain('emailsPerMonth')
      expect(result.exceededLimits).toContain('contactsLimit')
    })
  })

  describe('getInvoices', () => {
    it('should return user invoices', async () => {
      const mockInvoices = [
        {
          id: 'inv_123',
          user_id: 'user_123',
          amount: 4900,
          status: 'paid',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'inv_124',
          user_id: 'user_123',
          amount: 4900,
          status: 'paid',
          created_at: '2023-12-01T00:00:00Z'
        }
      ]

      mockSupabase.from().single.mockResolvedValue({ data: mockInvoices, error: null })

      const invoices = await subscriptionManager.getInvoices('user_123', 10)

      expect(mockSupabase.from).toHaveBeenCalledWith('invoices')
      expect(invoices).toEqual(mockInvoices)
    })
  })

  describe('addPaymentMethod', () => {
    it('should add payment method successfully', async () => {
      const mockSubscription = {
        stripeCustomerId: 'cus_123'
      }

      const mockStripePaymentMethod = {
        id: 'pm_123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        }
      }

      const mockPaymentMethod = {
        id: 'pm_db_123',
        user_id: 'user_123',
        stripe_payment_method_id: 'pm_123',
        type: 'card',
        brand: 'visa',
        last4: '4242',
        is_default: true
      }

      jest.spyOn(subscriptionManager, 'getUserSubscription')
        .mockResolvedValue(mockSubscription as any)

      mockStripe.paymentMethods.attach.mockResolvedValue({} as any)
      mockStripe.customers.update.mockResolvedValue({} as any)
      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockStripePaymentMethod as any)

      mockSupabase.from().single.mockResolvedValue({ data: mockPaymentMethod, error: null })

      const result = await subscriptionManager.addPaymentMethod('user_123', 'pm_123', true)

      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith('pm_123', {
        customer: 'cus_123'
      })

      expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_123', {
        invoice_settings: {
          default_payment_method: 'pm_123'
        }
      })

      expect(result).toEqual(mockPaymentMethod)
    })
  })

  describe('handleWebhook', () => {
    it('should handle subscription updated webhook', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            current_period_start: 1640995200,
            current_period_end: 1643673600,
            cancel_at_period_end: false
          }
        }
      } as Stripe.Event

      mockSupabase.from().single.mockResolvedValue({ data: null, error: null })

      await subscriptionManager.handleWebhook(mockEvent)

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'active',
        current_period_start: expect.any(String),
        current_period_end: expect.any(String),
        cancel_at_period_end: false,
        updated_at: expect.any(String)
      })
    })

    it('should handle invoice payment succeeded webhook', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            amount_paid: 4900,
            currency: 'usd',
            status: 'paid',
            due_date: 1640995200,
            status_transitions: {
              paid_at: 1640995200
            },
            hosted_invoice_url: 'https://invoice.stripe.com/123',
            invoice_pdf: 'https://invoice.stripe.com/123.pdf',
            lines: {
              data: [{
                description: 'Starter Plan',
                amount: 4900,
                quantity: 1,
                price: {
                  unit_amount: 4900
                }
              }]
            }
          }
        }
      } as Stripe.Event

      // Mock getUserIdFromCustomerId
      mockSupabase.from().single.mockResolvedValue({ 
        data: { id: 'user_123' }, 
        error: null 
      })

      await subscriptionManager.handleWebhook(mockEvent)

      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user_123',
          stripe_invoice_id: 'in_123',
          amount: 4900,
          status: 'paid'
        }),
        { onConflict: 'stripe_invoice_id' }
      )
    })
  })
})