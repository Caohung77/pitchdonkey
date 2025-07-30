import { ABTestService, ABTestStatistics, ABTest, ABTestVariant } from '@/lib/ab-testing'

describe('ABTestStatistics', () => {
  describe('calculateSignificance', () => {
    it('should calculate statistical significance correctly', () => {
      // Control: 100 opens out of 1000 emails (10% open rate)
      // Variant: 150 opens out of 1000 emails (15% open rate)
      const result = ABTestStatistics.calculateSignificance(100, 1000, 150, 1000, 0.95)
      
      expect(result.pValue).toBeLessThan(0.05) // Should be significant
      expect(result.isSignificant).toBe(true)
      expect(result.lift).toBeCloseTo(50, 0) // 50% improvement
      expect(result.confidenceInterval[0]).toBeLessThan(0)
      expect(result.confidenceInterval[1]).toBeGreaterThan(0)
    })

    it('should handle no difference between variants', () => {
      const result = ABTestStatistics.calculateSignificance(100, 1000, 100, 1000, 0.95)
      
      expect(result.pValue).toBeCloseTo(1, 1)
      expect(result.isSignificant).toBe(false)
      expect(result.lift).toBe(0)
    })

    it('should handle zero totals gracefully', () => {
      const result = ABTestStatistics.calculateSignificance(0, 0, 10, 100, 0.95)
      
      expect(result.pValue).toBe(1)
      expect(result.isSignificant).toBe(false)
      expect(result.lift).toBe(0)
      expect(result.confidenceInterval).toEqual([0, 0])
    })
  })

  describe('calculateSampleSize', () => {
    it('should calculate required sample size', () => {
      // For 10% baseline rate, 20% minimum detectable effect
      const sampleSize = ABTestStatistics.calculateSampleSize(0.1, 0.2, 0.95, 0.8)
      
      expect(sampleSize).toBeGreaterThan(0)
      expect(sampleSize).toBeLessThan(10000) // Reasonable upper bound
    })

    it('should require larger sample for smaller effects', () => {
      const smallEffect = ABTestStatistics.calculateSampleSize(0.1, 0.1, 0.95, 0.8)
      const largeEffect = ABTestStatistics.calculateSampleSize(0.1, 0.5, 0.95, 0.8)
      
      expect(smallEffect).toBeGreaterThan(largeEffect)
    })
  })

  describe('calculatePower', () => {
    it('should calculate statistical power', () => {
      const power = ABTestStatistics.calculatePower(100, 1000, 150, 1000, 0.95)
      
      expect(power).toBeGreaterThan(0)
      expect(power).toBeLessThanOrEqual(1)
    })

    it('should return 0 for zero totals', () => {
      const power = ABTestStatistics.calculatePower(0, 0, 10, 100, 0.95)
      expect(power).toBe(0)
    })
  })
})

