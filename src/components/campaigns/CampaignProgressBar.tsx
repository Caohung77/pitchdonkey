'use client'

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Mail,
  Users,
  TrendingUp,
  Pause,
  Play,
  Square,
  RefreshCw
} from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase-client'

interface CampaignProgressBarProps {
  campaign: {
    id: string
    name: string
    status: 'draft' | 'scheduled' | 'sending' | 'running' | 'paused' | 'stopped' | 'completed' | 'archived'
    contactCount: number
    emailsSent: number
    total_contacts?: number
    emails_delivered?: number
    emails_opened?: number
    emails_failed?: number
    created_at: string
    updated_at: string
    next_batch_send_time?: string
    batch_schedule?: {
      batches: Array<{
        batch_number: number
        scheduled_time: string
        contact_ids: string[]
        contact_count: number
        status: 'pending' | 'sent'
      }>
      batch_size: number
      batch_interval_minutes: number
      total_batches: number
      total_contacts: number
      estimated_completion: string
    }
  }
  showDetails?: boolean
  onProgressUpdate?: (campaignId: string, progress: any) => void
}

interface ProgressStats {
  total: number
  sent: number
  delivered: number
  opened: number
  failed: number
  queued: number
  lastUpdated: string
}

export function CampaignProgressBar({
  campaign,
  showDetails = true,
  onProgressUpdate
}: CampaignProgressBarProps) {
  // Use batch_schedule total if available, otherwise fall back to contact count
  const totalContactsFromSchedule = campaign.batch_schedule?.total_contacts || 0
  const effectiveTotal = totalContactsFromSchedule > 0
    ? totalContactsFromSchedule
    : (campaign.total_contacts || campaign.contactCount || 0)

  const [progress, setProgress] = useState<ProgressStats>({
    total: effectiveTotal,
    sent: campaign.emailsSent || 0,
    delivered: campaign.emails_delivered || 0,
    opened: campaign.emails_opened || 0,
    failed: campaign.emails_failed || 0,
    queued: 0,
    lastUpdated: campaign.updated_at
  })

  const [isLoading, setIsLoading] = useState(false)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null)

  // Calculate derived stats
  const completionPercentage = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0
  const deliveryRate = progress.sent > 0 ? Math.round((progress.delivered / progress.sent) * 100) : 0
  const openRate = progress.delivered > 0 ? Math.round((progress.opened / progress.delivered) * 100) : 0
  const queuedEmails = Math.max(0, progress.total - progress.sent - progress.failed)

  // Calculate batch schedule progress
  const sentBatches = campaign.batch_schedule?.batches.filter(b => b.status === 'sent').length || 0
  const totalBatches = campaign.batch_schedule?.total_batches || 0
  const nextPendingBatch = campaign.batch_schedule?.batches.find(b => b.status === 'pending')

  // Use actual campaign status from database - don't override status based on progress calculations
  // This ensures campaigns show correct status: 'sending'/'running' for active campaigns, 'completed' only when actually finished

  // Real-time subscription for campaign updates + auto-refresh during sending
  useEffect(() => {
    const supabase = createClientSupabase()
    
    // Fetch initial progress
    fetchLatestProgress()
    
    // Subscribe to campaign updates
    const campaignSubscription = supabase
      .channel(`campaign-${campaign.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaign.id}`
        },
        (payload) => {
          console.log(`📈 Campaign updated for ${campaign.id}:`, payload.new)
          // Re-fetch actual progress instead of relying on campaign fields
          fetchLatestProgress()
          onProgressUpdate?.(campaign.id, payload.new)
        }
      )
      .subscribe()

    // Auto-refresh every 10 seconds when campaign is actively sending
    let refreshInterval: NodeJS.Timeout | null = null
    if (campaign.status === 'sending' || campaign.status === 'running') {
      refreshInterval = setInterval(() => {
        console.log(`🔄 Auto-refreshing progress for sending campaign ${campaign.id}`)
        fetchLatestProgress()
      }, 10000) // Refresh every 10 seconds
    }

    // Subscribe to email tracking updates - this is key for real-time progress
    const trackingSubscription = supabase
      .channel(`tracking-${campaign.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_tracking',
          filter: `campaign_id=eq.${campaign.id}`
        },
        (payload) => {
          console.log(`📧 New email tracked for campaign ${campaign.id}:`, payload.new)
          // Refresh progress stats when new tracking records are added
          fetchLatestProgress()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_tracking',
          filter: `campaign_id=eq.${campaign.id}`
        },
        (payload) => {
          console.log(`📧 Email tracking updated for campaign ${campaign.id}:`, payload.new)
          // Refresh progress when tracking records are updated (e.g., opened, clicked)
          fetchLatestProgress()
        }
      )
      .subscribe()

    return () => {
      campaignSubscription.unsubscribe()
      trackingSubscription.unsubscribe()
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [campaign.id, onProgressUpdate])

  // Fetch latest progress from database by counting actual email tracking records
  const fetchLatestProgress = async () => {
    try {
      setIsLoading(true)
      const supabase = createClientSupabase()
      
      // DEBUG: Log current campaign status
      console.log(`🔍 fetchLatestProgress for campaign ${campaign.id}: current status = ${campaign.status}`)
      
      // FOR COMPLETED CAMPAIGNS: Use historical data, don't recalculate total_contacts
      if (campaign.status === 'completed') {
        console.log(`✅ Skipping contact count recalculation for completed campaign - using original data`)
        
        // Count actual emails from tracking table using timestamp fields
        const { data: emailStats } = await supabase
          .from('email_tracking')
          .select('sent_at, delivered_at, opened_at, bounced_at')
          .eq('campaign_id', campaign.id)

        // Count emails based on timestamp fields
        const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
        const deliveredCount = emailStats?.filter(e => e.delivered_at !== null).length || sentCount
        const failedCount = emailStats?.filter(e => e.bounced_at !== null).length || 0
        const openedCount = emailStats?.filter(e => e.opened_at !== null).length || 0

        // Use the original contact count from props (total_contacts is the real list size)
        const originalTotal = campaign.total_contacts || campaign.contactCount || 0
        
        const newProgress = {
          total: originalTotal, // Use original total from contact list, not tracking count
          sent: sentCount,
          delivered: deliveredCount,
          opened: openedCount || 0,
          failed: failedCount,
          queued: Math.max(0, originalTotal - sentCount - failedCount),
          lastUpdated: new Date().toISOString()
        }
        
        console.log(`📊 Real progress for campaign ${campaign.id}:`, newProgress)
        setProgress(newProgress)
        
        setIsLoading(false)
        return
      }
      
      // FOR ACTIVE CAMPAIGNS: Get updated campaign stats from database
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('total_contacts, updated_at')
        .eq('id', campaign.id)
        .single()

      // Count actual emails from tracking table using timestamp fields (matches actual schema)
      const { data: emailStats } = await supabase
        .from('email_tracking')
        .select('sent_at, delivered_at, opened_at, bounced_at')
        .eq('campaign_id', campaign.id)

      // Count emails based on timestamp fields (matches actual database schema)
      const sentCount = emailStats?.filter(e => e.sent_at !== null).length || 0
      const deliveredCount = emailStats?.filter(e => e.delivered_at !== null).length || sentCount // Default to sent if no delivery tracking
      const failedCount = emailStats?.filter(e => e.bounced_at !== null).length || 0
      const openedCount = emailStats?.filter(e => e.opened_at !== null).length || 0

      // Use email tracking count as total for active campaigns (ground truth)
      // This ensures campaigns show accurate completion when contacts are deleted from lists after launch
      const totalContactsFromTracking = emailStats?.length || 0
      const effectiveTotal = totalContactsFromTracking > 0 
        ? totalContactsFromTracking 
        : (campaignData?.total_contacts || campaign.contactCount || campaign.total_contacts || 0)
      
      console.log(`  📊 Email tracking records: ${totalContactsFromTracking}`)
      console.log(`  📊 Using effective total: ${effectiveTotal}`)

      if (campaignData || emailStats) {
        const newProgress = {
          total: effectiveTotal,
          sent: sentCount,
          delivered: deliveredCount,
          opened: openedCount || 0,
          failed: failedCount,
          queued: Math.max(0, effectiveTotal - sentCount - failedCount),
          lastUpdated: campaignData?.updated_at || new Date().toISOString()
        }
        
        console.log(`📊 Real progress for campaign ${campaign.id}:`, newProgress)
        setProgress(newProgress)
        
        // AUTO-COMPLETION CHECK: If 100% complete but status is still 'sending' or 'running', refresh campaign status
        const isFullyProcessed = newProgress.total > 0 && (newProgress.sent + newProgress.failed) >= newProgress.total
        if (isFullyProcessed && (campaign.status === 'sending' || campaign.status === 'running')) {
          console.log(`🎉 Campaign ${campaign.id} reached 100% (${newProgress.sent}/${newProgress.total}) but status is '${campaign.status}' - checking for completion`)
          
          // IMMEDIATE CHECK: Don't wait, check database immediately
          const checkCompletion = async () => {
            try {
              // Check if user is authenticated first
              const { data: { user }, error: authError } = await supabase.auth.getUser()
              if (authError || !user) {
                console.error('🚨 User not authenticated, cannot check campaign status:', authError)
                return
              }
              
              console.log(`🔍 Checking completion status for campaign: ${campaign.id} (user: ${user.id})`)
              
              const { data: updatedCampaign, error: queryError } = await supabase
                .from('campaigns')
                .select('status, updated_at')
                .eq('id', campaign.id)
                .maybeSingle()

              // Handle query errors with better error checking
              if (queryError) {
                // Check if it's a meaningful error object
                if (queryError.code || queryError.message || queryError.details) {
                  console.error(`❌ Query error for campaign ${campaign.id}:`, {
                    code: queryError.code,
                    message: queryError.message,
                    details: queryError.details,
                    hint: queryError.hint
                  })
                  throw queryError
                } else {
                  // Log empty error objects for debugging but don't throw
                  console.warn(`⚠️ Empty error object for campaign ${campaign.id}:`, queryError)
                }
              }
              
              if (!updatedCampaign) {
                console.warn(`⚠️ No campaign data returned for campaign ${campaign.id} - it may have been deleted`)
                return
              }
              
              console.log(`📊 Database status for campaign ${campaign.id}:`, updatedCampaign?.status || 'unknown')
              
              if (updatedCampaign && updatedCampaign.status === 'completed') {
                console.log(`✅ Campaign ${campaign.id} status updated to completed - refreshing UI`)
                onProgressUpdate?.(campaign.id, { 
                  ...campaign, 
                  status: 'completed',
                  updated_at: updatedCampaign.updated_at || new Date().toISOString()
                })
              } else {
                console.log(`⏳ Campaign ${campaign.id} not completed yet, will retry in 3 seconds`)
                // Retry after 3 seconds
                setTimeout(checkCompletion, 3000)
              }
            } catch (error) {
              const errorDetails = {
                message: error?.message || 'Unknown error',
                code: error?.code || 'NO_CODE',
                details: error?.details || 'No details',
                hint: error?.hint || 'No hint'
              }
              
              console.error(`❌ Campaign completion check failed for ${campaign.id}:`, errorDetails)
              
              // If we get authentication or RLS errors, stop retrying
              if (error?.code === 'PGRST301' || error?.code === '42501' || error?.message?.includes('400') || error?.message?.includes('permission denied')) {
                console.error('🚨 Authentication or RLS policy error - stopping retries for campaign', campaign.id)
                return
              }
              
              // If we get schema/column errors, stop retrying
              if (error?.code === 'PGRST116' || error?.message?.includes('column') || error?.message?.includes('relation')) {
                console.error('🚨 Schema or column error - stopping retries for campaign', campaign.id)
                return
              }
            }
          }
          
          // Check immediately
          checkCompletion()
        }
      }

      // Calculate estimated time remaining for sending campaigns
      if (campaign.status === 'sending' || campaign.status === 'running') {
        calculateTimeRemaining()
      }
      
    } catch (error) {
      console.error('Error fetching progress:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate estimated completion time
  const calculateTimeRemaining = () => {
    if (progress.sent === 0 || queuedEmails === 0) {
      setEstimatedTimeRemaining(null)
      return
    }

    // Assuming 45-second average delay between emails (30-60 second range)
    const avgDelaySeconds = 45
    const estimatedSeconds = queuedEmails * avgDelaySeconds
    
    if (estimatedSeconds < 60) {
      setEstimatedTimeRemaining(`${Math.round(estimatedSeconds)}s remaining`)
    } else if (estimatedSeconds < 3600) {
      setEstimatedTimeRemaining(`${Math.round(estimatedSeconds / 60)}m remaining`)
    } else {
      const hours = Math.floor(estimatedSeconds / 3600)
      const minutes = Math.round((estimatedSeconds % 3600) / 60)
      setEstimatedTimeRemaining(`${hours}h ${minutes}m remaining`)
    }
  }

  // Update time estimate when progress changes
  useEffect(() => {
    if (campaign.status === 'sending' || campaign.status === 'running') {
      calculateTimeRemaining()
    } else {
      setEstimatedTimeRemaining(null)
    }
  }, [progress, campaign.status, queuedEmails])

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (campaign.status) {
      case 'sending':
      case 'running':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          color: 'bg-blue-100 text-blue-800',
          text: 'Sending'
        }
      case 'paused':
        return {
          icon: <Pause className="h-3 w-3" />,
          color: 'bg-yellow-100 text-yellow-800',
          text: 'Paused'
        }
      case 'completed':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          color: 'bg-green-100 text-green-800',
          text: 'Completed'
        }
      case 'stopped':
        return {
          icon: <Square className="h-3 w-3" />,
          color: 'bg-red-100 text-red-800',
          text: 'Stopped'
        }
      case 'scheduled':
        return {
          icon: <Clock className="h-3 w-3" />,
          color: 'bg-purple-100 text-purple-800',
          text: 'Scheduled'
        }
      default:
        return {
          icon: <Mail className="h-3 w-3" />,
          color: 'bg-gray-100 text-gray-800',
          text: 'Draft'
        }
    }
  }

  const statusDisplay = getStatusDisplay()

  return (
    <div className="space-y-3">
      {/* Batch Schedule Info - Show for campaigns with batch scheduling */}
      {campaign.batch_schedule && (campaign.status === 'sending' || campaign.status === 'running' || campaign.status === 'completed') && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white border-blue-300 text-blue-700">
                Batch {sentBatches}/{totalBatches}
              </Badge>
              <span className="text-xs text-blue-700">
                {campaign.batch_schedule.batch_size} emails per batch • {campaign.batch_schedule.batch_interval_minutes} min intervals
              </span>
            </div>
            {nextPendingBatch && (
              <div className="text-xs text-blue-700 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Next: {new Date(nextPendingBatch.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status and Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge className={statusDisplay.color}>
            {statusDisplay.icon}
            <span className="ml-1">{statusDisplay.text}</span>
          </Badge>
          {isLoading && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          )}
          {(campaign.status === 'sending' || campaign.status === 'running') && (
            <button
              onClick={() => {
                fetchLatestProgress()
                // Also force check completion status when refresh is clicked
                console.log(`🔄 Manual refresh - also checking completion status for ${campaign.id}`)
              }}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh progress and check completion"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {estimatedTimeRemaining && (
          <span className="text-xs text-gray-500 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {estimatedTimeRemaining}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">
            {progress.sent} of {progress.total} emails sent
          </span>
          <span className="text-sm text-gray-500">
            {completionPercentage}%
          </span>
        </div>
        
        <Progress 
          value={completionPercentage} 
          className="h-2"
          indicatorClassName={
            campaign.status === 'sending' || campaign.status === 'running'
              ? 'bg-blue-500 transition-all duration-500'
              : campaign.status === 'completed'
                ? 'bg-green-500'
                : 'bg-gray-400'
          }
        />
        
        {queuedEmails > 0 && (campaign.status === 'sending' || campaign.status === 'running') && (
          <div className="text-xs text-gray-500">
            {queuedEmails} emails queued for sending
          </div>
        )}
      </div>

      {/* Detailed Stats */}
      {showDetails && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
          <div className="flex items-center space-x-1">
            <Mail className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-600">
              {progress.delivered} delivered
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            <TrendingUp className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-600">
              {progress.opened} opened
            </span>
          </div>
          
          {progress.failed > 0 && (
            <div className="flex items-center space-x-1">
              <AlertCircle className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-600">
                {progress.failed} failed
              </span>
            </div>
          )}
          
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            {deliveryRate}% delivery rate
          </div>
        </div>
      )}
    </div>
  )
}
