# Phase 5: Learning & Optimization Implementation Guide

**Status**: Not yet implemented (on hold)
**Prerequisites**: Phases 1-4 complete, `agent_stats_hourly` table exists
**Estimated Implementation Time**: 8-12 hours

## Overview

Phase 5 adds machine learning-based optimization to the autonomous reply system. It learns optimal send times per agent based on engagement data and continuously improves performance.

## Core Concept: Reinforcement Learning

The system uses a simple **Multi-Armed Bandit** approach:
- Each hour of the day (0-23) is a "slot machine arm"
- **Reward**: Opens + (3 × Replies) - (5 × Bounces)
- **Strategy**: Balance exploration (trying new times) vs exploitation (using best times)
- **Algorithm**: Upper Confidence Bound (UCB1) for time slot selection

## Database Schema (Already Exists)

```sql
-- Created in Phase 1 migration
CREATE TABLE agent_stats_hourly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES outreach_agents(id) ON DELETE CASCADE,
  hour_of_day INT NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday

  -- Performance metrics
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_clicked INT DEFAULT 0,
  emails_replied INT DEFAULT 0,
  emails_bounced INT DEFAULT 0,

  -- Learning metrics
  reward_score NUMERIC(8,2) DEFAULT 0, -- opens + (3 * replies) - (5 * bounces)
  confidence_score NUMERIC(3,2) DEFAULT 0, -- 0.0 to 1.0

  -- Metadata
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_stats_hourly_agent_hour
  ON agent_stats_hourly(agent_id, hour_of_day);
CREATE INDEX idx_agent_stats_hourly_agent_day_hour
  ON agent_stats_hourly(agent_id, day_of_week, hour_of_day);
```

## Implementation Steps

### 1. Create Learning Service (`lib/learning-service.ts`)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type Supabase = SupabaseClient<Database>

export interface TimeSlotStats {
  hour: number
  dayOfWeek?: number
  emailsSent: number
  emailsOpened: number
  emailsReplied: number
  emailsBounced: number
  rewardScore: number
  confidenceScore: number
}

export interface OptimalTimeRecommendation {
  hour: number
  dayOfWeek: number
  confidence: number
  expectedReward: number
  reasoning: string
}

/**
 * Learning service for optimizing autonomous reply timing
 */
export class AgentLearningService {
  private supabase: Supabase

  constructor(supabase: Supabase) {
    this.supabase = supabase
  }

  /**
   * Get optimal send time using UCB1 algorithm
   * Balances exploration (trying new times) vs exploitation (using best times)
   */
  async getOptimalSendTime(
    agentId: string,
    currentTime: Date = new Date()
  ): Promise<OptimalTimeRecommendation> {
    // Get all hourly stats for this agent
    const { data: stats, error } = await this.supabase
      .from('agent_stats_hourly')
      .select('*')
      .eq('agent_id', agentId)
      .order('hour_of_day', { ascending: true })

    if (error) {
      console.error('Error fetching agent stats:', error)
      // Fallback to smart default (10 AM - 2 PM are generally good times)
      return this.getDefaultRecommendation(currentTime)
    }

    // If no data yet, use default
    if (!stats || stats.length === 0) {
      return this.getDefaultRecommendation(currentTime)
    }

    // Calculate UCB1 scores for each hour
    const totalPlays = stats.reduce((sum, s) => sum + s.emails_sent, 0)
    const ucbScores: Array<{
      hour: number
      score: number
      avgReward: number
      plays: number
    }> = []

    for (let hour = 0; hour < 24; hour++) {
      const stat = stats.find(s => s.hour_of_day === hour)

      if (!stat || stat.emails_sent === 0) {
        // Unplayed slot gets high exploration bonus
        ucbScores.push({
          hour,
          score: Infinity, // Will be tried first
          avgReward: 0,
          plays: 0,
        })
      } else {
        const avgReward = stat.reward_score / stat.emails_sent
        const explorationBonus = Math.sqrt(
          (2 * Math.log(totalPlays)) / stat.emails_sent
        )
        const ucbScore = avgReward + explorationBonus

        ucbScores.push({
          hour,
          score: ucbScore,
          avgReward,
          plays: stat.emails_sent,
        })
      }
    }

    // Sort by UCB score (highest first)
    ucbScores.sort((a, b) => b.score - a.score)

    // Get top 3 hours and find the soonest one
    const topHours = ucbScores.slice(0, 3)
    const currentHour = currentTime.getHours()
    const dayOfWeek = currentTime.getDay()

    // Find the soonest optimal hour (today or tomorrow)
    let selectedHour = topHours[0].hour
    let selectedDay = dayOfWeek

    for (const { hour } of topHours) {
      if (hour > currentHour) {
        selectedHour = hour
        selectedDay = dayOfWeek
        break
      }
    }

    // If all top hours are in the past today, schedule for tomorrow
    if (selectedHour <= currentHour) {
      selectedDay = (dayOfWeek + 1) % 7
    }

    const selected = ucbScores.find(s => s.hour === selectedHour)!
    const confidence = selected.plays > 10 ? 0.8 : selected.plays / 10

    return {
      hour: selectedHour,
      dayOfWeek: selectedDay,
      confidence,
      expectedReward: selected.avgReward,
      reasoning: selected.plays === 0
        ? `Exploring new time slot (${selectedHour}:00) - no data yet`
        : `Based on ${selected.plays} sends with average reward ${selected.avgReward.toFixed(2)}`,
    }
  }

