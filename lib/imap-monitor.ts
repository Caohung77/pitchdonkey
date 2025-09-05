import { createServerSupabaseClient } from './supabase-server'
import { imapProcessor } from './imap-processor'
import { replyProcessor } from './reply-processor'
import { decryptSMTPConfig } from './encryption'

/**
 * Background IMAP monitoring service
 * Automatically syncs emails from configured IMAP accounts and processes replies
 */
export class IMAPMonitor {
  private static instance: IMAPMonitor | null = null
  private monitoringInterval: NodeJS.Timeout | null = null
  private isRunning = false
  private supabase: any

  private constructor() {
    this.supabase = createServerSupabaseClient()
  }

  public static getInstance(): IMAPMonitor {
    if (!IMAPMonitor.instance) {
      IMAPMonitor.instance = new IMAPMonitor()
    }
    return IMAPMonitor.instance
  }

  /**
   * Start the IMAP monitoring service
   */
  public start(intervalMinutes: number = 15): void {
    if (this.monitoringInterval) {
      console.log('📧 IMAP monitor is already running')
      return
    }

    // TEMPORARILY DISABLED: IMAP monitor causing database connection issues
    console.log('⏸️ IMAP Monitor temporarily disabled due to connection issues')
    return

    const intervalMs = intervalMinutes * 60 * 1000
    console.log(`🚀 Starting IMAP Monitor (checking every ${intervalMinutes} minutes)`)
    
    // Run immediately, then set interval
    this.runMonitoringCycle()
    
    this.monitoringInterval = setInterval(async () => {
      await this.runMonitoringCycle()
    }, intervalMs)
  }

