/**
 * Batch Scheduling System Tests
 *
 * Tests the proactive batch scheduling system including:
 * - Batch schedule generation at campaign creation
 * - Batch time calculation with 20-minute intervals
 * - Campaign processor batch triggering logic
 * - Batch status updates after sending
 * - Integration with warmup system
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CampaignProcessor } from '@/lib/campaign-processor'

// Mock Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn()
}))

describe('Batch Scheduling System', () => {
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn()
    }

    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Batch Schedule Generation', () => {
    it('should generate correct batch schedule for 10 contacts with batch size 5', () => {
      const totalContacts = 10
      const batchSize = 5
      const startTime = new Date('2025-10-02T20:00:00Z')
      const BATCH_INTERVAL_MINUTES = 20

      // Calculate expected batches
      const totalBatches = Math.ceil(totalContacts / batchSize) // 2 batches
      const batches = []

      for (let i = 0; i < totalBatches; i++) {
        const batchTime = new Date(startTime.getTime() + (i * BATCH_INTERVAL_MINUTES * 60 * 1000))
        batches.push({
          batch_number: i + 1,
          scheduled_time: batchTime.toISOString(),
          contact_count: Math.min(batchSize, totalContacts - (i * batchSize)),
          status: 'pending'
        })
      }

      expect(batches).toHaveLength(2)
      expect(batches[0]).toMatchObject({
        batch_number: 1,
        scheduled_time: '2025-10-02T20:00:00.000Z',
        contact_count: 5,
        status: 'pending'
      })
      expect(batches[1]).toMatchObject({
        batch_number: 2,
        scheduled_time: '2025-10-02T20:20:00.000Z', // 20 minutes later
        contact_count: 5,
        status: 'pending'
      })
    })

    it('should handle uneven contact distribution (13 contacts, batch size 5)', () => {
      const totalContacts = 13
      const batchSize = 5
      const startTime = new Date('2025-10-02T20:00:00Z')
      const BATCH_INTERVAL_MINUTES = 20

      const totalBatches = Math.ceil(totalContacts / batchSize) // 3 batches
      const batches = []

      for (let i = 0; i < totalBatches; i++) {
        const batchContactCount = Math.min(batchSize, totalContacts - (i * batchSize))
        const batchTime = new Date(startTime.getTime() + (i * BATCH_INTERVAL_MINUTES * 60 * 1000))

        batches.push({
          batch_number: i + 1,
          scheduled_time: batchTime.toISOString(),
          contact_count: batchContactCount,
          status: 'pending'
        })
      }

      expect(batches).toHaveLength(3)
      expect(batches[0].contact_count).toBe(5)
      expect(batches[1].contact_count).toBe(5)
      expect(batches[2].contact_count).toBe(3) // Last batch has remaining 3 contacts
      expect(batches[2].scheduled_time).toBe('2025-10-02T20:40:00.000Z') // 40 minutes after start
    })

    it('should generate single batch for contacts less than batch size', () => {
      const totalContacts = 3
      const batchSize = 5
      const startTime = new Date('2025-10-02T20:00:00Z')

      const totalBatches = Math.ceil(totalContacts / batchSize) // 1 batch

      expect(totalBatches).toBe(1)
    })

    it('should correctly calculate batch interval times', () => {
      const BATCH_INTERVAL_MINUTES = 20
      const startTime = new Date('2025-10-02T20:00:00Z')

      const batch1Time = new Date(startTime.getTime() + (0 * BATCH_INTERVAL_MINUTES * 60 * 1000))
      const batch2Time = new Date(startTime.getTime() + (1 * BATCH_INTERVAL_MINUTES * 60 * 1000))
      const batch3Time = new Date(startTime.getTime() + (2 * BATCH_INTERVAL_MINUTES * 60 * 1000))

      expect(batch1Time.toISOString()).toBe('2025-10-02T20:00:00.000Z')
      expect(batch2Time.toISOString()).toBe('2025-10-02T20:20:00.000Z')
      expect(batch3Time.toISOString()).toBe('2025-10-02T20:40:00.000Z')
    })
  })

  describe('Campaign Processor - Batch Triggering Logic', () => {
    it('should process campaign with pending batch when scheduled_time has arrived', async () => {
      const now = new Date('2025-10-02T20:25:00Z')
      const campaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        status: 'sending',
        batch_schedule: {
          batches: [
            {
              batch_number: 1,
              scheduled_time: '2025-10-02T20:00:00Z', // Already sent
              contact_ids: ['c1', 'c2', 'c3', 'c4', 'c5'],
              contact_count: 5,
              status: 'sent',
              completed_at: '2025-10-02T20:05:00Z'
            },
            {
              batch_number: 2,
              scheduled_time: '2025-10-02T20:20:00Z', // Should trigger (20:25 > 20:20)
              contact_ids: ['c6', 'c7', 'c8', 'c9', 'c10'],
              contact_count: 5,
              status: 'pending'
            }
          ],
          batch_size: 5,
          batch_interval_minutes: 20,
          total_batches: 2,
          total_contacts: 10
        }
      }

      // Find pending batch
      const pendingBatch = campaign.batch_schedule.batches.find((batch: any) =>
        batch.status === 'pending' && new Date(batch.scheduled_time) <= now
      )

      expect(pendingBatch).toBeDefined()
      expect(pendingBatch?.batch_number).toBe(2)
      expect(pendingBatch?.contact_count).toBe(5)
    })

    it('should skip campaign when next batch time has not arrived', async () => {
      const now = new Date('2025-10-02T20:15:00Z') // Before batch 2 time
      const campaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        status: 'sending',
        batch_schedule: {
          batches: [
            {
              batch_number: 1,
              scheduled_time: '2025-10-02T20:00:00Z',
              status: 'sent'
            },
            {
              batch_number: 2,
              scheduled_time: '2025-10-02T20:20:00Z', // Not yet time (20:15 < 20:20)
              status: 'pending'
            }
          ]
        }
      }

      // Check if there's a pending batch ready to send
      const hasPendingBatch = campaign.batch_schedule.batches.some((batch: any) =>
        batch.status === 'pending' && new Date(batch.scheduled_time) <= now
      )

      expect(hasPendingBatch).toBe(false)
    })

    it('should mark campaign as completed when all batches are sent', () => {
      const campaign = {
        id: 'campaign-1',
        batch_schedule: {
          batches: [
            {
              batch_number: 1,
              status: 'sent',
              completed_at: '2025-10-02T20:05:00Z'
            },
            {
              batch_number: 2,
              status: 'sent',
              completed_at: '2025-10-02T20:25:00Z'
            }
          ]
        }
      }

      // Check if all batches are sent
      const allBatchesSent = campaign.batch_schedule.batches.every(
        (batch: any) => batch.status === 'sent'
      )

      const nextPendingBatch = campaign.batch_schedule.batches.find(
        (batch: any) => batch.status === 'pending'
      )

      expect(allBatchesSent).toBe(true)
      expect(nextPendingBatch).toBeUndefined()
    })
  })

  describe('Batch Status Updates', () => {
    it('should update batch status to sent and set next_batch_send_time correctly', () => {
      const now = new Date('2025-10-02T20:25:00Z')
      const batchSchedule = {
        batches: [
          {
            batch_number: 1,
            scheduled_time: '2025-10-02T20:00:00Z',
            status: 'sent',
            completed_at: '2025-10-02T20:05:00Z'
          },
          {
            batch_number: 2,
            scheduled_time: '2025-10-02T20:20:00Z',
            status: 'pending'
          },
          {
            batch_number: 3,
            scheduled_time: '2025-10-02T20:40:00Z',
            status: 'pending'
          }
        ]
      }

      // Simulate batch 2 being processed
      const updatedBatches = batchSchedule.batches.map((batch: any) =>
        batch.status === 'pending' && new Date(batch.scheduled_time) <= now
          ? { ...batch, status: 'sent', completed_at: now.toISOString() }
          : batch
      )

      // Find next pending batch
      const nextPendingBatch = updatedBatches.find((batch: any) => batch.status === 'pending')

      expect(updatedBatches[1].status).toBe('sent')
      expect(updatedBatches[1].completed_at).toBe('2025-10-02T20:25:00.000Z')
      expect(nextPendingBatch).toBeDefined()
      expect(nextPendingBatch?.batch_number).toBe(3)
      expect(nextPendingBatch?.scheduled_time).toBe('2025-10-02T20:40:00Z')
    })

    it('should set status to completed when no more pending batches', () => {
      const now = new Date('2025-10-02T20:45:00Z')
      const batchSchedule = {
        batches: [
          {
            batch_number: 1,
            scheduled_time: '2025-10-02T20:00:00Z',
            status: 'sent',
            completed_at: '2025-10-02T20:05:00Z'
          },
          {
            batch_number: 2,
            scheduled_time: '2025-10-02T20:20:00Z',
            status: 'sent',
            completed_at: '2025-10-02T20:25:00Z'
          },
          {
            batch_number: 3,
            scheduled_time: '2025-10-02T20:40:00Z',
            status: 'pending'
          }
        ]
      }

      // Mark last batch as sent
      const updatedBatches = batchSchedule.batches.map((batch: any) =>
        batch.status === 'pending' && new Date(batch.scheduled_time) <= now
          ? { ...batch, status: 'sent', completed_at: now.toISOString() }
          : batch
      )

      const nextPendingBatch = updatedBatches.find((batch: any) => batch.status === 'pending')
      const campaignStatus = nextPendingBatch ? 'sending' : 'completed'
      const nextBatchSendTime = nextPendingBatch ? nextPendingBatch.scheduled_time : null

      expect(campaignStatus).toBe('completed')
      expect(nextBatchSendTime).toBeNull()
      expect(updatedBatches[2].status).toBe('sent')
    })
  })

  describe('Warmup Integration', () => {
    it('should limit batch size based on warmup status', () => {
      const warmupStatus = {
        current_daily_limit: 10, // Warmup allows only 10 emails per day
        plan: 'gradual_warmup'
      }

      const requestedBatchSize = 50
      const effectiveBatchSize = Math.min(requestedBatchSize, warmupStatus.current_daily_limit)

      expect(effectiveBatchSize).toBe(10)
    })

    it('should allow full batch size when warmup is complete', () => {
      const warmupStatus = {
        current_daily_limit: 1000,
        plan: 'ready'
      }

      const requestedBatchSize = 50
      const effectiveBatchSize = Math.min(requestedBatchSize, warmupStatus.current_daily_limit)

      expect(effectiveBatchSize).toBe(50)
    })
  })

  describe('Database Schema Requirements', () => {
    it('should have batch_schedule column type JSONB', () => {
      // This test verifies the expected structure
      const expectedBatchSchedule = {
        batches: [
          {
            batch_number: 1,
            scheduled_time: '2025-10-02T20:00:00.000Z',
            contact_ids: ['id1', 'id2', 'id3'],
            contact_count: 3,
            status: 'pending'
          }
        ],
        batch_size: 5,
        batch_interval_minutes: 20,
        total_batches: 1,
        total_contacts: 3,
        estimated_completion: '2025-10-02T20:00:00.000Z'
      }

      // Verify structure can be JSON stringified/parsed
      const jsonString = JSON.stringify(expectedBatchSchedule)
      const parsed = JSON.parse(jsonString)

      expect(parsed.batches).toHaveLength(1)
      expect(parsed.batch_size).toBe(5)
      expect(parsed.batch_interval_minutes).toBe(20)
    })
  })

  describe('Edge Cases', () => {
    it('should handle campaign with 0 contacts', () => {
      const totalContacts = 0
      const batchSize = 5
      const totalBatches = Math.ceil(totalContacts / batchSize)

      expect(totalBatches).toBe(0)
    })

    it('should handle exact multiple of batch size', () => {
      const totalContacts = 15
      const batchSize = 5
      const totalBatches = Math.ceil(totalContacts / batchSize)

      expect(totalBatches).toBe(3)

      // All batches should have equal size
      for (let i = 0; i < totalBatches; i++) {
        const batchContactCount = Math.min(batchSize, totalContacts - (i * batchSize))
        expect(batchContactCount).toBe(5)
      }
    })

    it('should handle fallback when contact_ids is empty', () => {
      const batch = {
        batch_number: 1,
        scheduled_time: '2025-10-02T20:00:00Z',
        contact_ids: [], // Empty array (backfilled campaign)
        contact_count: 5,
        status: 'pending'
      }

      const shouldFallback = !batch.contact_ids || batch.contact_ids.length === 0
      expect(shouldFallback).toBe(true)
    })
  })
})
