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
  Square
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

  // Real-time subscription for campaign updates
  useEffect(() => {
    const supabase = createClientSupabase()
    
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
          const updatedCampaign = payload.new as any
          setProgress(prev => ({
            ...prev,
            total: updatedCampaign.total_contacts || prev.total,
            sent: updatedCampaign.emails_sent || 0,
            delivered: updatedCampaign.emails_delivered || 0,
            opened: updatedCampaign.emails_opened || 0,
            failed: updatedCampaign.emails_failed || 0,
            lastUpdated: updatedCampaign.updated_at
          }))
          
          onProgressUpdate?.(campaign.id, updatedCampaign)
        }
      )
      .subscribe()

    // Subscribe to email tracking updates
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
        () => {
          // Refresh progress stats when new tracking records are added
          fetchLatestProgress()
        }
      )
      .subscribe()

    return () => {
      campaignSubscription.unsubscribe()
      trackingSubscription.unsubscribe()
    }
  }, [campaign.id, onProgressUpdate])

  // Fetch latest progress from database
  const fetchLatestProgress = async () => {
    try {
      setIsLoading(true)
      const supabase = createClientSupabase()
      
      // Get updated campaign stats
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('total_contacts, emails_sent, emails_delivered, emails_opened, emails_failed, updated_at')
        .eq('id', campaign.id)
        .single()

      if (campaignData) {
        setProgress(prev => ({
          ...prev,
          total: campaignData.total_contacts || prev.total,
          sent: campaignData.emails_sent || 0,
          delivered: campaignData.emails_delivered || 0,
          opened: campaignData.emails_opened || 0,
          failed: campaignData.emails_failed || 0,
          lastUpdated: campaignData.updated_at
        }))
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