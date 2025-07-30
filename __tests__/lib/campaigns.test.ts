import { CampaignUtils, EmailStep, Campaign, StepCondition } from '@/lib/campaigns'

describe('CampaignUtils', () => {
  describe('calculateStepDelay', () => {
    it('should calculate total delay in hours', () => {
      const step: EmailStep = {
        id: '1',
        step_number: 2,
        name: 'Follow-up',
        subject_template: 'Subject',
        content_template: 'Content',
        delay_days: 2,
        delay_hours: 6,
        conditions: [],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const totalHours = CampaignUtils.calculateStepDelay(step)
      expect(totalHours).toBe(54) // 2 days * 24 hours + 6 hours
    })

    it('should handle zero delays', () => {
      const step: EmailStep = {
        id: '1',
        step_number: 1,
        name: 'Initial',
        subject_template: 'Subject',
        content_template: 'Content',
        delay_days: 0,
        delay_hours: 0,
        conditions: [],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const totalHours = CampaignUtils.calculateStepDelay(step)
      expect(totalHours).toBe(0)
    })
  })

  describe('validateEmailSequence', () => {
    const createStep = (stepNumber: number, id: string = `step-${stepNumber}`): EmailStep => ({
      id,
      step_number: stepNumber,
      name: `Step ${stepNumber}`,
      subject_template: `Subject ${stepNumber}`,
      content_template: `Content ${stepNumber}`,
      delay_days: stepNumber === 1 ? 0 : 1,
      delay_hours: 0,
      conditions: [],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    })

    it('should validate a correct sequence', () => {
      const sequence = [
        createStep(1),
        createStep(2),
        createStep(3)
      ]

      const result = CampaignUtils.validateEmailSequence(sequence)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing step numbers', () => {
      const sequence = [
        createStep(1),
        createStep(3) // Missing step 2
      ]

      const result = CampaignUtils.validateEmailSequence(sequence)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Step numbers must be sequential starting from 1. Missing step 2')
    })

    it('should detect duplicate step numbers', () => {
      const sequence = [
        createStep(1, 'step-1a'),
        createStep(1, 'step-1b'), // Duplicate step number
        createStep(2)
      ]

      const result = CampaignUtils.validateEmailSequence(sequence)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate step numbers found')
    })

    it('should detect invalid condition references', () => {
      const step1 = createStep(1)
      const step2 = createStep(2)
      step2.conditions = [{
        id: 'cond-1',
        type: 'reply_received',
        operator: 'equals',
        value: true,
        action: 'branch_to_step',
        target_step_id: 'nonexistent-step'
      }]

      const sequence = [step1, step2]

      const result = CampaignUtils.validateEmailSequence(sequence)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Step 2 references non-existent target step')
    })

    it('should detect delay on first step', () => {
      const step1 = createStep(1)
      step1.delay_days = 1 // First step should not have delay

      const sequence = [step1]

      const result = CampaignUtils.validateEmailSequence(sequence)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('First step cannot have a delay')
    })
  })

  describe('calculateCampaignDuration', () => {
    it('should calculate total campaign duration', () => {
      const sequence: EmailStep[] = [
        {
          id: '1',
          step_number: 1,
          name: 'Step 1',
          subject_template: 'Subject',
          content_template: 'Content',
          delay_days: 0,
          delay_hours: 0,
          conditions: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          step_number: 2,
          name: 'Step 2',
          subject_template: 'Subject',
          content_template: 'Content',
          delay_days: 2,
          delay_hours: 12,
          conditions: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '3',
          step_number: 3,
          name: 'Step 3',
          subject_template: 'Subject',
          content_template: 'Content',
          delay_days: 1,
          delay_hours: 6,
          conditions: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      const duration = CampaignUtils.calculateCampaignDuration(sequence)
      expect(duration).toBe(90) // 0 + 60 + 30 hours
    })

    it('should return 0 for empty sequence', () => {
      const duration = CampaignUtils.calculateCampaignDuration([])
      expect(duration).toBe(0)
    })
  })

  describe('getNextStep', () => {
    const step1: EmailStep = {
      id: 'step-1',
      step_number: 1,
      name: 'Step 1',
      subject_template: 'Subject',
      content_template: 'Content',
      delay_days: 0,
      delay_hours: 0,
      conditions: [
        {
          id: 'cond-1',
          type: 'reply_received',
          operator: 'equals',
          value: true,
          action: 'stop_sequence'
        }
      ],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const step2: EmailStep = {
      id: 'step-2',
      step_number: 2,
      name: 'Step 2',
      subject_template: 'Subject',
      content_template: 'Content',
      delay_days: 1,
      delay_hours: 0,
      conditions: [],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    const sequence = [step1, step2]

    it('should return null when stop_sequence condition is met', () => {
      const contactData = { reply_received_at: '2024-01-01T12:00:00Z' }
      const nextStep = CampaignUtils.getNextStep(step1, sequence, contactData)
      expect(nextStep).toBeNull()
    })

    it('should return next step when no conditions are met', () => {
      const contactData = { reply_received_at: null }
      const nextStep = CampaignUtils.getNextStep(step1, sequence, contactData)
      expect(nextStep).toBe(step2)
    })

    it('should return null when at last step', () => {
      const contactData = {}
      const nextStep = CampaignUtils.getNextStep(step2, sequence, contactData)
      expect(nextStep).toBeNull()
    })
  })

  describe('generateCampaignSummary', () => {
    const mockCampaign: Campaign = {
      id: 'campaign-1',
      user_id: 'user-1',
      name: 'Test Campaign',
      status: 'draft',
      contact_list_ids: ['list-1'],
      email_sequence: [
        {
          id: 'step-1',
          step_number: 1,
          name: 'Step 1',
          subject_template: 'Subject',
          content_template: 'Content',
          delay_days: 0,
          delay_hours: 0,
          conditions: [
            {
              id: 'cond-1',
              type: 'reply_received',
              operator: 'equals',
              value: true,
              action: 'stop_sequence'
            }
          ],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'step-2',
          step_number: 2,
          name: 'Step 2',
          subject_template: 'Subject',
          content_template: 'Content',
          delay_days: 2,
          delay_hours: 0,
          conditions: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      ai_settings: {
        enabled: true,
        provider: 'openai',
        variables: {},
        fallback_to_template: true,
        confidence_threshold: 0.7
      },
      schedule_settings: {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: true,
        holiday_list: [],
        rate_limiting: {
          daily_limit: 50,
          hourly_limit: 10,
          domain_limit: 10,
          account_rotation: true,
          warmup_mode: false,
          batch_size: 10,
          batch_delay_minutes: 5
        },
        send_immediately: false
      },
      tags: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should generate correct campaign summary', () => {
      const summary = CampaignUtils.generateCampaignSummary(mockCampaign)

      expect(summary.totalSteps).toBe(2)
      expect(summary.estimatedDuration).toBe('2 days')
      expect(summary.hasConditionalLogic).toBe(true)
      expect(summary.hasABTesting).toBe(false)
      expect(summary.aiPersonalizationEnabled).toBe(true)
    })

    it('should handle duration in hours', () => {
      const shortCampaign = {
        ...mockCampaign,
        email_sequence: [
          {
            ...mockCampaign.email_sequence[0]
          },
          {
            ...mockCampaign.email_sequence[1],
            delay_days: 0,
            delay_hours: 12
          }
        ]
      }

      const summary = CampaignUtils.generateCampaignSummary(shortCampaign)
      expect(summary.estimatedDuration).toBe('12 hours')
    })

    it('should handle mixed days and hours', () => {
      const mixedCampaign = {
        ...mockCampaign,
        email_sequence: [
          {
            ...mockCampaign.email_sequence[0]
          },
          {
            ...mockCampaign.email_sequence[1],
            delay_days: 1,
            delay_hours: 6
          }
        ]
      }

      const summary = CampaignUtils.generateCampaignSummary(mixedCampaign)
      expect(summary.estimatedDuration).toBe('1 days 6 hours')
    })
  })

  describe('validateCampaignForLaunch', () => {
    const baseCampaign: Campaign = {
      id: 'campaign-1',
      user_id: 'user-1',
      name: 'Test Campaign',
      status: 'draft',
      contact_list_ids: ['list-1'],
      email_sequence: [
        {
          id: 'step-1',
          step_number: 1,
          name: 'Step 1',
          subject_template: 'Subject',
          content_template: 'Content',
          delay_days: 0,
          delay_hours: 0,
          conditions: [],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      ai_settings: {
        enabled: true,
        provider: 'openai',
        template_id: 'template-1',
        variables: {},
        fallback_to_template: true,
        confidence_threshold: 0.7
      },
      schedule_settings: {
        timezone_detection: true,
        business_hours_only: true,
        business_hours_start: '09:00',
        business_hours_end: '17:00',
        business_days: [1, 2, 3, 4, 5],
        custom_time_windows: [],
        avoid_weekends: true,
        avoid_holidays: true,
        holiday_list: [],
        rate_limiting: {
          daily_limit: 50,
          hourly_limit: 10,
          domain_limit: 10,
          account_rotation: true,
          warmup_mode: false,
          batch_size: 10,
          batch_delay_minutes: 5
        },
        send_immediately: false
      },
      tags: [],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should validate a correct campaign', () => {
      const result = CampaignUtils.validateCampaignForLaunch(baseCampaign)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing campaign name', () => {
      const campaign = { ...baseCampaign, name: '' }
      const result = CampaignUtils.validateCampaignForLaunch(campaign)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Campaign name is required')
    })

    it('should detect missing contact lists', () => {
      const campaign = { ...baseCampaign, contact_list_ids: [] }
      const result = CampaignUtils.validateCampaignForLaunch(campaign)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one contact list is required')
    })

    it('should detect missing email sequence', () => {
      const campaign = { ...baseCampaign, email_sequence: [] }
      const result = CampaignUtils.validateCampaignForLaunch(campaign)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one email step is required')
    })

    it('should detect missing AI template or prompt', () => {
      const campaign = {
        ...baseCampaign,
        ai_settings: {
          ...baseCampaign.ai_settings,
          template_id: undefined,
          custom_prompt: undefined
        }
      }
      const result = CampaignUtils.validateCampaignForLaunch(campaign)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('AI personalization requires either a template or custom prompt')
    })

    it('should validate A/B test settings', () => {
      const campaign = {
        ...baseCampaign,
        ab_test_settings: {
          enabled: true,
          test_type: 'subject_line' as const,
          variants: [
            {
              id: 'variant-1',
              name: 'Variant 1',
              subject_template: 'Subject A',
              is_control: true
            }
          ], // Only one variant (need at least 2)
          traffic_split: [100],
          winner_criteria: 'open_rate' as const,
          confidence_level: 0.95,
          minimum_sample_size: 100,
          test_duration_hours: 72,
          auto_select_winner: true
        }
      }
      const result = CampaignUtils.validateCampaignForLaunch(campaign)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('A/B testing requires at least 2 variants')
    })
  })

  describe('getDefaultCampaignTemplate', () => {
    it('should return a valid default template', () => {
      const template = CampaignUtils.getDefaultCampaignTemplate()

      expect(template.name).toBe('')
      expect(template.status).toBe('draft')
      expect(template.contact_list_ids).toEqual([])
      expect(template.email_sequence).toHaveLength(1)
      expect(template.email_sequence![0].step_number).toBe(1)
      expect(template.email_sequence![0].delay_days).toBe(0)
      expect(template.ai_settings!.enabled).toBe(true)
      expect(template.schedule_settings!.business_hours_only).toBe(true)
    })
  })
})"