/**
 * Contact Out-of-Office (OOO) Status Helper
 *
 * Utilities for checking and managing contact auto-reply/OOO status.
 * The OOO flag is computed dynamically based on auto_reply_until timestamp.
 */

import { createServerSupabaseClient } from './supabase-server'
import { createClientSupabase } from './supabase-client'

export interface ContactOOOStatus {
  isAutoReplying: boolean
  autoReplyUntil: string | null
  hoursUntilReturn: number | null
}

/**
 * Check if a contact is currently in auto-reply/OOO mode
 * This is a simple client-side check that doesn't require database access
 */
export function isContactAutoReplying(contact: { auto_reply_until?: string | null }): boolean {
  if (!contact.auto_reply_until) return false
  return new Date(contact.auto_reply_until) > new Date()
}

/**
 * Get detailed OOO status for a contact
 */
export function getContactOOOStatus(contact: { auto_reply_until?: string | null }): ContactOOOStatus {
  const autoReplyUntil = contact.auto_reply_until || null
  const isAutoReplying = autoReplyUntil ? new Date(autoReplyUntil) > new Date() : false

  let hoursUntilReturn: number | null = null
  if (isAutoReplying && autoReplyUntil) {
    const msRemaining = new Date(autoReplyUntil).getTime() - Date.now()
    hoursUntilReturn = Math.ceil(msRemaining / (1000 * 60 * 60))
  }

  return {
    isAutoReplying,
    autoReplyUntil,
    hoursUntilReturn
  }
}

/**
 * Format OOO status for display
 */
export function formatOOOStatus(contact: { auto_reply_until?: string | null }): string {
  const status = getContactOOOStatus(contact)

  if (!status.isAutoReplying) {
    return 'Available'
  }

  if (status.hoursUntilReturn === null) {
    return 'Out of Office'
  }

  const hours = status.hoursUntilReturn
  if (hours < 24) {
    return `Out of Office (${hours}h remaining)`
  }

  const days = Math.ceil(hours / 24)
  return `Out of Office (${days}d remaining)`
}

/**
 * Get all contacts with active auto-replies (server-side)
 */
export async function getActiveAutoReplies(userId: string, useServerClient = false) {
  const supabase = useServerClient ? createServerSupabaseClient() : createClientSupabase()

  const { data, error } = await supabase
    .from('active_auto_replies')
    .select('*')
    .order('auto_reply_until', { ascending: true })

  if (error) {
    console.error('Error fetching active auto-replies:', error)
    return []
  }

  return data || []
}

/**
 * Clear auto-reply status for a contact (when they return early)
 */
export async function clearContactAutoReply(contactId: string, useServerClient = false) {
  const supabase = useServerClient ? createServerSupabaseClient() : createClientSupabase()

  const { error } = await supabase
    .from('contacts')
    .update({ auto_reply_until: null })
    .eq('id', contactId)

  if (error) {
    console.error('Error clearing auto-reply status:', error)
    throw error
  }

  console.log(`✅ Cleared auto-reply status for contact ${contactId}`)
}

/**
 * React hook for checking OOO status (client-side)
 */
export function useContactOOOStatus(contact: { auto_reply_until?: string | null } | null) {
  if (!contact) {
    return {
      isAutoReplying: false,
      autoReplyUntil: null,
      hoursUntilReturn: null,
      formattedStatus: 'Unknown'
    }
  }

  const status = getContactOOOStatus(contact)

  return {
    ...status,
    formattedStatus: formatOOOStatus(contact)
  }
}
