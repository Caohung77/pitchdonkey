export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      agent_contact_scores: {
        Row: {
          agent_id: string
          contact_id: string
          contact_id: string | null
          created_at: string | null
          id: string
          reasons: Json | null
          run_id: string
          score: number
          user_id: string
        }
        Insert: {
          agent_id: string
          contact_id: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          reasons?: Json | null
          run_id: string
          score: number
          user_id: string
        }
        Update: {
          agent_id?: string
          contact_id?: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          reasons?: Json | null
          run_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_contact_scores_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "outreach_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_contact_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "agent_contact_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_contact_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_segment_members: {
        Row: {
          added_at: string | null
          agent_id: string
          contact_id: string
          id: string
          metadata: Json | null
          reasons: Json | null
          removed_at: string | null
          run_id: string | null
          score: number | null
          status: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          agent_id: string
          contact_id: string
          id?: string
          metadata?: Json | null
          reasons?: Json | null
          removed_at?: string | null
          run_id?: string | null
          score?: number | null
          status?: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          agent_id?: string
          contact_id?: string
          id?: string
          metadata?: Json | null
          reasons?: Json | null
          removed_at?: string | null
          run_id?: string | null
          score?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_segment_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "outreach_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_segment_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "agent_segment_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_segment_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_templates: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          body_template: string
          category: string | null
          created_at: string | null
          custom_prompt: string | null
          description: string | null
          email_purpose: string | null
          generation_options: Json | null
          id: string
          is_default: boolean | null
          is_public: boolean | null
          language: string | null
          max_tokens: number | null
          name: string
          sender_name: string | null
          subject_template: string
          success_rate: number | null
          temperature: number | null
          template_type: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          body_template: string
          category?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          description?: string | null
          email_purpose?: string | null
          generation_options?: Json | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          language?: string | null
          max_tokens?: number | null
          name: string
          sender_name?: string | null
          subject_template: string
          success_rate?: number | null
          temperature?: number | null
          template_type?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          body_template?: string
          category?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          description?: string | null
          email_purpose?: string | null
          generation_options?: Json | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          language?: string | null
          max_tokens?: number | null
          name?: string
          sender_name?: string | null
          subject_template?: string
          success_rate?: number | null
          temperature?: number | null
          template_type?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_enrichment_jobs: {
        Row: {
          completed_at: string | null
          contact_ids: string[]
          created_at: string
          id: string
          options: Json
          progress: Json
          results: Json
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_ids: string[]
          created_at?: string
          id?: string
          options?: Json
          progress?: Json
          results?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contact_ids?: string[]
          created_at?: string
          id?: string
          options?: Json
          progress?: Json
          results?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_contacts: {
        Row: {
          ai_personalization_used: boolean | null
          campaign_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          current_sequence: number | null
          id: string
          next_send_at: string | null
          personalized_body: string | null
          personalized_subject: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_personalization_used?: boolean | null
          campaign_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_sequence?: number | null
          id?: string
          next_send_at?: string | null
          personalized_body?: string | null
          personalized_subject?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_personalization_used?: boolean | null
          campaign_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_sequence?: number | null
          id?: string
          next_send_at?: string | null
          personalized_body?: string | null
          personalized_subject?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sequences: {
        Row: {
          ab_test_percentage: number | null
          campaign_id: string | null
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          email_body: string
          email_type: string | null
          id: string
          is_ab_test: boolean | null
          name: string
          send_conditions: Json | null
          sequence_order: number
          subject_line: string
          updated_at: string | null
        }
        Insert: {
          ab_test_percentage?: number | null
          campaign_id?: string | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          email_body: string
          email_type?: string | null
          id?: string
          is_ab_test?: boolean | null
          name: string
          send_conditions?: Json | null
          sequence_order: number
          subject_line: string
          updated_at?: string | null
        }
        Update: {
          ab_test_percentage?: number | null
          campaign_id?: string | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          email_body?: string
          email_type?: string | null
          id?: string
          is_ab_test?: boolean | null
          name?: string
          send_conditions?: Json | null
          sequence_order?: number
          subject_line?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ab_test_config: Json | null
          ab_test_enabled: boolean | null
          batch_history: Json | null
          contact_list_ids: string[] | null
          contacts_failed: Json | null
          contacts_processed: Json | null
          contacts_remaining: Json | null
          created_at: string | null
          current_batch_number: number | null
          daily_send_limit: number | null
          description: string | null
          email_account_id: string | null
          email_subject: string | null
          emails_bounced: number | null
          emails_clicked: number | null
          emails_complained: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_replied: number | null
          emails_sent: number | null
          end_date: string | null
          first_batch_sent_at: string | null
          from_email_account_id: string | null
          html_content: string | null
          id: string
          name: string
          next_batch_send_time: string | null
          reply_to_email: string | null
          sequence_id: string | null
          sequence_position: number | null
          scheduled_date: string | null
          send_days: number[] | null
          send_immediately: boolean | null
          send_settings: Json | null
          send_time_end: string | null
          send_time_start: string | null
          start_date: string | null
          status: string | null
          stopped_at: string | null
          timezone: string | null
          total_contacts: number | null
          track_clicks: boolean | null
          track_opens: boolean | null
          track_replies: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ab_test_config?: Json | null
          ab_test_enabled?: boolean | null
          batch_history?: Json | null
          contact_list_ids?: string[] | null
          contacts_failed?: Json | null
          contacts_processed?: Json | null
          contacts_remaining?: Json | null
          created_at?: string | null
          current_batch_number?: number | null
          daily_send_limit?: number | null
          description?: string | null
          email_account_id?: string | null
          email_subject?: string | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_complained?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          end_date?: string | null
          first_batch_sent_at?: string | null
          from_email_account_id?: string | null
          html_content?: string | null
          id?: string
          name: string
          next_batch_send_time?: string | null
          reply_to_email?: string | null
          sequence_id?: string | null
          sequence_position?: number | null
          scheduled_date?: string | null
          send_days?: number[] | null
          send_immediately?: boolean | null
          send_settings?: Json | null
          send_time_end?: string | null
          send_time_start?: string | null
          start_date?: string | null
          status?: string | null
          stopped_at?: string | null
          timezone?: string | null
          total_contacts?: number | null
          track_clicks?: boolean | null
          track_opens?: boolean | null
          track_replies?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ab_test_config?: Json | null
          ab_test_enabled?: boolean | null
          batch_history?: Json | null
          contact_list_ids?: string[] | null
          contacts_failed?: Json | null
          contacts_processed?: Json | null
          contacts_remaining?: Json | null
          created_at?: string | null
          current_batch_number?: number | null
          daily_send_limit?: number | null
          description?: string | null
          email_account_id?: string | null
          email_subject?: string | null
          emails_bounced?: number | null
          emails_clicked?: number | null
          emails_complained?: number | null
          emails_delivered?: number | null
          emails_opened?: number | null
          emails_replied?: number | null
          emails_sent?: number | null
          end_date?: string | null
          first_batch_sent_at?: string | null
          from_email_account_id?: string | null
          html_content?: string | null
          id?: string
          name?: string
          next_batch_send_time?: string | null
          reply_to_email?: string | null
          sequence_id?: string | null
          sequence_position?: number | null
          scheduled_date?: string | null
          send_days?: number[] | null
          send_immediately?: boolean | null
          send_settings?: Json | null
          send_time_end?: string | null
          send_time_start?: string | null
          start_date?: string | null
          status?: string | null
          stopped_at?: string | null
          timezone?: string | null
          total_contacts?: number | null
          track_clicks?: boolean | null
          track_opens?: boolean | null
          track_replies?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_from_email_account_id_fkey"
            columns: ["from_email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      click_tracking: {
        Row: {
          campaign_id: string | null
          click_count: number | null
          clicked: boolean | null
          clicked_at: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          last_clicked_at: string | null
          location: Json | null
          message_id: string
          original_url: string
          recipient_email: string
          tracking_url: string
          user_agent: string | null
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number | null
          clicked?: boolean | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          id: string
          ip_address?: string | null
          last_clicked_at?: string | null
          location?: Json | null
          message_id: string
          original_url: string
          recipient_email: string
          tracking_url: string
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string | null
          click_count?: number | null
          clicked?: boolean | null
          clicked_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          last_clicked_at?: string | null
          location?: Json | null
          message_id?: string
          original_url?: string
          recipient_email?: string
          tracking_url?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_click_tracking_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_click_tracking_contact"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "fk_click_tracking_contact"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          contact_ids: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_favorite: boolean | null
          name: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contact_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          name: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contact_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_favorite?: boolean | null
          name?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_segments: {
        Row: {
          conditions: Json
          contact_count: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          conditions: Json
          contact_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          conditions?: Json
          contact_count?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_segments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          ai_personalization_score: number | null
          ai_research_data: Json | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string
          engagement_bounce_count: number
          engagement_click_count: number
          engagement_last_positive_at: string | null
          engagement_open_count: number
          engagement_reply_count: number
          engagement_score: number
          engagement_sent_count: number
          engagement_status: string
          engagement_updated_at: string | null
          auto_reply_until: string | null
          enrichment_data: Json | null
          enrichment_priority: string | null
          enrichment_sources: string[] | null
          enrichment_status: string | null
          enrichment_updated_at: string | null
          first_name: string | null
          id: string
          last_clicked_at: string | null
          last_contacted_at: string | null
          last_name: string | null
          last_opened_at: string | null
          last_replied_at: string | null
          linkedin_about: string | null
          linkedin_activity: Json | null
          linkedin_avatar_url: string | null
          linkedin_banner_url: string | null
          linkedin_certifications: Json | null
          linkedin_city: string | null
          linkedin_connection_count: number | null
          linkedin_contact_info: Json | null
          linkedin_country: string | null
          linkedin_country_code: string | null
          linkedin_courses: Json | null
          linkedin_current_company: string | null
          linkedin_current_position: string | null
          linkedin_education: Json | null
          linkedin_experience: Json | null
          linkedin_extracted_at: string | null
          linkedin_extraction_status: string | null
          linkedin_first_name: string | null
          linkedin_follower_count: number | null
          linkedin_headline: string | null
          linkedin_honors_awards: Json | null
          linkedin_industry: string | null
          linkedin_languages: Json | null
          linkedin_last_name: string | null
          linkedin_location: string | null
          linkedin_organizations: Json | null
          linkedin_patents: Json | null
          linkedin_people_also_viewed: Json | null
          linkedin_posts: Json | null
          linkedin_profile_completeness: number | null
          linkedin_profile_data: Json | null
          linkedin_projects: Json | null
          linkedin_publications: Json | null
          linkedin_recommendations: Json | null
          linkedin_recommendations_count: number | null
          linkedin_services: Json | null
          linkedin_skills: Json | null
          linkedin_summary: string | null
          linkedin_url: string | null
          linkedin_volunteer_experience: Json | null
          lists: string[] | null
          notes: string | null
          notes_updated_at: string | null
          phone: string | null
          position: string | null
          postcode: string | null
          segments: string[] | null
          sex: string | null
          source: string | null
          tags: string[] | null
          timezone: string | null
          twitter_url: string | null
          unsubscribed_at: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_personalization_score?: number | null
          ai_research_data?: Json | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email: string
          engagement_bounce_count?: number
          engagement_click_count?: number
          engagement_last_positive_at?: string | null
          engagement_open_count?: number
          engagement_reply_count?: number
          engagement_score?: number
          engagement_sent_count?: number
          engagement_status?: string
          engagement_updated_at?: string | null
          auto_reply_until?: string | null
          enrichment_data?: Json | null
          enrichment_priority?: string | null
          enrichment_sources?: string[] | null
          enrichment_status?: string | null
          enrichment_updated_at?: string | null
          first_name?: string | null
          id?: string
          last_clicked_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_opened_at?: string | null
          last_replied_at?: string | null
          linkedin_about?: string | null
          linkedin_activity?: Json | null
          linkedin_avatar_url?: string | null
          linkedin_banner_url?: string | null
          linkedin_certifications?: Json | null
          linkedin_city?: string | null
          linkedin_connection_count?: number | null
          linkedin_contact_info?: Json | null
          linkedin_country?: string | null
          linkedin_country_code?: string | null
          linkedin_courses?: Json | null
          linkedin_current_company?: string | null
          linkedin_current_position?: string | null
          linkedin_education?: Json | null
          linkedin_experience?: Json | null
          linkedin_extracted_at?: string | null
          linkedin_extraction_status?: string | null
          linkedin_first_name?: string | null
          linkedin_follower_count?: number | null
          linkedin_headline?: string | null
          linkedin_honors_awards?: Json | null
          linkedin_industry?: string | null
          linkedin_languages?: Json | null
          linkedin_last_name?: string | null
          linkedin_location?: string | null
          linkedin_organizations?: Json | null
          linkedin_patents?: Json | null
          linkedin_people_also_viewed?: Json | null
          linkedin_posts?: Json | null
          linkedin_profile_completeness?: number | null
          linkedin_profile_data?: Json | null
          linkedin_projects?: Json | null
          linkedin_publications?: Json | null
          linkedin_recommendations?: Json | null
          linkedin_recommendations_count?: number | null
          linkedin_services?: Json | null
          linkedin_skills?: Json | null
          linkedin_summary?: string | null
          linkedin_url?: string | null
          linkedin_volunteer_experience?: Json | null
          lists?: string[] | null
          notes?: string | null
          notes_updated_at?: string | null
          phone?: string | null
          position?: string | null
          postcode?: string | null
          segments?: string[] | null
          sex?: string | null
          source?: string | null
          tags?: string[] | null
          timezone?: string | null
          twitter_url?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_personalization_score?: number | null
          ai_research_data?: Json | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string
          engagement_bounce_count?: number
          engagement_click_count?: number
          engagement_last_positive_at?: string | null
          engagement_open_count?: number
          engagement_reply_count?: number
          engagement_score?: number
          engagement_sent_count?: number
          engagement_status?: string
          engagement_updated_at?: string | null
          auto_reply_until?: string | null
          enrichment_data?: Json | null
          enrichment_priority?: string | null
          enrichment_sources?: string[] | null
          enrichment_status?: string | null
          enrichment_updated_at?: string | null
          first_name?: string | null
          id?: string
          last_clicked_at?: string | null
          last_contacted_at?: string | null
          last_name?: string | null
          last_opened_at?: string | null
          last_replied_at?: string | null
          linkedin_about?: string | null
          linkedin_activity?: Json | null
          linkedin_avatar_url?: string | null
          linkedin_banner_url?: string | null
          linkedin_certifications?: Json | null
          linkedin_city?: string | null
          linkedin_connection_count?: number | null
          linkedin_contact_info?: Json | null
          linkedin_country?: string | null
          linkedin_country_code?: string | null
          linkedin_courses?: Json | null
          linkedin_current_company?: string | null
          linkedin_current_position?: string | null
          linkedin_education?: Json | null
          linkedin_experience?: Json | null
          linkedin_extracted_at?: string | null
          linkedin_extraction_status?: string | null
          linkedin_first_name?: string | null
          linkedin_follower_count?: number | null
          linkedin_headline?: string | null
          linkedin_honors_awards?: Json | null
          linkedin_industry?: string | null
          linkedin_languages?: Json | null
          linkedin_last_name?: string | null
          linkedin_location?: string | null
          linkedin_organizations?: Json | null
          linkedin_patents?: Json | null
          linkedin_people_also_viewed?: Json | null
          linkedin_posts?: Json | null
          linkedin_profile_completeness?: number | null
          linkedin_profile_data?: Json | null
          linkedin_projects?: Json | null
          linkedin_publications?: Json | null
          linkedin_recommendations?: Json | null
          linkedin_recommendations_count?: number | null
          linkedin_services?: Json | null
          linkedin_skills?: Json | null
          linkedin_summary?: string | null
          linkedin_url?: string | null
          linkedin_volunteer_experience?: Json | null
          lists?: string[] | null
          notes?: string | null
          notes_updated_at?: string | null
          phone?: string | null
          position?: string | null
          postcode?: string | null
          segments?: string[] | null
          sex?: string | null
          source?: string | null
          tags?: string[] | null
          timezone?: string | null
          twitter_url?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dns_provider_credentials: {
        Row: {
          created_at: string | null
          credentials: Json
          id: string
          is_active: boolean | null
          last_used: string | null
          provider: string
          provider_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials: Json
          id?: string
          is_active?: boolean | null
          last_used?: string | null
          provider: string
          provider_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials?: Json
          id?: string
          is_active?: boolean | null
          last_used?: string | null
          provider?: string
          provider_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      domain_auth: {
        Row: {
          auto_configured: boolean | null
          created_at: string | null
          dkim_error_message: string | null
          dkim_last_checked: string | null
          dkim_private_key: string | null
          dkim_public_key: string | null
          dkim_selector: string | null
          dkim_verified: boolean | null
          dmarc_error_message: string | null
          dmarc_last_checked: string | null
          dmarc_percentage: number | null
          dmarc_policy: string | null
          dmarc_record: string | null
          dmarc_report_email: string | null
          dmarc_verified: boolean | null
          dns_provider: string | null
          domain: string
          id: string
          spf_error_message: string | null
          spf_last_checked: string | null
          spf_record: string | null
          spf_verified: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_configured?: boolean | null
          created_at?: string | null
          dkim_error_message?: string | null
          dkim_last_checked?: string | null
          dkim_private_key?: string | null
          dkim_public_key?: string | null
          dkim_selector?: string | null
          dkim_verified?: boolean | null
          dmarc_error_message?: string | null
          dmarc_last_checked?: string | null
          dmarc_percentage?: number | null
          dmarc_policy?: string | null
          dmarc_record?: string | null
          dmarc_report_email?: string | null
          dmarc_verified?: boolean | null
          dns_provider?: string | null
          domain: string
          id?: string
          spf_error_message?: string | null
          spf_last_checked?: string | null
          spf_record?: string | null
          spf_verified?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_configured?: boolean | null
          created_at?: string | null
          dkim_error_message?: string | null
          dkim_last_checked?: string | null
          dkim_private_key?: string | null
          dkim_public_key?: string | null
          dkim_selector?: string | null
          dkim_verified?: boolean | null
          dmarc_error_message?: string | null
          dmarc_last_checked?: string | null
          dmarc_percentage?: number | null
          dmarc_policy?: string | null
          dmarc_record?: string | null
          dmarc_report_email?: string | null
          dmarc_verified?: boolean | null
          dns_provider?: string | null
          domain?: string
          id?: string
          spf_error_message?: string | null
          spf_last_checked?: string | null
          spf_record?: string | null
          spf_verified?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      domain_verification_history: {
        Row: {
          checked_at: string | null
          dns_response: string | null
          domain_auth_id: string
          error_message: string | null
          id: string
          response_time_ms: number | null
          status: boolean
          verification_type: string
        }
        Insert: {
          checked_at?: string | null
          dns_response?: string | null
          domain_auth_id: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          status: boolean
          verification_type: string
        }
        Update: {
          checked_at?: string | null
          dns_response?: string | null
          domain_auth_id?: string
          error_message?: string | null
          id?: string
          response_time_ms?: number | null
          status?: boolean
          verification_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_verification_history_domain_auth_id_fkey"
            columns: ["domain_auth_id"]
            isOneToOne: false
            referencedRelation: "domain_auth"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_verification_history_domain_auth_id_fkey"
            columns: ["domain_auth_id"]
            isOneToOne: false
            referencedRelation: "domain_auth_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string | null
          bounce_rate: number | null
          complaint_rate: number | null
          created_at: string | null
          current_daily_sent: number | null
          daily_send_limit: number | null
          deleted_at: string | null
          dkim_verified: boolean | null
          dmarc_verified: boolean | null
          domain: string | null
          domain_verified_at: string | null
          email: string
          id: string
          imap_enabled: boolean | null
          imap_host: string | null
          imap_password: string | null
          imap_port: number | null
          imap_secure: boolean | null
          imap_username: string | null
          provider: string
          refresh_token: string | null
          reputation_score: number | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_username: string | null
          spf_verified: boolean | null
          status: string | null
          token_expires_at: string | null
          total_emails_sent: number | null
          updated_at: string | null
          user_id: string | null
          warmup_current_daily_limit: number | null
          warmup_current_week: number | null
          warmup_enabled: boolean | null
          warmup_plan_id: string | null
          warmup_stage: string | null
        }
        Insert: {
          access_token?: string | null
          bounce_rate?: number | null
          complaint_rate?: number | null
          created_at?: string | null
          current_daily_sent?: number | null
          daily_send_limit?: number | null
          deleted_at?: string | null
          dkim_verified?: boolean | null
          dmarc_verified?: boolean | null
          domain?: string | null
          domain_verified_at?: string | null
          email: string
          id?: string
          imap_enabled?: boolean | null
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_username?: string | null
          provider: string
          refresh_token?: string | null
          reputation_score?: number | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          spf_verified?: boolean | null
          status?: string | null
          token_expires_at?: string | null
          total_emails_sent?: number | null
          updated_at?: string | null
          user_id?: string | null
          warmup_current_daily_limit?: number | null
          warmup_current_week?: number | null
          warmup_enabled?: boolean | null
          warmup_plan_id?: string | null
          warmup_stage?: string | null
        }
        Update: {
          access_token?: string | null
          bounce_rate?: number | null
          complaint_rate?: number | null
          created_at?: string | null
          current_daily_sent?: number | null
          daily_send_limit?: number | null
          deleted_at?: string | null
          dkim_verified?: boolean | null
          dmarc_verified?: boolean | null
          domain?: string | null
          domain_verified_at?: string | null
          email?: string
          id?: string
          imap_enabled?: boolean | null
          imap_host?: string | null
          imap_password?: string | null
          imap_port?: number | null
          imap_secure?: boolean | null
          imap_username?: string | null
          provider?: string
          refresh_token?: string | null
          reputation_score?: number | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_username?: string | null
          spf_verified?: boolean | null
          status?: string | null
          token_expires_at?: string | null
          total_emails_sent?: number | null
          updated_at?: string | null
          user_id?: string | null
          warmup_current_daily_limit?: number | null
          warmup_current_week?: number | null
          warmup_enabled?: boolean | null
          warmup_plan_id?: string | null
          warmup_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          event_data: Json | null
          id: string
          message_id: string
          processed: boolean | null
          provider_id: string
          recipient_email: string
          timestamp: string | null
          type: string
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          event_data?: Json | null
          id: string
          message_id: string
          processed?: boolean | null
          provider_id?: string
          recipient_email: string
          timestamp?: string | null
          type: string
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          event_data?: Json | null
          id?: string
          message_id?: string
          processed?: boolean | null
          provider_id?: string
          recipient_email?: string
          timestamp?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_email_events_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_events_contact"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "fk_email_events_contact"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email_account_id: string
          error_details: string[] | null
          failed_items: number | null
          id: string
          job_config: Json | null
          job_type: string
          max_retries: number | null
          next_retry_at: string | null
          processed_items: number | null
          result_summary: Json | null
          retry_count: number | null
          started_at: string | null
          status: string | null
          total_items: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email_account_id: string
          error_details?: string[] | null
          failed_items?: number | null
          id?: string
          job_config?: Json | null
          job_type: string
          max_retries?: number | null
          next_retry_at?: string | null
          processed_items?: number | null
          result_summary?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email_account_id?: string
          error_details?: string[] | null
          failed_items?: number | null
          id?: string
          job_config?: Json | null
          job_type?: string
          max_retries?: number | null
          next_retry_at?: string | null
          processed_items?: number | null
          result_summary?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          total_items?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_processing_jobs_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_processing_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          action_taken: string | null
          action_taken_at: string | null
          auto_reply_until: string | null
          bounce_code: string | null
          bounce_reason: string | null
          bounce_type: string | null
          campaign_id: string | null
          confidence_score: number | null
          contact_id: string | null
          created_at: string | null
          forwarded_to: string | null
          human_reviewed_at: string | null
          human_reviewer_id: string | null
          id: string
          incoming_email_id: string
          intent: string | null
          keywords: string[] | null
          original_message_id: string | null
          reply_subtype: string | null
          reply_type: string
          requires_human_review: boolean | null
          sentiment: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_taken?: string | null
          action_taken_at?: string | null
          auto_reply_until?: string | null
          bounce_code?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          campaign_id?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          created_at?: string | null
          forwarded_to?: string | null
          human_reviewed_at?: string | null
          human_reviewer_id?: string | null
          id?: string
          incoming_email_id: string
          intent?: string | null
          keywords?: string[] | null
          original_message_id?: string | null
          reply_subtype?: string | null
          reply_type: string
          requires_human_review?: boolean | null
          sentiment?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_taken?: string | null
          action_taken_at?: string | null
          auto_reply_until?: string | null
          bounce_code?: string | null
          bounce_reason?: string | null
          bounce_type?: string | null
          campaign_id?: string | null
          confidence_score?: number | null
          contact_id?: string | null
          created_at?: string | null
          forwarded_to?: string | null
          human_reviewed_at?: string | null
          human_reviewer_id?: string | null
          id?: string
          incoming_email_id?: string
          intent?: string | null
          keywords?: string[] | null
          original_message_id?: string | null
          reply_subtype?: string | null
          reply_type?: string
          requires_human_review?: boolean | null
          sentiment?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "email_replies_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_human_reviewer_id_fkey"
            columns: ["human_reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_incoming_email_id_fkey"
            columns: ["incoming_email_id"]
            isOneToOne: false
            referencedRelation: "incoming_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          ab_variant: string | null
          campaign_id: string | null
          contact_id: string
          content: string
          created_at: string | null
          email_account_id: string
          error_message: string | null
          id: string
          message_id: string | null
          retry_count: number | null
          scheduled_at: string | null
          send_status: string | null
          sent_at: string | null
          step_number: number | null
          subject: string
          tracking_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ab_variant?: string | null
          campaign_id?: string | null
          contact_id: string
          content: string
          created_at?: string | null
          email_account_id: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          send_status?: string | null
          sent_at?: string | null
          step_number?: number | null
          subject: string
          tracking_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ab_variant?: string | null
          campaign_id?: string | null
          contact_id?: string
          content?: string
          created_at?: string | null
          email_account_id?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          send_status?: string | null
          sent_at?: string | null
          step_number?: number | null
          subject?: string
          tracking_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking: {
        Row: {
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          campaign_id: string | null
          click_count: number | null
          clicked_at: string | null
          complained_at: string | null
          contact_id: string | null
          created_at: string | null
          delivered_at: string | null
          email_account_id: string | null
          email_body: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          id: string
          last_clicked_at: string | null
          last_opened_at: string | null
          message_id: string
          open_count: number | null
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          sequence_id: string | null
          status: string | null
          subject_line: string | null
          thread_id: string | null
          tracking_pixel_id: string | null
          unsubscribed_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          complained_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_account_id?: string | null
          email_body?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          message_id: string
          open_count?: number | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string | null
          subject_line?: string | null
          thread_id?: string | null
          tracking_pixel_id?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          complained_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_account_id?: string | null
          email_body?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          message_id?: string
          open_count?: number | null
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string | null
          subject_line?: string | null
          thread_id?: string | null
          tracking_pixel_id?: string | null
          unsubscribed_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "email_tracking_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "campaign_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_email_tracking_email_account_id"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      imap_connections: {
        Row: {
          consecutive_failures: number | null
          created_at: string | null
          email_account_id: string
          folders_to_monitor: string[] | null
          id: string
          last_error: string | null
          last_processed_uid: number | null
          last_successful_connection: string | null
          last_sync_at: string | null
          next_sync_at: string | null
          status: string | null
          sync_interval_minutes: number | null
          total_emails_processed: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string | null
          email_account_id: string
          folders_to_monitor?: string[] | null
          id?: string
          last_error?: string | null
          last_processed_uid?: number | null
          last_successful_connection?: string | null
          last_sync_at?: string | null
          next_sync_at?: string | null
          status?: string | null
          sync_interval_minutes?: number | null
          total_emails_processed?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string | null
          email_account_id?: string
          folders_to_monitor?: string[] | null
          id?: string
          last_error?: string | null
          last_processed_uid?: number | null
          last_successful_connection?: string | null
          last_sync_at?: string | null
          next_sync_at?: string | null
          status?: string | null
          sync_interval_minutes?: number | null
          total_emails_processed?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imap_connections_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: true
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imap_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_emails: {
        Row: {
          archived_at: string | null
          attachments: Json | null
          bcc_addresses: string[] | null
          cc_addresses: string[] | null
          classification_confidence: number | null
          classification_status: string | null
          created_at: string | null
          date_received: string
          email_account_id: string
          email_references: string | null
          email_size: number | null
          flags: string[] | null
          from_address: string
          html_content: string | null
          id: string
          imap_uid: number | null
          in_reply_to: string | null
          message_id: string
          processed_at: string | null
          processing_errors: string[] | null
          processing_status: string | null
          raw_email: string | null
          subject: string | null
          text_content: string | null
          thread_id: string | null
          to_address: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          attachments?: Json | null
          bcc_addresses?: string[] | null
          cc_addresses?: string[] | null
          classification_confidence?: number | null
          classification_status?: string | null
          created_at?: string | null
          date_received: string
          email_account_id: string
          email_references?: string | null
          email_size?: number | null
          flags?: string[] | null
          from_address: string
          html_content?: string | null
          id?: string
          imap_uid?: number | null
          in_reply_to?: string | null
          message_id: string
          processed_at?: string | null
          processing_errors?: string[] | null
          processing_status?: string | null
          raw_email?: string | null
          subject?: string | null
          text_content?: string | null
          thread_id?: string | null
          to_address: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          attachments?: Json | null
          bcc_addresses?: string[] | null
          cc_addresses?: string[] | null
          classification_confidence?: number | null
          classification_status?: string | null
          created_at?: string | null
          date_received?: string
          email_account_id?: string
          email_references?: string | null
          email_size?: number | null
          flags?: string[] | null
          from_address?: string
          html_content?: string | null
          id?: string
          imap_uid?: number | null
          in_reply_to?: string | null
          message_id?: string
          processed_at?: string | null
          processing_errors?: string[] | null
          processing_status?: string | null
          raw_email?: string | null
          subject?: string | null
          text_content?: string | null
          thread_id?: string | null
          to_address?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_emails_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_agent_knowledge: {
        Row: {
          agent_id: string
          content: string | null
          created_at: string | null
          description: string | null
          embedding_metadata: Json | null
          embedding_status: string | null
          id: string
          storage_path: string | null
          title: string
          type: string
          updated_at: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          embedding_metadata?: Json | null
          embedding_status?: string | null
          id?: string
          storage_path?: string | null
          title: string
          type: string
          updated_at?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          embedding_metadata?: Json | null
          embedding_status?: string | null
          id?: string
          storage_path?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_agent_knowledge_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "outreach_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_agent_knowledge_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_agents: {
        Row: {
          company_name: string | null
          conversation_goal: string | null
          created_at: string | null
          custom_prompt: string | null
          follow_up_strategy: string | null
          id: string
          knowledge_summary: Json | null
          language: string
          last_used_at: string | null
          name: string
          preferred_cta: string | null
          product_description: string | null
          product_one_liner: string | null
          prompt_override: string | null
          purpose: string | null
          quality_weights: Json | null
          segment_config: Json | null
          sender_name: string | null
          sender_role: string | null
          settings: Json | null
          status: string
          target_persona: string | null
          tone: string | null
          unique_selling_points: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_name?: string | null
          conversation_goal?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          follow_up_strategy?: string | null
          id?: string
          knowledge_summary?: Json | null
          language?: string
          last_used_at?: string | null
          name: string
          preferred_cta?: string | null
          product_description?: string | null
          product_one_liner?: string | null
          prompt_override?: string | null
          purpose?: string | null
          quality_weights?: Json | null
          segment_config?: Json | null
          sender_name?: string | null
          sender_role?: string | null
          settings?: Json | null
          status?: string
          target_persona?: string | null
          tone?: string | null
          unique_selling_points?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_name?: string | null
          conversation_goal?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          follow_up_strategy?: string | null
          id?: string
          knowledge_summary?: Json | null
          language?: string
          last_used_at?: string | null
          name?: string
          preferred_cta?: string | null
          product_description?: string | null
          product_one_liner?: string | null
          prompt_override?: string | null
          purpose?: string | null
          quality_weights?: Json | null
          segment_config?: Json | null
          sender_name?: string | null
          sender_role?: string | null
          settings?: Json | null
          status?: string
          target_persona?: string | null
          tone?: string | null
          unique_selling_points?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
          referencedColumns: ["id"]
        },
      ]
    }
      sequence_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string
          created_at: string | null
          current_campaign_id: string | null
          current_link_id: string | null
          error_reason: string | null
          id: string
          last_transition_at: string | null
          sequence_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          current_campaign_id?: string | null
          current_link_id?: string | null
          error_reason?: string | null
          id?: string
          last_transition_at?: string | null
          sequence_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          current_campaign_id?: string | null
          current_link_id?: string | null
          error_reason?: string | null
          id?: string
          last_transition_at?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_tags_view"
            referencedColumns: ["contact_id"]
          },
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_current_campaign_id_fkey"
            columns: ["current_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_current_link_id_fkey"
            columns: ["current_link_id"]
            isOneToOne: false
            referencedRelation: "sequence_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_links: {
        Row: {
          condition_type: string
          created_at: string | null
          delay_days: number
          delay_hours: number
          delivery_window: Json | null
          engagement_required: boolean
          id: string
          metadata: Json
          min_clicks: number
          min_opens: number
          next_campaign_id: string
          parent_campaign_id: string | null
          persona_override_id: string | null
          sequence_id: string
          updated_at: string | null
        }
        Insert: {
          condition_type?: string
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          delivery_window?: Json | null
          engagement_required?: boolean
          id?: string
          metadata?: Json
          min_clicks?: number
          min_opens?: number
          next_campaign_id: string
          parent_campaign_id?: string | null
          persona_override_id?: string | null
          sequence_id: string
          updated_at?: string | null
        }
        Update: {
          condition_type?: string
          created_at?: string | null
          delay_days?: number
          delay_hours?: number
          delivery_window?: Json | null
          engagement_required?: boolean
          id?: string
          metadata?: Json
          min_clicks?: number
          min_opens?: number
          next_campaign_id?: string
          parent_campaign_id?: string | null
          persona_override_id?: string | null
          sequence_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_links_next_campaign_id_fkey"
            columns: ["next_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_links_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_links_persona_override_id_fkey"
            columns: ["persona_override_id"]
            isOneToOne: false
            referencedRelation: "outreach_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_links_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          description: string | null
          entry_campaign_id: string | null
          id: string
          name: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entry_campaign_id?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entry_campaign_id?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequences_entry_campaign_id_fkey"
            columns: ["entry_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_limits: {
        Row: {
          features: Json | null
          max_campaigns: number
          max_contacts: number
          max_email_accounts: number
          monthly_ai_personalizations: number
          monthly_emails: number
          tier: string
        }
        Insert: {
          features?: Json | null
          max_campaigns: number
          max_contacts: number
          max_email_accounts: number
          monthly_ai_personalizations: number
          monthly_emails: number
          tier: string
        }
        Update: {
          features?: Json | null
          max_campaigns?: number
          max_contacts?: number
          max_email_accounts?: number
          monthly_ai_personalizations?: number
          monthly_emails?: number
          tier?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          cost_credits: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          quantity: number | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          quantity?: number | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          cost_credits?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          quantity?: number | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      contact_tags_view: {
        Row: {
          contact_id: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          tag_names: string[] | null
          tag_objects: Json[] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_auth_overview: {
        Row: {
          auto_configured: boolean | null
          created_at: string | null
          dkim_verified: boolean | null
          dmarc_verified: boolean | null
          dns_provider: string | null
          domain: string | null
          email_account_count: number | null
          fully_verified: boolean | null
          health_status: string | null
          id: string | null
          last_verification_check: string | null
          spf_verified: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      reset_daily_email_counters: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      sync_legacy_tags: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