  /**
   * Stop the IMAP monitoring service
   */
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      console.log('🛑 IMAP Monitor stopped')
    }
  }

  /**
   * Run a single monitoring cycle
   */
  public async runMonitoringCycle(): Promise<void> {
    console.log('🔄 === IMAP MONITORING CYCLE STARTED ===')
    
    if (this.isRunning) {
      console.log('⏳ IMAP monitoring already in progress, skipping...')
      return
    }

    this.isRunning = true

    try {
      // Get all active IMAP connections that need syncing
      const connectionsToSync = await this.getConnectionsToSync()
      
      if (connectionsToSync.length === 0) {
        console.log('✅ No IMAP connections need syncing')
        return
      }

      console.log(`📧 Found ${connectionsToSync.length} IMAP connections to sync`)

      // Process each connection
      for (const connection of connectionsToSync) {
        try {
          await this.syncConnection(connection)
        } catch (error) {
          console.error(`❌ Error syncing connection ${connection.email_account_id}:`, error)
        }
      }

      // Process unclassified emails across all users
      await this.processUnclassifiedEmails()

      // Periodic full reconciliation (every 6 hours)
      await this.performPeriodicReconciliation()

      console.log('🎉 === IMAP MONITORING CYCLE COMPLETED ===')

    } catch (error) {
      console.error('❌ Error in IMAP monitoring cycle:', error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Get IMAP connections that need syncing
   */
  private async getConnectionsToSync(): Promise<any[]> {
    const now = new Date()
    
    const { data, error } = await this.supabase
      .from('imap_connections')
      .select(`
        *,
        email_accounts (
          id,
          user_id,
          email,
          provider,
          imap_host,
          imap_port,
          imap_username,
          imap_password,
          imap_secure,
          smtp_password
        )
      `)
      .or(`next_sync_at.is.null,next_sync_at.lte.${now.toISOString()}`)
      .eq('status', 'active')
      .not('email_accounts.imap_host', 'is', null)

    if (error) {
      console.error('❌ Error fetching connections to sync:', error)
      return []
    }

    return data || []
  }

  /**
   * Sync a single IMAP connection
   */
  private async syncConnection(connection: any): Promise<void> {
    const account = connection.email_accounts
    console.log(`📧 Syncing IMAP for ${account.email}`)

    try {
      // Update connection status
      await this.updateConnectionStatus(connection.email_account_id, 'connecting')

      // Prepare IMAP configuration - use same credentials as SMTP
      console.log('🔍 Debug account data:', {
        email: account.email,
        has_imap_password: !!account.imap_password,
        has_smtp_password: !!account.smtp_password,
        imap_password_length: account.imap_password?.length || 0,
        smtp_password_length: account.smtp_password?.length || 0
      })
      
      let password = null
      let passwordSource = 'none'
      
      if (account.imap_password) {
        try {
          password = this.decryptPassword(account.imap_password)
          passwordSource = 'imap_password (decrypted)'
        } catch (error) {
          console.log('⚠️ IMAP password decryption failed, using raw:', error.message)
          password = account.imap_password
          passwordSource = 'imap_password (raw)'
        }
      } else if (account.smtp_password) {
        try {
          password = this.decryptPassword(account.smtp_password)
          passwordSource = 'smtp_password (decrypted)'
        } catch (error) {
          console.log('⚠️ SMTP password decryption failed, using raw:', error.message)
          password = account.smtp_password
          passwordSource = 'smtp_password (raw)'
        }
      }
      
      console.log(`🔐 Password source: ${passwordSource} (length: ${password?.length || 0})`)
      
      const imapConfig = {
        host: account.imap_host,
        port: account.imap_port || 993,
        tls: account.imap_secure !== false,
        user: account.imap_username || account.email,
        password: password
      }
      
      console.log(`📧 IMAP Config: ${account.email}@${imapConfig.host}:${imapConfig.port} (TLS: ${imapConfig.tls})`)

      // Perform sync
      const syncResult = await imapProcessor.syncEmails(
        account.user_id,
        account.id,
        imapConfig,
        connection.last_processed_uid || 0
      )

      // Reconciliation is now handled within syncEmails
      // No separate reconcilation call needed here

      // Update connection status based on result
      if (syncResult.errors.length === 0) {
        await this.updateConnectionSuccess(connection, syncResult)
        console.log(`✅ Synced ${syncResult.newEmails} new emails for ${account.email}`)
      } else {
        await this.updateConnectionError(connection, syncResult.errors)
        console.log(`❌ Sync failed for ${account.email}: ${syncResult.errors.join('; ')}`)
      }

    } catch (error) {
      console.error(`❌ Error syncing ${account.email}:`, error)
      await this.updateConnectionError(connection, [error.message])
    }
  }

  /**
   * Update connection status to success
   */
  private async updateConnectionSuccess(connection: any, syncResult: any): Promise<void> {
    const nextSyncTime = new Date(Date.now() + connection.sync_interval_minutes * 60 * 1000)
    
    await this.supabase
      .from('imap_connections')
      .update({
        status: 'active',
        last_sync_at: new Date().toISOString(),
        next_sync_at: nextSyncTime.toISOString(),
        last_processed_uid: syncResult.lastProcessedUID,
        total_emails_processed: connection.total_emails_processed + syncResult.newEmails,
        consecutive_failures: 0,
        last_successful_connection: new Date().toISOString(),
        last_error: null
      })
      .eq('id', connection.id)
  }

  /**
   * Update connection status to error
   */
  private async updateConnectionError(connection: any, errors: string[]): Promise<void> {
    const nextRetryTime = new Date(Date.now() + this.calculateRetryDelay(connection.consecutive_failures + 1))
    
    await this.supabase
      .from('imap_connections')
      .update({
        status: 'error',
        last_sync_at: new Date().toISOString(),
        next_sync_at: nextRetryTime.toISOString(),
        consecutive_failures: connection.consecutive_failures + 1,
        last_error: errors.join('; ')
      })
      .eq('id', connection.id)
  }

  /**
   * Update connection status
   */
  private async updateConnectionStatus(emailAccountId: string, status: string): Promise<void> {
    await this.supabase
      .from('imap_connections')
      .update({
        status,
        last_sync_at: new Date().toISOString()
      })
      .eq('email_account_id', emailAccountId)
  }

  /**
   * Process unclassified emails across all users
   */
  private async processUnclassifiedEmails(): Promise<void> {
    console.log('🔄 Processing unclassified emails...')

    try {
      // Get users with unclassified emails (limit to prevent overload)
      const { data: usersWithUnclassifiedEmails } = await this.supabase
        .from('incoming_emails')
        .select('user_id')
        .eq('classification_status', 'unclassified')
        .eq('processing_status', 'pending')
        .limit(1000) // Process max 1000 at a time

      if (!usersWithUnclassifiedEmails || usersWithUnclassifiedEmails.length === 0) {
        console.log('✅ No unclassified emails to process')
        return
      }

      // Get unique user IDs
      const userIds = [...new Set(usersWithUnclassifiedEmails.map(e => e.user_id))]
      console.log(`🔄 Processing unclassified emails for ${userIds.length} users`)

      // Process emails for each user
      let totalProcessed = 0
      let totalSuccessful = 0
      
      for (const userId of userIds) {
        try {
          const result = await replyProcessor.processUnclassifiedEmails(userId, 50) // Process 50 per user max
          totalProcessed += result.processed
          totalSuccessful += result.successful
          
          if (result.errors.length > 0) {
            console.error(`❌ Processing errors for user ${userId}:`, result.errors)
          }
        } catch (error) {
          console.error(`❌ Error processing emails for user ${userId}:`, error)
        }
      }

      console.log(`✅ Processed ${totalSuccessful}/${totalProcessed} unclassified emails`)

    } catch (error) {
      console.error('❌ Error processing unclassified emails:', error)
    }
  }

  /**
   * Calculate retry delay based on consecutive failures (exponential backoff)
   */
  private calculateRetryDelay(consecutiveFailures: number): number {
    // Base delay of 5 minutes, doubling each failure, max 4 hours
    const baseDelay = 5 * 60 * 1000 // 5 minutes in ms
    const maxDelay = 4 * 60 * 60 * 1000 // 4 hours in ms
    
    const delay = Math.min(baseDelay * Math.pow(2, consecutiveFailures - 1), maxDelay)
    return delay
  }

  /**
   * Perform periodic full reconciliation for accounts that need it
   */
  private async performPeriodicReconciliation(): Promise<void> {
    console.log('🔄 Checking for accounts needing full reconciliation...')
    
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
      
      const { data: accountsNeedingReconciliation } = await this.supabase
        .from('imap_connections')
        .select(`
          *,
          email_accounts (
            id,
            user_id,
            email,
            provider,
            imap_host,
            imap_port,
            imap_username,
            imap_password,
            imap_secure,
            smtp_password
          )
        `)
        .eq('status', 'active')
        .or(`last_full_reconciliation_at.is.null,last_full_reconciliation_at.lt.${sixHoursAgo.toISOString()}`)
        .limit(5) // Limit to prevent overload
      
      if (!accountsNeedingReconciliation || accountsNeedingReconciliation.length === 0) {
        console.log('✅ No accounts need full reconciliation')
        return
      }
      
      console.log(`🔄 Found ${accountsNeedingReconciliation.length} accounts needing full reconciliation`)
      
      for (const connection of accountsNeedingReconciliation) {
        const account = connection.email_accounts
        
        try {
          console.log(`🔄 Full reconciliation for ${account.email}`)
          
          // Prepare IMAP config
          let password = null
          if (account.imap_password) {
            password = this.decryptPassword(account.imap_password)
          } else if (account.smtp_password) {
            password = this.decryptPassword(account.smtp_password)
          }
          
          const imapConfig = {
            host: account.imap_host,
            port: account.imap_port || 993,
            tls: account.imap_secure !== false,
            user: account.imap_username || account.email,
            password: password
          }
          
          // Perform full reconciliation
          const result = await imapProcessor.performFullReconciliation(
            account.user_id,
            account.id,
            imapConfig
          )
          
          if (result.success) {
            console.log(`✅ Full reconciliation for ${account.email}: ${result.archivedEmails} emails archived`)
          } else {
            console.warn(`⚠️ Full reconciliation warnings for ${account.email}:`, result.errors)
          }
          
        } catch (error) {
          console.error(`❌ Full reconciliation failed for ${account.email}:`, error)
        }
      }
      
    } catch (error) {
      console.error('❌ Error in periodic reconciliation:', error)
    }
  }

  /**
   * Decrypt IMAP password
   */
  private decryptPassword(encryptedPassword: string): string {
    try {
      const decrypted = decryptSMTPConfig(encryptedPassword)
      return decrypted.password || decrypted
    } catch (error) {
      console.log('⚠️  Password decryption failed, using raw password:', error.message)
      return encryptedPassword // Fallback to assume it's not encrypted
    }
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(): Promise<{
    isRunning: boolean
    totalConnections: number
    activeConnections: number
    errorConnections: number
    recentSyncs: number
    recentErrors: number
    unclassifiedEmails: number
  }> {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get connection stats
    const { data: connections } = await this.supabase
      .from('imap_connections')
      .select('status, last_sync_at, consecutive_failures')

    // Get recent processing jobs
    const { data: recentJobs } = await this.supabase
      .from('email_processing_jobs')
      .select('status')
      .gte('created_at', oneDayAgo.toISOString())

    // Get unclassified emails count
    const { data: unclassifiedEmails, count: unclassifiedCount } = await this.supabase
      .from('incoming_emails')
      .select('id', { count: 'exact' })
      .eq('classification_status', 'unclassified')
      .eq('processing_status', 'pending')

    const stats = {
      isRunning: this.isRunning,
      totalConnections: connections?.length || 0,
      activeConnections: connections?.filter(c => c.status === 'active').length || 0,
      errorConnections: connections?.filter(c => c.status === 'error').length || 0,
      recentSyncs: connections?.filter(c => c.last_sync_at && new Date(c.last_sync_at) > oneDayAgo).length || 0,
      recentErrors: connections?.filter(c => c.consecutive_failures > 0).length || 0,
      unclassifiedEmails: unclassifiedCount || 0
    }

    return stats
  }

  /**
   * Force sync a specific email account
   */
  async forceSyncAccount(emailAccountId: string): Promise<any> {
    const { data: connection } = await this.supabase
      .from('imap_connections')
      .select(`
        *,
        email_accounts (*)
      `)
      .eq('email_account_id', emailAccountId)
      .single()

    if (!connection) {
      throw new Error('IMAP connection not found')
    }

    await this.syncConnection(connection)
    return { success: true, message: 'Sync completed' }
  }
}

// Export singleton instance
export const imapMonitor = IMAPMonitor.getInstance()
