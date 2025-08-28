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
  const [progress, setProgress] = useState<ProgressStats>({
    total: campaign.contactCount || campaign.total_contacts || 0,
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
      
      // Get updated campaign stats
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

      if (campaignData) {
        const newProgress = {
          total: campaignData.total_contacts || campaign.contactCount || campaign.total_contacts || 0,
          sent: sentCount,
          delivered: deliveredCount,
          opened: openedCount || 0,
          failed: failedCount,
          queued: Math.max(0, (campaignData.total_contacts || 0) - sentCount - failedCount),
          lastUpdated: campaignData.updated_at
        }
        
        console.log(`📊 Real progress for campaign ${campaign.id}:`, newProgress)
        setProgress(newProgress)
        
        // AUTO-COMPLETION CHECK: If 100% complete but status is still 'sending', refresh campaign status
        if (newProgress.sent >= newProgress.total && newProgress.total > 0 && (campaign.status === 'sending' || campaign.status === 'running')) {
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
                .select('status, completed_at')
                .eq('id', campaign.id)
                .single()
              
              if (queryError) {
                console.error(`❌ Query error for campaign ${campaign.id}:`, queryError)
                throw queryError
              }
              
              console.log(`📊 Database status for campaign ${campaign.id}:`, updatedCampaign?.status)
              
              if (updatedCampaign && updatedCampaign.status === 'completed') {
                console.log(`✅ Campaign ${campaign.id} status updated to completed - refreshing UI`)
                onProgressUpdate?.(campaign.id, { 
                  ...campaign, 
                  status: 'completed',
                  completed_at: updatedCampaign.completed_at,
                  updated_at: new Date().toISOString()
                })
              } else {
                console.log(`⏳ Campaign ${campaign.id} not completed yet, will retry in 3 seconds`)
                // Retry after 3 seconds
                setTimeout(checkCompletion, 3000)
              }
            } catch (error) {
              console.error(`❌ Campaign completion check failed for ${campaign.id}:`, {
                error: error?.message || error,
                code: error?.code,
                details: error?.details,
                hint: error?.hint
              })
              
              // If we get authentication or RLS errors, stop retrying
              if (error?.code === 'PGRST301' || error?.code === '42501' || error?.message?.includes('400') || error?.message?.includes('permission denied')) {
                console.error('🚨 Authentication or RLS policy error - stopping retries for campaign', campaign.id)
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