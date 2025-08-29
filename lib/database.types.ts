export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          plan: 'starter' | 'professional' | 'agency'
          plan_limits: {
            email_accounts: number
            contacts: number
            emails_per_month: number
            campaigns: number
          }
          usage_stats: {
            emails_sent_this_month: number
            contacts_count: number
            campaigns_count: number
            email_accounts_count: number
          }
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          plan?: 'starter' | 'professional' | 'agency'
          plan_limits?: {
            email_accounts: number
            contacts: number
            emails_per_month: number
            campaigns: number
          }
          usage_stats?: {
            emails_sent_this_month: number
            contacts_count: number
            campaigns_count: number
            email_accounts_count: number
          }
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          plan?: 'starter' | 'professional' | 'agency'
          plan_limits?: {
            email_accounts: number
            contacts: number
            emails_per_month: number
            campaigns: number
          }
          usage_stats?: {
            emails_sent_this_month: number
            contacts_count: number
            campaigns_count: number
            email_accounts_count: number
          }
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      email_accounts: {
        Row: {
          id: string
          user_id: string
          provider: 'gmail' | 'outlook' | 'smtp'
          email: string
          name: string
          oauth_tokens: Json | null
          smtp_config: Json | null
          settings: {
            daily_limit: number
            delay_between_emails: number
            warm_up_enabled: boolean
            signature?: string | null
          }
          is_active: boolean
          is_verified: boolean
          verified_at: string | null
          domain_auth: {
            spf: { status: string; record: string | null; valid: boolean }
            dkim: { status: string; record: string | null; valid: boolean }
            dmarc: { status: string; record: string | null; valid: boolean }
          }
          health_score: number
          reputation_data: {
            bounce_rate: number
            complaint_rate: number
            delivery_rate: number
            blacklist_status: string[]
          }
          daily_sent_count: number
          monthly_sent_count: number
          last_sent_at: string | null
          warmup_status: 'not_started' | 'in_progress' | 'completed' | 'paused'
          warmup_progress: {
            current_day: number
            target_day: number
            daily_target: number
            emails_sent_today: number
          }
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: 'gmail' | 'outlook' | 'smtp'
          email: string
          name: string
          oauth_tokens?: Json | null
          smtp_config?: Json | null
          settings?: {
            daily_limit: number
            delay_between_emails: number
            warm_up_enabled: boolean
            signature?: string | null
          }
          is_active?: boolean
          is_verified?: boolean
          verified_at?: string | null
          domain_auth?: {
            spf: { status: string; record: string | null; valid: boolean }
            dkim: { status: string; record: string | null; valid: boolean }
            dmarc: { status: string; record: string | null; valid: boolean }
          }
          health_score?: number
          reputation_data?: {
            bounce_rate: number
            complaint_rate: number
            delivery_rate: number
            blacklist_status: string[]
          }
          daily_sent_count?: number
          monthly_sent_count?: number
          last_sent_at?: string | null
          warmup_status?: 'not_started' | 'in_progress' | 'completed' | 'paused'
          warmup_progress?: {
            current_day: number
            target_day: number
            daily_target: number
            emails_sent_today: number
          }
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'gmail' | 'outlook' | 'smtp'
          email?: string
          name?: string
          oauth_tokens?: Json | null
          smtp_config?: Json | null
          settings?: {
            daily_limit: number
            delay_between_emails: number
            warm_up_enabled: boolean
            signature?: string | null
          }
          is_active?: boolean
          is_verified?: boolean
          verified_at?: string | null
          domain_auth?: {
            spf: { status: string; record: string | null; valid: boolean }
            dkim: { status: string; record: string | null; valid: boolean }
            dmarc: { status: string; record: string | null; valid: boolean }
          }
          health_score?: number
          reputation_data?: {
            bounce_rate: number
            complaint_rate: number
            delivery_rate: number
            blacklist_status: string[]
          }
          daily_sent_count?: number
          monthly_sent_count?: number
          last_sent_at?: string | null
          warmup_status?: 'not_started' | 'in_progress' | 'completed' | 'paused'
          warmup_progress?: {
            current_day: number
            target_day: number
            daily_target: number
            emails_sent_today: number
          }
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ai_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          category: 'cold_outreach' | 'follow_up' | 'introduction' | 'meeting_request' | 'custom'
          content: string
          variables: string[]
          custom_prompt: string | null
          is_default: boolean
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          category?: 'cold_outreach' | 'follow_up' | 'introduction' | 'meeting_request' | 'custom'
          content: string
          variables?: string[]
          custom_prompt?: string | null
          is_default?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          category?: 'cold_outreach' | 'follow_up' | 'introduction' | 'meeting_request' | 'custom'
          content?: string
          variables?: string[]
          custom_prompt?: string | null
          is_default?: boolean
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      ai_personalizations: {
        Row: {
          id: string
          user_id: string
          contact_id: string
          template_id: string | null
          original_content: string
          personalized_content: string
          ai_provider: string
          tokens_used: number
          confidence_score: number
          processing_time: number
          variables_used: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id: string
          template_id?: string | null
          original_content: string
          personalized_content: string
          ai_provider: string
          tokens_used?: number
          confidence_score?: number
          processing_time?: number
          variables_used?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contact_id?: string
          template_id?: string | null
          original_content?: string
          personalized_content?: string
          ai_provider?: string
          tokens_used?: number
          confidence_score?: number
          processing_time?: number
          variables_used?: Json
          created_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          email: string
          first_name: string
          last_name: string
          company_name: string | null
          job_title: string | null
          website: string | null
          industry: string | null
          phone: string | null
          linkedin_url: string | null
          custom_fields: Json
          tags: string[]
          status: 'active' | 'unsubscribed' | 'bounced' | 'deleted'
          email_status: 'valid' | 'invalid' | 'risky' | 'unknown'
          last_contacted: string | null
          last_opened: string | null
          last_clicked: string | null
          last_replied: string | null
          emails_sent: number
          emails_opened: number
          emails_clicked: number
          emails_replied: number
          emails_bounced: number
          enrichment_data: Json | null
          enrichment_status: 'pending' | 'completed' | 'failed' | null
          enrichment_updated_at: string | null
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          first_name: string
          last_name: string
          company_name?: string | null
          job_title?: string | null
          website?: string | null
          industry?: string | null
          phone?: string | null
          linkedin_url?: string | null
          custom_fields?: Json
          tags?: string[]
          status?: 'active' | 'unsubscribed' | 'bounced' | 'deleted'
          email_status?: 'valid' | 'invalid' | 'risky' | 'unknown'
          last_contacted?: string | null
          last_opened?: string | null
          last_clicked?: string | null
          last_replied?: string | null
          emails_sent?: number
          emails_opened?: number
          emails_clicked?: number
          emails_replied?: number
          emails_bounced?: number
          enrichment_data?: Json | null
          enrichment_status?: 'pending' | 'completed' | 'failed' | null
          enrichment_updated_at?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          first_name?: string
          last_name?: string
          company_name?: string | null
          job_title?: string | null
          website?: string | null
          industry?: string | null
          phone?: string | null
          linkedin_url?: string | null
          custom_fields?: Json
          tags?: string[]
          status?: 'active' | 'unsubscribed' | 'bounced' | 'deleted'
          email_status?: 'valid' | 'invalid' | 'risky' | 'unknown'
          last_contacted?: string | null
          last_opened?: string | null
          last_clicked?: string | null
          last_replied?: string | null
          emails_sent?: number
          emails_opened?: number
          emails_clicked?: number
          emails_replied?: number
          emails_bounced?: number
          enrichment_data?: Json | null
          enrichment_status?: 'pending' | 'completed' | 'failed' | null
          enrichment_updated_at?: string | null
          source?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          user_id: string
          name: string
          status: string
          sequence_data: Json
          ai_settings: Json
          schedule_settings: Json
          targeting_settings: Json
          ab_test_config: Json | null
          total_contacts: number
          emails_sent: number
          created_at: string
          updated_at: string
          started_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          status?: string
          sequence_data?: Json
          ai_settings?: Json
          schedule_settings?: Json
          targeting_settings?: Json
          ab_test_config?: Json | null
          total_contacts?: number
          emails_sent?: number
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          status?: string
          sequence_data?: Json
          ai_settings?: Json
          schedule_settings?: Json
          targeting_settings?: Json
          ab_test_config?: Json | null
          total_contacts?: number
          emails_sent?: number
          created_at?: string
          updated_at?: string
          started_at?: string | null
          completed_at?: string | null
        }
      }
      email_sends: {
        Row: {
          id: string
          user_id: string
          campaign_id: string | null
          contact_id: string
          email_account_id: string
          step_number: number
          subject: string
          content: string
          message_id: string | null
          send_status: string
          opened_at: string | null
          clicked_at: string | null
          replied_at: string | null
          bounced_at: string | null
          unsubscribed_at: string | null
          tracking_data: Json
          error_message: string | null
          retry_count: number
          ab_variant: string | null
          scheduled_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          campaign_id?: string | null
          contact_id: string
          email_account_id: string
          step_number?: number
          subject: string
          content: string
          message_id?: string | null
          send_status?: string
          opened_at?: string | null
          clicked_at?: string | null
          replied_at?: string | null
          bounced_at?: string | null
          unsubscribed_at?: string | null
          tracking_data?: Json
          error_message?: string | null
          retry_count?: number
          ab_variant?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          campaign_id?: string | null
          contact_id?: string
          email_account_id?: string
          step_number?: number
          subject?: string
          content?: string
          message_id?: string | null
          send_status?: string
          opened_at?: string | null
          clicked_at?: string | null
          replied_at?: string | null
          bounced_at?: string | null
          unsubscribed_at?: string | null
          tracking_data?: Json
          error_message?: string | null
          retry_count?: number
          ab_variant?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      warmup_progress: {
        Row: {
          id: string
          email_account_id: string
          date: string
          emails_sent: number
          delivered: number
          opened: number
          replied: number
          bounced: number
          complained: number
          reputation_score: number
          deliverability_rate: number
          created_at: string
        }
        Insert: {
          id?: string
          email_account_id: string
          date: string
          emails_sent?: number
          delivered?: number
          opened?: number
          replied?: number
          bounced?: number
          complained?: number
          reputation_score?: number
          deliverability_rate?: number
          created_at?: string
        }
        Update: {
          id?: string
          email_account_id?: string
          date?: string
          emails_sent?: number
          delivered?: number
          opened?: number
          replied?: number
          bounced?: number
          complained?: number
          reputation_score?: number
          deliverability_rate?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}