  /**
   * Record engagement event and update learning stats
   */
  async recordEngagement(
    agentId: string,
    replyJobId: string,
    eventType: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced',
    timestamp: Date = new Date()
  ): Promise<void> {
    const hour = timestamp.getHours()
    const dayOfWeek = timestamp.getDay()

    // Get or create stats record for this hour
    const { data: existing, error: fetchError } = await this.supabase
      .from('agent_stats_hourly')
      .select('*')
      .eq('agent_id', agentId)
      .eq('hour_of_day', hour)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching agent stats:', fetchError)
      return
    }

    // Prepare update data
    const updates: any = {
      last_updated_at: new Date().toISOString(),
    }

    if (eventType === 'sent') {
      updates.emails_sent = (existing?.emails_sent || 0) + 1
    } else if (eventType === 'opened') {
      updates.emails_opened = (existing?.emails_opened || 0) + 1
    } else if (eventType === 'clicked') {
      updates.emails_clicked = (existing?.emails_clicked || 0) + 1
    } else if (eventType === 'replied') {
      updates.emails_replied = (existing?.emails_replied || 0) + 1
    } else if (eventType === 'bounced') {
      updates.emails_bounced = (existing?.emails_bounced || 0) + 1
    }

    // Recalculate reward score
    const sent = updates.emails_sent ?? existing?.emails_sent ?? 0
    const opened = updates.emails_opened ?? existing?.emails_opened ?? 0
    const replied = updates.emails_replied ?? existing?.emails_replied ?? 0
    const bounced = updates.emails_bounced ?? existing?.emails_bounced ?? 0

    updates.reward_score = opened + (3 * replied) - (5 * bounced)
    updates.confidence_score = Math.min(1.0, sent / 20) // Max confidence at 20 sends

    if (existing) {
      // Update existing record
      await this.supabase
        .from('agent_stats_hourly')
        .update(updates)
        .eq('id', existing.id)
    } else {
      // Create new record
      await this.supabase
        .from('agent_stats_hourly')
        .insert({
          agent_id: agentId,
          hour_of_day: hour,
          day_of_week: dayOfWeek,
          ...updates,
        })
    }
  }

  /**
   * Get performance analytics for an agent
   */
  async getAgentAnalytics(agentId: string): Promise<{
    totalSent: number
    totalOpened: number
    totalReplied: number
    totalBounced: number
    openRate: number
    replyRate: number
    bounceRate: number
    bestHours: number[]
    worstHours: number[]
  }> {
    const { data: stats, error } = await this.supabase
      .from('agent_stats_hourly')
      .select('*')
      .eq('agent_id', agentId)

    if (error || !stats || stats.length === 0) {
      return {
        totalSent: 0,
        totalOpened: 0,
        totalReplied: 0,
        totalBounced: 0,
        openRate: 0,
        replyRate: 0,
        bounceRate: 0,
        bestHours: [],
        worstHours: [],
      }
    }

    // Aggregate totals
    const totalSent = stats.reduce((sum, s) => sum + s.emails_sent, 0)
    const totalOpened = stats.reduce((sum, s) => sum + s.emails_opened, 0)
    const totalReplied = stats.reduce((sum, s) => sum + s.emails_replied, 0)
    const totalBounced = stats.reduce((sum, s) => sum + s.emails_bounced, 0)

    // Calculate rates
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0
    const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0

    // Find best/worst hours
    const hourlyPerformance = stats
      .filter(s => s.emails_sent >= 5) // Minimum 5 sends for reliability
      .map(s => ({
        hour: s.hour_of_day,
        rewardPerSend: s.reward_score / s.emails_sent,
      }))
      .sort((a, b) => b.rewardPerSend - a.rewardPerSend)

    const bestHours = hourlyPerformance.slice(0, 3).map(h => h.hour)
    const worstHours = hourlyPerformance.slice(-3).reverse().map(h => h.hour)

    return {
      totalSent,
      totalOpened,
      totalReplied,
      totalBounced,
      openRate,
      replyRate,
      bounceRate,
      bestHours,
      worstHours,
    }
  }

  /**
   * Default recommendation when no learning data exists
   */
  private getDefaultRecommendation(currentTime: Date): OptimalTimeRecommendation {
    const currentHour = currentTime.getHours()
    const dayOfWeek = currentTime.getDay()

    // Smart defaults: 10 AM, 2 PM, or 4 PM (business hours)
    const defaultHours = [10, 14, 16]
    let selectedHour = defaultHours.find(h => h > currentHour) || defaultHours[0]
    let selectedDay = dayOfWeek

    // If all default hours passed today, use tomorrow
    if (selectedHour <= currentHour) {
      selectedDay = (dayOfWeek + 1) % 7
    }

    return {
      hour: selectedHour,
      dayOfWeek: selectedDay,
      confidence: 0.5, // Medium confidence for defaults
      expectedReward: 0,
      reasoning: 'Using smart default (no learning data yet)',
    }
  }
}

