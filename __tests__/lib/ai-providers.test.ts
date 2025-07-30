import { AI_PROVIDERS, AIPersonalizationService } from '@/lib/ai-providers'

// Mock external dependencies to avoid import errors
jest.mock('openai', () => ({}))

describe('AI Providers Configuration', () => {
  describe('Provider Structure', () => {
    test('should have correct provider structure', () => {
      Object.values(AI_PROVIDERS).forEach(provider => {
        expect(provider).toHaveProperty('id')
        expect(provider).toHaveProperty('name')
        expect(provider).toHaveProperty('description')
        expect(provider).toHaveProperty('models')
        expect(provider).toHaveProperty('pricing')
        expect(provider).toHaveProperty('limits')
        expect(provider).toHaveProperty('features')
        expect(provider).toHaveProperty('status')

        // Check pricing structure
        expect(provider.pricing).toHaveProperty('inputTokens')
        expect(provider.pricing).toHaveProperty('outputTokens')
        expect(typeof provider.pricing.inputTokens).toBe('number')
        expect(typeof provider.pricing.outputTokens).toBe('number')

        // Check limits structure
        expect(provider.limits).toHaveProperty('maxTokens')
        expect(provider.limits).toHaveProperty('rateLimit')
        expect(typeof provider.limits.maxTokens).toBe('number')
        expect(typeof provider.limits.rateLimit).toBe('number')

        // Check models structure
        expect(Array.isArray(provider.models)).toBe(true)
        provider.models.forEach(model => {
          expect(model).toHaveProperty('id')
          expect(model).toHaveProperty('name')
          expect(model).toHaveProperty('description')
          expect(model).toHaveProperty('maxTokens')
          expect(model).toHaveProperty('contextWindow')
          expect(model).toHaveProperty('bestFor')
          expect(Array.isArray(model.bestFor)).toBe(true)
        })

        // Check features
        expect(Array.isArray(provider.features)).toBe(true)
      })
    })

    test('should have OpenAI provider configured', () => {
      const openai = AI_PROVIDERS.openai
      expect(openai).toBeDefined()
      expect(openai.id).toBe('openai')
      expect(openai.models.length).toBeGreaterThan(0)
      expect(openai.models.some(m => m.id.includes('gpt'))).toBe(true)
    })

    test('should have Anthropic provider configured', () => {
      const anthropic = AI_PROVIDERS.anthropic
      expect(anthropic).toBeDefined()
      expect(anthropic.id).toBe('anthropic')
      expect(anthropic.models.length).toBeGreaterThan(0)
      expect(anthropic.models.some(m => m.id.includes('claude'))).toBe(true)
    })
  })

  describe('Static Methods', () => {
    test('should get provider by ID', () => {
      const openaiProvider = AIPersonalizationService.getProvider('openai')
      expect(openaiProvider).toBeDefined()
      expect(openaiProvider?.id).toBe('openai')
      expect(openaiProvider?.name).toBe('OpenAI')

      const invalidProvider = AIPersonalizationService.getProvider('invalid')
      expect(invalidProvider).toBeNull()
    })

    test('should get models for provider', () => {
      const openaiModels = AIPersonalizationService.getModelsForProvider('openai')
      expect(Array.isArray(openaiModels)).toBe(true)
      expect(openaiModels.length).toBeGreaterThan(0)
      expect(openaiModels[0]).toHaveProperty('id')
      expect(openaiModels[0]).toHaveProperty('name')
      expect(openaiModels[0]).toHaveProperty('description')

      const invalidModels = AIPersonalizationService.getModelsForProvider('invalid')
      expect(invalidModels).toEqual([])
    })

    test('should calculate usage estimate for OpenAI', () => {
      const estimate = AIPersonalizationService.getUsageEstimate(1000, 100, 'openai')
      
      expect(estimate).toHaveProperty('estimatedTokens')
      expect(estimate).toHaveProperty('estimatedCost')
      expect(estimate.estimatedTokens).toBeGreaterThan(0)
      expect(estimate.estimatedCost).toBeGreaterThan(0)
    })

    test('should calculate usage estimate for Anthropic', () => {
      const estimate = AIPersonalizationService.getUsageEstimate(1000, 100, 'anthropic')
      
      expect(estimate).toHaveProperty('estimatedTokens')
      expect(estimate).toHaveProperty('estimatedCost')
      expect(estimate.estimatedTokens).toBeGreaterThan(0)
      expect(estimate.estimatedCost).toBeGreaterThan(0)
    })

    test('should return zero estimate for invalid provider', () => {
      const estimate = AIPersonalizationService.getUsageEstimate(1000, 100, 'invalid' as any)
      
      expect(estimate.estimatedTokens).toBe(0)
      expect(estimate.estimatedCost).toBe(0)
    })

    test('should scale cost with contact count', () => {
      const estimate1 = AIPersonalizationService.getUsageEstimate(1000, 100, 'openai')
      const estimate2 = AIPersonalizationService.getUsageEstimate(1000, 200, 'openai')
      
      expect(estimate2.estimatedTokens).toBe(estimate1.estimatedTokens * 2)
      expect(estimate2.estimatedCost).toBe(estimate1.estimatedCost * 2)
    })

    test('should scale cost with content length', () => {
      const estimate1 = AIPersonalizationService.getUsageEstimate(1000, 100, 'openai')
      const estimate2 = AIPersonalizationService.getUsageEstimate(2000, 100, 'openai')
      
      expect(estimate2.estimatedTokens).toBeGreaterThan(estimate1.estimatedTokens)
      expect(estimate2.estimatedCost).toBeGreaterThan(estimate1.estimatedCost)
    })

    test('should clear rate limits', () => {
      AIPersonalizationService.clearRateLimits()
      // This should not throw an error
      expect(true).toBe(true)
    })
  })



  describe('Personalization Service', () => {
    let service: AIPersonalizationService

    beforeEach(() => {
      service = new AIPersonalizationService()
    })

    test('should create service instance', () => {
      expect(service).toBeInstanceOf(AIPersonalizationService)
    })

    test('should build personalization prompt correctly', () => {
      const request = {
        contactData: {
          first_name: 'John',
          last_name: 'Doe',
          company_name: 'Test Corp',
          job_title: 'Manager',
          industry: 'Technology'
        },
        templateContent: 'Hello {{first_name}}, welcome to {{company_name}}!',
        provider: 'openai' as const
      }

      // Access private method through any casting for testing
      const prompt = (service as any).buildPersonalizationPrompt(request)
      
      expect(prompt).toContain('John')
      expect(prompt).toContain('Doe')
      expect(prompt).toContain('Test Corp')
      expect(prompt).toContain('Manager')
      expect(prompt).toContain('Technology')
      expect(prompt).toContain('Hello {{first_name}}')
    })

    test('should calculate confidence score', () => {
      const originalContent = 'Hello there, this is a generic message.'
      const personalizedContent = 'Hello John, this is a personalized message for Test Corp.'
      
      // Access private method through any casting for testing
      const confidence = (service as any).calculateConfidence(personalizedContent, originalContent)
      
      expect(typeof confidence).toBe('number')
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    test('should simulate personalization correctly', () => {
      const request = {
        contactData: {
          first_name: 'John',
          last_name: 'Doe',
          company_name: 'Test Corp',
          job_title: 'Manager'
        },
        templateContent: 'Hi {{first_name}}, I hope {{company_name}} is doing well.',
        provider: 'anthropic' as const
      }

      // Access private method through any casting for testing
      const result = (service as any).simulatePersonalization(request)
      
      expect(result).toContain('John')
      expect(result).toContain('Test Corp')
      expect(result).not.toContain('{{first_name}}')
      expect(result).not.toContain('{{company_name}}')
    })
  })

  describe('Rate Limiting', () => {
    test('should clear rate limits', () => {
      AIPersonalizationService.clearRateLimits()
      // This should not throw an error
      expect(true).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid personalization request', async () => {
      const service = new AIPersonalizationService()
      
      const invalidRequest = {
        contactData: {
          first_name: '',
          last_name: ''
        },
        templateContent: '',
        provider: 'invalid' as any
      }

      await expect(service.personalizeContent(invalidRequest))
        .rejects.toThrow()
    })
  })
})