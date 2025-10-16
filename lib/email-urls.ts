/**
 * Email URL Helper Utilities
 * Generate dashboard URLs for email CTAs
 */

/**
 * Get the base URL for the application
 */
export function getBaseUrl(): string {
  // Use NEXT_PUBLIC_APP_URL from environment, fallback to localhost in development
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

/**
 * Get URL to edit a reply job draft
 */
export function getReplyJobEditUrl(replyJobId: string): string {
  return `${getBaseUrl()}/dashboard/reply-jobs/${replyJobId}/edit`
}

/**
 * Get URL to cancel a scheduled reply
 */
export function getReplyJobCancelUrl(replyJobId: string): string {
  return `${getBaseUrl()}/dashboard/reply-jobs/${replyJobId}/cancel`
}

/**
 * Get URL to persona settings page
 */
export function getPersonaSettingsUrl(personaId?: string): string {
  if (personaId) {
    return `${getBaseUrl()}/dashboard/ai-personas/${personaId}?tab=settings`
  }
  return `${getBaseUrl()}/dashboard/settings`
}

/**
 * Get URL to view a specific reply job
 */
export function getReplyJobViewUrl(replyJobId: string): string {
  return `${getBaseUrl()}/dashboard/reply-jobs/${replyJobId}`
}

/**
 * Get URL to the mailbox
 */
export function getMailboxUrl(): string {
  return `${getBaseUrl()}/dashboard/mailbox`
}