// Export singleton factory
export function createLearningService(supabase: Supabase): AgentLearningService {
  return new AgentLearningService(supabase)
}
```

### 2. Integrate into Reply Job Processor

Modify `lib/reply-job-processor.ts`:

```typescript
import { createLearningService } from './learning-service'

export class ReplyJobProcessor {
  // ... existing code ...

  private async processReplyJob(job: any): Promise<void> {
    // ... existing send logic ...

    // After successful send, record engagement
    const learningService = createLearningService(this.supabase)
    await learningService.recordEngagement(
      job.agent_id,
      job.id,
      'sent',
      new Date()
    )
  }
}
```

### 3. Integrate into Draft Service

Modify `lib/outreach-agent-draft.ts`:

```typescript
import { createLearningService } from './learning-service'

export class OutreachAgentDraftService {
  private async calculateSendTiming(
    agent: any,
    riskScore: number
  ): Promise<{ scheduledAt: Date; editableUntil: Date }> {
    const now = new Date()

    // OPTION 1: Use learning-based timing (if enough data)
    const learningService = createLearningService(this.supabase)
    const optimalTime = await learningService.getOptimalSendTime(agent.id, now)

    if (optimalTime.confidence > 0.7) {
      // Use learned optimal time
      const scheduledAt = new Date(now)
      scheduledAt.setHours(optimalTime.hour, 0, 0, 0)

      // If in the past, schedule for next occurrence
      if (scheduledAt <= now) {
        scheduledAt.setDate(scheduledAt.getDate() + 1)
      }

      const editableUntil = new Date(scheduledAt.getTime() - 5 * 60 * 1000)

      console.log(
        `✨ Using learned optimal time: ${optimalTime.hour}:00 ` +
        `(confidence: ${(optimalTime.confidence * 100).toFixed(0)}%) - ` +
        optimalTime.reasoning
      )

      return { scheduledAt, editableUntil }
    }

    // OPTION 2: Fallback to risk-based timing (existing logic)
    const baseDelayMinutes = 5 + Math.floor(Math.random() * 10) // 5-15 min
    const riskDelayMinutes = Math.floor(riskScore * 30) // Up to 30 min for high risk
    const totalDelayMinutes = baseDelayMinutes + riskDelayMinutes

    const scheduledAt = new Date(now.getTime() + totalDelayMinutes * 60 * 1000)
    const editableUntil = new Date(scheduledAt.getTime() - 2 * 60 * 1000)

    return { scheduledAt, editableUntil }
  }
}
```

### 4. Track Engagement Events

Create webhook/handler for tracking opens, clicks, replies:

```typescript
// lib/engagement-tracker.ts
import { createLearningService } from './learning-service'
import type { Supabase } from './learning-service'

export async function trackEngagementEvent(
  supabase: Supabase,
  replyJobId: string,
  eventType: 'opened' | 'clicked' | 'replied' | 'bounced'
): Promise<void> {
  // Get reply job details
  const { data: job, error } = await supabase
    .from('reply_jobs')
    .select('agent_id, sent_at')
    .eq('id', replyJobId)
    .single()

  if (error || !job) {
    console.error('Error fetching reply job for engagement tracking:', error)
    return
  }

  // Record engagement in learning system
  const learningService = createLearningService(supabase)
  await learningService.recordEngagement(
    job.agent_id,
    replyJobId,
    eventType,
    new Date()
  )

  console.log(`📊 Recorded ${eventType} event for agent ${job.agent_id}`)
}
```

### 5. Create Analytics API Endpoint

```typescript
// src/app/api/outreach-agents/[agentId]/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, addSecurityHeaders } from '@/lib/auth-middleware'
import { createLearningService } from '@/lib/learning-service'