describe('ABTestService', () => {
  describe('createTest', () => {
    const validTestData = {
      name: 'Subject Line Test',
      description: 'Testing different subject lines',
      test_type: 'subject_line' as const,
      variants: [
        {
          name: 'Control',
          subject_template: 'Original subject',
          is_control: true,
          traffic_percentage: 50
        },
        {
          name: 'Variant B',
          subject_template: 'New subject',
          is_control: false,
          traffic_percentage: 50
        }
      ],
      winner_criteria: 'open_rate' as const,
      confidence_level: 0.95 as const,
      minimum_sample_size: 100,
      test_duration_hours: 72,
      auto_select_winner: true
    }

    it('should create a valid A/B test', () => {
      const test = ABTestService.createTest('campaign-123', 'user-123', validTestData)
      
      expect(test.id).toBeDefined()
      expect(test.campaign_id).toBe('campaign-123')
      expect(test.user_id).toBe('user-123')
      expect(test.name).toBe('Subject Line Test')
      expect(test.status).toBe('draft')
      expect(test.variants).toHaveLength(2)
      expect(test.variants[0].ab_test_id).toBe(test.id)
      expect(test.variants.find(v => v.is_control)).toBeDefined()
    })

    it('should validate required fields', () => {
      const invalidData = { ...validTestData, name: '' }
      
      expect(() => {
        ABTestService.createTest('campaign-123', 'user-123', invalidData)
      }).toThrow()
    })

    it('should validate exactly one control variant', () => {
      const invalidData = {
        ...validTestData,
        variants: [
          { ...validTestData.variants[0], is_control: true },
          { ...validTestData.variants[1], is_control: true } // Two controls
        ]
      }
      
      expect(() => {
        ABTestService.createTest('campaign-123', 'user-123', invalidData)
      }).toThrow()
    })

    it('should validate traffic percentages sum to 100', () => {
      const invalidData = {
        ...validTestData,
        variants: [
          { ...validTestData.variants[0], traffic_percentage: 60 },
          { ...validTestData.variants[1], traffic_percentage: 60 } // Total 120%
        ]
      }
      
      expect(() => {
        ABTestService.createTest('campaign-123', 'user-123', invalidData)
      }).toThrow()
    })
  })

  describe('assignVariant', () => {
    const mockTest: ABTest = {
      id: 'test-123',
      campaign_id: 'campaign-123',
      user_id: 'user-123',
      name: 'Test',
      test_type: 'subject_line',
      status: 'running',
      variants: [
        {
          id: 'variant-a',
          ab_test_id: 'test-123',
          name: 'Control',
          is_control: true,
          traffic_percentage: 50,
          emails_sent: 0,
          emails_delivered: 0,
          emails_opened: 0,
          emails_clicked: 0,
          emails_replied: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'variant-b',
          ab_test_id: 'test-123',
          name: 'Variant B',
          is_control: false,
          traffic_percentage: 50,
          emails_sent: 0,
          emails_delivered: 0,
          emails_opened: 0,
          emails_clicked: 0,
          emails_replied: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      traffic_split: [50, 50],
      winner_criteria: 'open_rate',
      confidence_level: 0.95,
      minimum_sample_size: 100,
      test_duration_hours: 72,
      auto_select_winner: true,
      statistical_significance: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should assign variants consistently for same contact', () => {
      const contactId = 'contact-123'
      const variant1 = ABTestService.assignVariant(mockTest, contactId)
      const variant2 = ABTestService.assignVariant(mockTest, contactId)
      
      expect(variant1.id).toBe(variant2.id)
    })

    it('should distribute contacts across variants', () => {
      const assignments = new Map<string, number>()
      
      // Test with 1000 contacts
      for (let i = 0; i < 1000; i++) {
        const variant = ABTestService.assignVariant(mockTest, `contact-${i}`)
        assignments.set(variant.id, (assignments.get(variant.id) || 0) + 1)
      }
      
      // Should have roughly 50/50 split (within 10% tolerance)
      const variantACount = assignments.get('variant-a') || 0
      const variantBCount = assignments.get('variant-b') || 0
      
      expect(variantACount).toBeGreaterThan(400)
      expect(variantACount).toBeLessThan(600)
      expect(variantBCount).toBeGreaterThan(400)
      expect(variantBCount).toBeLessThan(600)
    })
  })

  describe('analyzeTest', () => {
    const createMockTest = (variantData: Partial<ABTestVariant>[]): ABTest => ({
      id: 'test-123',
      campaign_id: 'campaign-123',
      user_id: 'user-123',
      name: 'Test',
      test_type: 'subject_line',
      status: 'running',
      variants: variantData.map((data, index) => ({
        id: `variant-${index}`,
        ab_test_id: 'test-123',
        name: `Variant ${index}`,
        is_control: index === 0,
        traffic_percentage: 50,
        emails_sent: 0,
        emails_delivered: 0,
        emails_opened: 0,
        emails_clicked: 0,
        emails_replied: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        ...data
      })),
      traffic_split: [50, 50],
      winner_criteria: 'open_rate',
      confidence_level: 0.95,
      minimum_sample_size: 100,
      test_duration_hours: 72,
      auto_select_winner: true,
      statistical_significance: false,
      started_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    })

    it('should identify significant winner', () => {
      const test = createMockTest([
        { emails_sent: 1000, emails_delivered: 950, emails_opened: 100 }, // 10.5% open rate
        { emails_sent: 1000, emails_delivered: 950, emails_opened: 150 }  // 15.8% open rate
      ])
      
      const analysis = ABTestService.analyzeTest(test)
      
      expect(analysis.status).toBe('significant')
      expect(analysis.winner_variant_id).toBe('variant-1')
      expect(analysis.results[1].is_winner).toBe(true)
      expect(analysis.results[1].statistical_significance).toBe(true)
    })

    it('should handle insufficient data', () => {
      const test = createMockTest([
        { emails_sent: 10, emails_delivered: 9, emails_opened: 1 },
        { emails_sent: 10, emails_delivered: 9, emails_opened: 2 }
      ])
      
      const analysis = ABTestService.analyzeTest(test)
      
      expect(analysis.status).toBe('insufficient_data')
      expect(analysis.winner_variant_id).toBeUndefined()
    })

    it('should handle inconclusive results', () => {
      const test = createMockTest([
        { emails_sent: 1000, emails_delivered: 950, emails_opened: 100 }, // 10.5% open rate
        { emails_sent: 1000, emails_delivered: 950, emails_opened: 105 }  // 11.1% open rate (not significant)
      ])
      
      const analysis = ABTestService.analyzeTest(test)
      
      expect(analysis.status).toBe('inconclusive')
      expect(analysis.winner_variant_id).toBeUndefined()
    })

    it('should generate appropriate recommendations', () => {
      const test = createMockTest([
        { emails_sent: 50, emails_delivered: 45, emails_opened: 5 },
        { emails_sent: 50, emails_delivered: 45, emails_opened: 7 }
      ])
      
      const analysis = ABTestService.analyzeTest(test)
      
      expect(analysis.recommendations).toContain(
        expect.stringContaining('need')
      )
    })
  })

  describe('shouldStopTest', () => {
    const mockTest: ABTest = {
      id: 'test-123',
      campaign_id: 'campaign-123',
      user_id: 'user-123',
      name: 'Test',
      test_type: 'subject_line',
      status: 'running',
      variants: [],
      traffic_split: [50, 50],
      winner_criteria: 'open_rate',
      confidence_level: 0.95,
      minimum_sample_size: 100,
      test_duration_hours: 72,
      auto_select_winner: true,
      statistical_significance: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should not stop test if auto_select_winner is false', () => {
      const test = { ...mockTest, auto_select_winner: false }
      const analysis = {
        ab_test_id: 'test-123',
        status: 'significant' as const,
        confidence_level: 0.95,
        p_value: 0.01,
        statistical_power: 0.9,
        sample_size_reached: true,
        duration_completed: true,
        results: [],
        recommendations: [],
        created_at: '2024-01-01T00:00:00Z'
      }
      
      const shouldStop = ABTestService.shouldStopTest(test, analysis)
      expect(shouldStop).toBe(false)
    })

    it('should stop test when significant with high power', () => {
      const analysis = {
        ab_test_id: 'test-123',
        status: 'significant' as const,
        confidence_level: 0.95,
        p_value: 0.01,
        statistical_power: 0.9,
        sample_size_reached: true,
        duration_completed: false,
        results: [],
        recommendations: [],
        created_at: '2024-01-01T00:00:00Z'
      }
      
      const shouldStop = ABTestService.shouldStopTest(mockTest, analysis)
      expect(shouldStop).toBe(true)
    })
  })

  describe('getTestSummary', () => {
    const mockTest: ABTest = {
      id: 'test-123',
      campaign_id: 'campaign-123',
      user_id: 'user-123',
      name: 'Test',
      test_type: 'subject_line',
      status: 'running',
      variants: [
        {
          id: 'variant-a',
          ab_test_id: 'test-123',
          name: 'Control',
          is_control: true,
          traffic_percentage: 50,
          emails_sent: 500,
          emails_delivered: 475,
          emails_opened: 50,
          emails_clicked: 10,
          emails_replied: 5,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'variant-b',
          ab_test_id: 'test-123',
          name: 'Variant B',
          is_control: false,
          traffic_percentage: 50,
          emails_sent: 500,
          emails_delivered: 475,
          emails_opened: 75,
          emails_clicked: 15,
          emails_replied: 8,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      traffic_split: [50, 50],
      winner_criteria: 'open_rate',
      confidence_level: 0.95,
      minimum_sample_size: 1000,
      test_duration_hours: 72,
      auto_select_winner: true,
      statistical_significance: false,
      started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should calculate test summary correctly', () => {
      const summary = ABTestService.getTestSummary(mockTest)
      
      expect(summary.totalEmails).toBe(1000)
      expect(summary.bestVariant).toBe('Variant B') // Higher open rate
      expect(summary.improvement).toBeGreaterThan(0) // Variant B performs better
      expect(summary.daysRemaining).toBeCloseTo(2, 0) // ~2 days remaining
      expect(summary.progressPercentage).toBe(100) // 1000/1000 = 100%
    })
  })
})"