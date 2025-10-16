'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw, Sparkles, User, Flag } from 'lucide-react'
import clsx from 'clsx'
import { useState } from 'react'
import { toast } from 'sonner'

interface EmailInsight {
  sender_name: string
  sender_email: string
  subject: string
  firstliner: string
  summary: string
  intent: string
  contact_status: 'green' | 'yellow' | 'red'
  agent_id?: string | null
  agent_persona?: string | null
}

interface AISummaryCardProps {
  insight: EmailInsight | null
  loading: boolean
  onGenerate: (forceRegenerate?: boolean) => void
  onRegenerate?: () => void
  onFlagContact?: (senderEmail: string, intent: string) => Promise<void>
  className?: string
}

const INTENT_META: Record<string, { label: string; icon: string; color: string }> = {
  purchase_interest: { label: 'Purchase Interest', icon: '💰', color: 'bg-emerald-100 text-emerald-700' },
  meeting_request: { label: 'Meeting Request', icon: '📅', color: 'bg-blue-100 text-blue-700' },
  info_request: { label: 'Info Request', icon: '❓', color: 'bg-sky-100 text-sky-700' },
  positive_reply: { label: 'Positive Reply', icon: '✨', color: 'bg-indigo-100 text-indigo-700' },
  negative_reply: { label: 'Negative Reply', icon: '⚠️', color: 'bg-rose-100 text-rose-700' },
  unsubscribe: { label: 'Unsubscribe', icon: '🚫', color: 'bg-rose-100 text-rose-700' },
  invalid_contact: { label: 'Invalid Contact', icon: '❌', color: 'bg-rose-100 text-rose-700' },
  auto_reply: { label: 'Auto Reply', icon: '🤖', color: 'bg-slate-100 text-slate-600' },
  other: { label: 'Other', icon: '📨', color: 'bg-slate-100 text-slate-600' },
}

const STATUS_META: Record<'green' | 'yellow' | 'red', { label: string; className: string }> = {
  green: { label: 'Engaged', className: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30' },
  yellow: { label: 'Neutral', className: 'bg-amber-500/10 text-amber-700 border border-amber-500/30' },
  red: { label: 'At Risk', className: 'bg-rose-500/10 text-rose-700 border border-rose-500/30' },
}

export function AISummaryCard({
  insight,
  loading,
  onGenerate,
  onRegenerate,
  onFlagContact,
  className,
}: AISummaryCardProps) {
  const [flagging, setFlagging] = useState(false)

  const handleFlagContact = async () => {
    if (!insight || !onFlagContact) return

    setFlagging(true)
    try {
      await onFlagContact(insight.sender_email, insight.intent)
      toast.success('Contact flagged as "Do Not Contact"', {
        description: `${insight.sender_name} will be excluded from future campaigns`
      })
    } catch (error) {
      console.error('Failed to flag contact:', error)
      toast.error('Failed to flag contact', {
        description: 'Please try again or contact support'
      })
    } finally {
      setFlagging(false)
    }
  }

  if (!insight && !loading) {
    return (
      <div className={clsx('rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-50/50 via-blue-50/30 to-sky-50/50 p-6', className)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">AI Summary</h3>
              <p className="mt-1 text-sm text-slate-600">
                Generate an intelligent summary of this email using AI
              </p>
            </div>
          </div>
          <Button
            onClick={(e) => {
              const forceRegen = e.shiftKey
              if (forceRegen) {
                console.log('🔄 Force regenerate requested (Shift+Click)')
              }
              onGenerate(forceRegen)
            }}
            variant="outline"
            className="gap-2 bg-white hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50"
            title="Click to generate | Shift+Click to force regenerate"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate</span>
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={clsx('rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-50/50 via-blue-50/30 to-sky-50/50 p-6', className)}>
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-purple-600" />
          <p className="text-sm font-medium text-slate-700">Generating AI summary...</p>
        </div>
      </div>
    )
  }

  if (!insight) return null

  const intentMeta = INTENT_META[insight.intent] || INTENT_META.other
  const statusMeta = STATUS_META[insight.contact_status]

  return (
    <div className={clsx('rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-50/50 via-blue-50/30 to-sky-50/50 p-6 shadow-sm', className)}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">AI Summary</h3>
              {insight.agent_persona && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="h-3 w-3" />
                  <span>Analyzed by: {insight.agent_persona}</span>
                </div>
              )}
            </div>
          </div>
          {onRegenerate && (
            <Button
              onClick={onRegenerate}
              variant="ghost"
              size="sm"
              className="gap-2 text-slate-600 hover:text-purple-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Regenerate</span>
            </Button>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm leading-relaxed text-slate-700">{insight.summary}</p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium', intentMeta.color)}>
            <span>{intentMeta.icon}</span>
            <span>{intentMeta.label}</span>
          </span>
          <span className={clsx('rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide', statusMeta.className)}>
            {statusMeta.label}
          </span>
        </div>

        {/* Flag Button for Red Status */}
        {insight.contact_status === 'red' && onFlagContact && (
          <div className="rounded-2xl bg-rose-50/50 p-4 border border-rose-200/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-rose-900">Flag as Do Not Contact</p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Mark this contact to exclude from future campaigns
                </p>
              </div>
              <Button
                onClick={handleFlagContact}
                disabled={flagging}
                variant="outline"
                size="sm"
                className="gap-2 bg-white border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              >
                {flagging ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Flagging...</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-3.5 w-3.5" />
                    <span>Flag Contact</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