export const GET = withAuth(async (
  request: NextRequest,
  { user, supabase },
  { params }: { params: Promise<{ agentId: string }> }
) => {
  try {
    const { agentId } = await params

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('outreach_agents')
      .select('id, name')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({
        error: 'Agent not found',
        code: 'NOT_FOUND',
      }, { status: 404 })
    }

    // Get analytics
    const learningService = createLearningService(supabase)
    const analytics = await learningService.getAgentAnalytics(agentId)

    // Get optimal time recommendation
    const optimalTime = await learningService.getOptimalSendTime(agentId)

    const response = NextResponse.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
        },
        performance: analytics,
        optimization: {
          optimalHour: optimalTime.hour,
          confidence: optimalTime.confidence,
          expectedReward: optimalTime.expectedReward,
          reasoning: optimalTime.reasoning,
        },
      },
    })

    return addSecurityHeaders(response)
  } catch (error) {
    console.error('Error fetching agent analytics:', error)
    return NextResponse.json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
```

### 6. Create Analytics Dashboard Component

```typescript
// components/outreach-agents/AgentAnalyticsDashboard.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { ApiClient } from '@/lib/api-client'

interface AgentAnalytics {
  performance: {
    totalSent: number
    totalOpened: number
    totalReplied: number
    openRate: number
    replyRate: number
    bestHours: number[]
  }
  optimization: {
    optimalHour: number
    confidence: number
    reasoning: string
  }
}

export function AgentAnalyticsDashboard({ agentId }: { agentId: string }) {
  const [analytics, setAnalytics] = useState<AgentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [agentId])

  const loadAnalytics = async () => {
    try {
      const response = await ApiClient.get(`/api/outreach-agents/${agentId}/analytics`)
      setAnalytics(response.data)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading analytics...</div>
  if (!analytics) return <div>No analytics available</div>

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Open Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.performance.openRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {analytics.performance.totalOpened} / {analytics.performance.totalSent}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reply Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.performance.replyRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {analytics.performance.totalReplied} / {analytics.performance.totalSent}
          </p>
        </CardContent>
      </Card>

      {/* Optimal Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Optimal Send Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {analytics.optimization.optimalHour}:00
          </div>
          <Badge variant={analytics.optimization.confidence > 0.7 ? 'default' : 'secondary'}>
            {(analytics.optimization.confidence * 100).toFixed(0)}% confidence
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            {analytics.optimization.reasoning}
          </p>
        </CardContent>
      </Card>

      {/* Best Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Best Performing Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {analytics.performance.bestHours.map(hour => (
              <Badge key={hour} variant="outline">
                {hour}:00
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

## Testing Strategy

### 1. Unit Tests
```typescript
// Test UCB1 algorithm
// Test reward calculation
// Test optimal time selection
```

### 2. Integration Tests
```typescript
// Test engagement recording
// Test analytics aggregation
// Test API endpoints
```

### 3. Manual Testing with Sample Data
```sql
-- Insert sample learning data for testing
INSERT INTO agent_stats_hourly (agent_id, hour_of_day, emails_sent, emails_opened, emails_replied, reward_score)
VALUES
  ('agent-id', 10, 50, 25, 10, 55), -- 10 AM: Good performance
  ('agent-id', 14, 40, 30, 8, 54),  -- 2 PM: Good performance
  ('agent-id', 22, 20, 5, 1, 8);    -- 10 PM: Poor performance
```

## Performance Considerations

- **Database Indexes**: Already created on `agent_id` and `hour_of_day`
- **Caching**: Cache analytics for 5-10 minutes to reduce DB load
- **Batch Updates**: Update stats in batches during cron job runs
- **Async Processing**: Track engagement events asynchronously

## Rollout Strategy

1. **Phase 5a**: Deploy learning service and start collecting data (no optimization yet)
2. **Phase 5b**: Monitor data quality for 1-2 weeks
3. **Phase 5c**: Enable optimization for agents with >50 sends
4. **Phase 5d**: Gradually increase confidence threshold as data improves

## Success Metrics

- **Learning Coverage**: % of agents with >20 sends per hour slot
- **Optimization Adoption**: % of replies using learned vs default timing
- **Performance Improvement**: Compare open/reply rates before/after optimization
- **Confidence Growth**: Track how confidence scores improve over time

## Future Enhancements

- Day-of-week optimization (Monday vs Friday patterns)
- Recipient timezone detection and optimization
- Industry/vertical-specific learning
- A/B testing framework for continuous improvement
- Seasonal pattern detection (holidays, quarters, etc.)
