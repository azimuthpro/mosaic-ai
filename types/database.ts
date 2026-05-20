export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OutputFormat = "text" | "json";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type MemberRole = "owner" | "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";
export type LanguageCode = "en" | "pl" | "es" | "it" | "de";
export type SourceType = "url" | "web_search" | "slack_channel";
export type FetchMode = "fast" | "memory";

export type SlackTimeframe = "last_day" | "last_week";

export interface SlackSourceConfig {
  channel_id: string;
  channel_name: string;
  max_messages?: number;
  include_threads?: boolean;
  days_back?: number;
  timeframe?: SlackTimeframe; // Legacy — kept for backward compat
  hours_back?: number; // Legacy — kept for backward compat
  team_id?: string;
  team_name?: string;
  context?: string; // User-provided context about this channel for the AI prompt
}

export type TileType =
  | "url_reader"
  | "web_search"
  | "analyzer"
  | "slack_reader"
  | "catalog"
  | "github_issue"
  | "knowledge_base"
  | "offer_sender";
export type TilePattern = "solid" | "stripes" | "dots" | "gradient";

export interface KnowledgeBaseConfig {
  content: string;
}

export interface WebSearchConfig {
  query: string;
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_raw_content?: boolean;
}

// URL source config for Tavily Extract
export interface UrlSourceConfig {
  extract_depth?: "basic" | "advanced";
}

// Tile report source config with optional URL extraction (legacy "Agent" naming preserved for compatibility)
export interface AgentReportSourceConfig {
  extract_urls?: boolean; // Enable URL extraction from report
  extract_depth?: "basic" | "advanced"; // Depth for URL extraction
  max_urls?: number; // Max URLs to extract (default: 10)
  fetch_mode?: FetchMode; // "fast" = latest only, "memory" = with historical context
}

export type SkillCategory =
  | "news"
  | "market"
  | "research"
  | "social"
  | "deep-search"
  | "custom";

// Tile skill category (includes 'analysis' for analyzer tiles)
export type TileSkillCategory =
  | "news"
  | "market"
  | "research"
  | "social"
  | "deep-search"
  | "analysis"
  | "custom";

export interface Database {
  public: {
    Tables: {
      allowlist: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          invited_by: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          invited_by?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          invited_by?: string | null;
          is_active?: boolean;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          google_access_token: string | null;
          google_refresh_token: string | null;
          google_token_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          google_access_token?: string | null;
          google_refresh_token?: string | null;
          google_token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          google_access_token?: string | null;
          google_refresh_token?: string | null;
          google_token_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tile_job_results: {
        Row: {
          id: string;
          job_id: string;
          tile_id: string;
          content: Json;
          format: OutputFormat;
          source_urls: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          tile_id: string;
          content: Json;
          format?: OutputFormat;
          source_urls?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          tile_id?: string;
          content?: Json;
          format?: OutputFormat;
          source_urls?: string[];
          created_at?: string;
        };
      };
      mosaics: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      mosaic_members: {
        Row: {
          id: string;
          mosaic_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
      };
      mosaic_invitations: {
        Row: {
          id: string;
          mosaic_id: string;
          email: string;
          role: Exclude<MemberRole, "owner">;
          token: string;
          invited_by: string | null;
          status: InvitationStatus;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id: string;
          email: string;
          role?: Exclude<MemberRole, "owner">;
          token?: string;
          invited_by?: string | null;
          status?: InvitationStatus;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string;
          email?: string;
          role?: Exclude<MemberRole, "owner">;
          token?: string;
          invited_by?: string | null;
          status?: InvitationStatus;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tiles: {
        Row: {
          id: string;
          mosaic_id: string;
          name: string;
          description: string | null;
          tile_type: TileType;
          color: string;
          pattern: TilePattern;
          grid_x: number;
          grid_y: number;
          grid_width: number;
          grid_height: number;
          system_prompt: string | null;
          output_format: OutputFormat;
          output_schema: string | null;
          language: LanguageCode;
          schedule_cron: string | null;
          is_active: boolean;
          trigger_on_source_update: boolean;
          max_chain_depth: number;
          execution_timeout_ms: number;
          slack_output_enabled: boolean;
          slack_output_channel_id: string | null;
          slack_output_channel_name: string | null;
          slack_output_team_id: string | null;
          sheets_sync_enabled: boolean;
          sheets_spreadsheet_id: string | null;
          sheets_spreadsheet_url: string | null;
          sheets_last_synced_at: string | null;
          sheets_owner_user_id: string | null;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id: string;
          name: string;
          description?: string | null;
          tile_type: TileType;
          color?: string;
          pattern?: TilePattern;
          grid_x?: number;
          grid_y?: number;
          grid_width?: number;
          grid_height?: number;
          system_prompt?: string | null;
          output_format?: OutputFormat;
          output_schema?: string | null;
          language?: LanguageCode;
          schedule_cron?: string | null;
          is_active?: boolean;
          trigger_on_source_update?: boolean;
          max_chain_depth?: number;
          execution_timeout_ms?: number;
          slack_output_enabled?: boolean;
          slack_output_channel_id?: string | null;
          slack_output_channel_name?: string | null;
          slack_output_team_id?: string | null;
          sheets_sync_enabled?: boolean;
          sheets_spreadsheet_id?: string | null;
          sheets_spreadsheet_url?: string | null;
          sheets_last_synced_at?: string | null;
          sheets_owner_user_id?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string;
          name?: string;
          description?: string | null;
          tile_type?: TileType;
          color?: string;
          pattern?: TilePattern;
          grid_x?: number;
          grid_y?: number;
          grid_width?: number;
          grid_height?: number;
          system_prompt?: string | null;
          output_format?: OutputFormat;
          output_schema?: string | null;
          language?: LanguageCode;
          schedule_cron?: string | null;
          is_active?: boolean;
          trigger_on_source_update?: boolean;
          max_chain_depth?: number;
          execution_timeout_ms?: number;
          slack_output_enabled?: boolean;
          slack_output_channel_id?: string | null;
          slack_output_channel_name?: string | null;
          slack_output_team_id?: string | null;
          sheets_sync_enabled?: boolean;
          sheets_spreadsheet_id?: string | null;
          sheets_spreadsheet_url?: string | null;
          sheets_last_synced_at?: string | null;
          sheets_owner_user_id?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      tile_connections: {
        Row: {
          id: string;
          mosaic_id: string;
          source_tile_id: string;
          target_tile_id: string;
          config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id: string;
          source_tile_id: string;
          target_tile_id: string;
          config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string;
          source_tile_id?: string;
          target_tile_id?: string;
          config?: Json;
          created_at?: string;
        };
      };
      tile_sources: {
        Row: {
          id: string;
          tile_id: string;
          url: string | null;
          name: string | null;
          is_active: boolean;
          last_scraped_at: string | null;
          type: SourceType;
          config: Json;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          url?: string | null;
          name?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          type?: SourceType;
          config?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          url?: string | null;
          name?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          type?: SourceType;
          config?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tile_jobs: {
        Row: {
          id: string;
          tile_id: string;
          status: JobStatus;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          metadata: Json;
          execution_id: string | null;
          chain_depth: number;
          parent_job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          status?: JobStatus;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          metadata?: Json;
          execution_id?: string | null;
          chain_depth?: number;
          parent_job_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          status?: JobStatus;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          metadata?: Json;
          execution_id?: string | null;
          chain_depth?: number;
          parent_job_id?: string | null;
          created_at?: string;
        };
      };
      tile_job_execution_logs: {
        Row: {
          id: string;
          execution_id: string;
          tile_id: string;
          job_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          execution_id: string;
          tile_id: string;
          job_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string;
          tile_id?: string;
          job_id?: string | null;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
      tile_skills: {
        Row: {
          id: string;
          mosaic_id: string | null;
          tile_type: TileType;
          name: string;
          description: string | null;
          prompt: string;
          category: TileSkillCategory;
          created_by: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id?: string | null;
          tile_type: TileType;
          name: string;
          description?: string | null;
          prompt: string;
          category?: TileSkillCategory;
          created_by?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string | null;
          tile_type?: TileType;
          name?: string;
          description?: string | null;
          prompt?: string;
          category?: TileSkillCategory;
          created_by?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_rate_limits: {
        Row: {
          user_id: string;
          executions_this_hour: number;
          hour_window_start: string;
          concurrent_executions: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          executions_this_hour?: number;
          hour_window_start?: string;
          concurrent_executions?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          executions_this_hour?: number;
          hour_window_start?: string;
          concurrent_executions?: number;
          updated_at?: string;
        };
      };
      mosaic_api_keys: {
        Row: {
          id: string;
          mosaic_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          created_by: string | null;
          last_used_at: string | null;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          created_by?: string | null;
          last_used_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string;
          name?: string;
          key_hash?: string;
          key_prefix?: string;
          created_by?: string | null;
          last_used_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
      user_integrations: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          provider_team_id: string;
          access_token: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          provider_team_id?: string;
          access_token: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          provider_team_id?: string;
          access_token?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      tile_embeddings: {
        Row: {
          id: string;
          tile_id: string;
          mosaic_id: string;
          semantic_description: string;
          keywords: string[];
          example_queries: string[];
          embedded_text: string;
          embedding: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          mosaic_id: string;
          semantic_description: string;
          keywords?: string[];
          example_queries?: string[];
          embedded_text: string;
          embedding: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          mosaic_id?: string;
          semantic_description?: string;
          keywords?: string[];
          example_queries?: string[];
          embedded_text?: string;
          embedding?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      tile_webhooks: {
        Row: {
          id: string;
          tile_id: string;
          name: string;
          url: string;
          events: string[];
          auth_type: string;
          auth_config: Json;
          retry_count: number;
          timeout_ms: number;
          is_active: boolean;
          last_triggered_at: string | null;
          last_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          name: string;
          url: string;
          events?: string[];
          auth_type?: string;
          auth_config?: Json;
          retry_count?: number;
          timeout_ms?: number;
          is_active?: boolean;
          last_triggered_at?: string | null;
          last_status?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          name?: string;
          url?: string;
          events?: string[];
          auth_type?: string;
          auth_config?: Json;
          retry_count?: number;
          timeout_ms?: number;
          is_active?: boolean;
          last_triggered_at?: string | null;
          last_status?: string | null;
          created_at?: string;
        };
      };
      catalog_schemas: {
        Row: {
          id: string;
          tile_id: string;
          entity_type: string;
          fields: Json;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          entity_type: string;
          fields: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          entity_type?: string;
          fields?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      catalog_entries: {
        Row: {
          id: string;
          tile_id: string;
          data: Json;
          match_key: string;
          source_job_id: string | null;
          last_updated_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          data: Json;
          match_key: string;
          source_job_id?: string | null;
          last_updated_job_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          data?: Json;
          match_key?: string;
          source_job_id?: string | null;
          last_updated_job_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      catalog_entry_events: {
        Row: {
          id: string;
          entry_id: string;
          tile_id: string;
          job_id: string | null;
          event_type: string;
          title: string;
          description: string;
          event_date: string | null;
          source_url: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          tile_id: string;
          job_id?: string | null;
          event_type: string;
          title: string;
          description?: string;
          event_date?: string | null;
          source_url?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          entry_id?: string;
          tile_id?: string;
          job_id?: string | null;
          event_type?: string;
          title?: string;
          description?: string;
          event_date?: string | null;
          source_url?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      catalog_diffs: {
        Row: {
          id: string;
          tile_id: string;
          job_id: string | null;
          added_entries: Json;
          updated_entries: Json;
          new_events: Json;
          summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tile_id: string;
          job_id?: string | null;
          added_entries?: Json;
          updated_entries?: Json;
          new_events?: Json;
          summary?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tile_id?: string;
          job_id?: string | null;
          added_entries?: Json;
          updated_entries?: Json;
          new_events?: Json;
          summary?: string;
          created_at?: string;
        };
      };
      tile_webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          job_id: string | null;
          event_type: string;
          payload: Json;
          status: string;
          response_status: number | null;
          response_body: string | null;
          attempts: number;
          error_message: string | null;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          job_id?: string | null;
          event_type: string;
          payload: Json;
          status?: string;
          response_status?: number | null;
          response_body?: string | null;
          attempts?: number;
          error_message?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          webhook_id?: string;
          job_id?: string | null;
          event_type?: string;
          payload?: Json;
          status?: string;
          response_status?: number | null;
          response_body?: string | null;
          attempts?: number;
          error_message?: string | null;
          created_at?: string;
          delivered_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_and_increment_execution_count: {
        Args: {
          p_user_id: string;
          p_max_per_hour?: number;
          p_max_concurrent?: number;
        };
        Returns: Json;
      };
      decrement_concurrent_execution_count: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      get_rate_limit_status: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
      log_tile_job_execution_event: {
        Args: {
          p_execution_id: string;
          p_tile_id: string;
          p_job_id: string | null;
          p_event_type: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      check_tile_circular_dependency: {
        Args: {
          p_source_tile_id: string;
          p_target_tile_id: string;
        };
        Returns: boolean;
      };
      match_tiles: {
        Args: {
          query_embedding: string;
          match_mosaic_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          tile_id: string;
          mosaic_id: string;
          semantic_description: string;
          keywords: string[];
          example_queries: string[];
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Mosaic types
export type Mosaic = Database["public"]["Tables"]["mosaics"]["Row"];
export type MosaicInsert = Database["public"]["Tables"]["mosaics"]["Insert"];
export type MosaicUpdate = Database["public"]["Tables"]["mosaics"]["Update"];

// Mosaic settings structure
export interface MosaicSettings {
  timezone?: string; // IANA timezone e.g. "America/New_York"
}

export type MosaicMember =
  Database["public"]["Tables"]["mosaic_members"]["Row"];
export type MosaicMemberInsert =
  Database["public"]["Tables"]["mosaic_members"]["Insert"];
export type MosaicMemberUpdate =
  Database["public"]["Tables"]["mosaic_members"]["Update"];

export type MosaicInvitation =
  Database["public"]["Tables"]["mosaic_invitations"]["Row"];
export type MosaicInvitationInsert =
  Database["public"]["Tables"]["mosaic_invitations"]["Insert"];
export type MosaicInvitationUpdate =
  Database["public"]["Tables"]["mosaic_invitations"]["Update"];

// Tile types
export type Tile = Database["public"]["Tables"]["tiles"]["Row"];
export type TileInsert = Database["public"]["Tables"]["tiles"]["Insert"];
export type TileUpdate = Database["public"]["Tables"]["tiles"]["Update"];

export type TileConnection =
  Database["public"]["Tables"]["tile_connections"]["Row"];
export type TileConnectionInsert =
  Database["public"]["Tables"]["tile_connections"]["Insert"];
export type TileConnectionUpdate =
  Database["public"]["Tables"]["tile_connections"]["Update"];

export type TileSource = Database["public"]["Tables"]["tile_sources"]["Row"];
export type TileSourceInsert =
  Database["public"]["Tables"]["tile_sources"]["Insert"];
export type TileSourceUpdate =
  Database["public"]["Tables"]["tile_sources"]["Update"];

export type TileJob = Database["public"]["Tables"]["tile_jobs"]["Row"];
export type TileJobInsert = Database["public"]["Tables"]["tile_jobs"]["Insert"];
export type TileJobUpdate = Database["public"]["Tables"]["tile_jobs"]["Update"];

// Job results (output content from tile executions)
export type TileJobResult =
  Database["public"]["Tables"]["tile_job_results"]["Row"];
export type TileJobResultInsert =
  Database["public"]["Tables"]["tile_job_results"]["Insert"];
export type TileJobResultUpdate =
  Database["public"]["Tables"]["tile_job_results"]["Update"];

/** @deprecated Use TileJobResult instead */
export type TileReport = TileJobResult;
/** @deprecated Use TileJobResultInsert instead */
export type TileReportInsert = TileJobResultInsert;
/** @deprecated Use TileJobResultUpdate instead */
export type TileReportUpdate = TileJobResultUpdate;

// Execution logs
export type ExecutionLog =
  Database["public"]["Tables"]["tile_job_execution_logs"]["Row"];
export type ExecutionLogInsert =
  Database["public"]["Tables"]["tile_job_execution_logs"]["Insert"];
export type UserRateLimit =
  Database["public"]["Tables"]["user_rate_limits"]["Row"];

// Tile Skills
export type TileSkill = Database["public"]["Tables"]["tile_skills"]["Row"];
export type TileSkillInsert =
  Database["public"]["Tables"]["tile_skills"]["Insert"];
export type TileSkillUpdate =
  Database["public"]["Tables"]["tile_skills"]["Update"];

// Extended types with relations
export type MosaicWithTiles = Mosaic & {
  tiles: TileWithSources[];
};

export type MosaicWithStats = Mosaic & {
  tiles: TileWithSources[];
  tile_count: number;
  member_count: number;
};

export type TileWithSources = Tile & {
  sources: TileSource[];
};

export type TileWithConnections = Tile & {
  sources: TileSource[];
  incoming_connections: TileConnection[];
  outgoing_connections: TileConnection[];
};

export type TileWithStats = Tile & {
  sources: TileSource[];
  total_jobs: number;
  last_job: TileJob | null;
};

export type TileJobWithResult = TileJob & {
  result: TileJobResult | null;
};

export type TileJobResultWithTile = TileJobResult & {
  tile: Tile;
  job: TileJob;
};

/** @deprecated Use TileJobWithResult instead */
export type TileJobWithReport = TileJobWithResult;
/** @deprecated Use TileJobResultWithTile instead */
export type TileReportWithTile = TileJobResultWithTile;

export type TileSourceWithReferencedTile = TileSource & {
  referenced_tile?: Tile | null;
};

// Mosaic API Keys
export type MosaicApiKey =
  Database["public"]["Tables"]["mosaic_api_keys"]["Row"];
export type MosaicApiKeyInsert =
  Database["public"]["Tables"]["mosaic_api_keys"]["Insert"];
export type MosaicApiKeyUpdate =
  Database["public"]["Tables"]["mosaic_api_keys"]["Update"];

// Tile type configuration for UI
export interface TileTypeConfig {
  type: TileType;
  label: string;
  color: string;
  pattern: TilePattern;
  icon: string;
  description: string;
}

export const TILE_TYPE_CONFIGS: Record<TileType, TileTypeConfig> = {
  url_reader: {
    type: "url_reader",
    label: "URL Reader",
    color: "#22d3ee", // Neon cyan (from homepage)
    pattern: "solid",
    icon: "Globe",
    description: "Scrape and analyze web pages",
  },
  web_search: {
    type: "web_search",
    label: "Web Search",
    color: "#ec4899", // Neon pink (from homepage)
    pattern: "stripes",
    icon: "Search",
    description: "AI-powered web research",
  },
  analyzer: {
    type: "analyzer",
    label: "Analyzer",
    color: "#f59e0b", // Neon amber (from homepage)
    pattern: "gradient",
    icon: "Brain",
    description: "Process and analyze connected data",
  },
  slack_reader: {
    type: "slack_reader",
    label: "Slack Reader",
    color: "#7C3AED",
    pattern: "dots",
    icon: "MessageSquare",
    description: "Read and analyze Slack channel messages",
  },
  catalog: {
    type: "catalog",
    label: "Catalog",
    color: "#10b981",
    pattern: "dots",
    icon: "Database",
    description: "Build a persistent entity catalog",
  },
  github_issue: {
    type: "github_issue",
    label: "GitHub Issue",
    color: "#6366f1",
    pattern: "solid",
    icon: "CircleDot",
    description: "Create GitHub issues from analysis",
  },
  knowledge_base: {
    type: "knowledge_base",
    label: "Knowledge Base",
    color: "#8b5cf6",
    pattern: "solid",
    icon: "BookOpen",
    description: "Static text content for other tiles",
  },
  offer_sender: {
    type: "offer_sender",
    label: "Offer Sender",
    color: "#14b8a6",
    pattern: "gradient",
    icon: "Mail",
    description: "Personalize an HTML offer template and send via email",
  },
};

// Tile Webhooks
export type TileWebhook = Database["public"]["Tables"]["tile_webhooks"]["Row"];
export type TileWebhookInsert =
  Database["public"]["Tables"]["tile_webhooks"]["Insert"];
export type TileWebhookUpdate =
  Database["public"]["Tables"]["tile_webhooks"]["Update"];

export type TileWebhookDelivery =
  Database["public"]["Tables"]["tile_webhook_deliveries"]["Row"];
export type TileWebhookDeliveryInsert =
  Database["public"]["Tables"]["tile_webhook_deliveries"]["Insert"];
export type TileWebhookDeliveryUpdate =
  Database["public"]["Tables"]["tile_webhook_deliveries"]["Update"];

// Webhook event types
export type WebhookEventType = "job.started" | "job.completed" | "job.failed";
export type WebhookAuthType = "none" | "bearer" | "basic" | "header";
export type WebhookDeliveryStatus = "pending" | "success" | "failed";

// Webhook auth config types
export interface WebhookAuthConfigBearer {
  token: string;
}

export interface WebhookAuthConfigBasic {
  username: string;
  password: string;
}

export interface WebhookAuthConfigHeader {
  name: string;
  value: string;
}

export type WebhookAuthConfig =
  | Record<string, never>
  | WebhookAuthConfigBearer
  | WebhookAuthConfigBasic
  | WebhookAuthConfigHeader;

// User Integrations (OAuth tokens for Slack, etc.)
export type UserIntegration =
  Database["public"]["Tables"]["user_integrations"]["Row"];
export type UserIntegrationInsert =
  Database["public"]["Tables"]["user_integrations"]["Insert"];
export type UserIntegrationUpdate =
  Database["public"]["Tables"]["user_integrations"]["Update"];

export interface SlackIntegrationMetadata {
  team_id: string;
  team_name: string;
  bot_user_id: string;
}

export interface GitHubIntegrationMetadata {
  username: string;
  avatar_url?: string;
}

export interface GoogleIntegrationMetadata {
  email: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp; access_token (stored on access_token column) is valid until this time
}

export interface GitHubIssueConfig {
  repos: { owner: string; repo: string }[];
  default_labels?: string[];
  // Legacy single-repo format (backward compat)
  owner?: string;
  repo?: string;
}

// Offer Sender tile
export interface OfferSenderConfig {
  html_template: string;
  from_email?: string;
  from_name?: string;
  reply_to_email?: string;
  reply_to_name?: string;
}

export type OfferDraftStatus = "draft" | "sent" | "cancelled" | "failed";

export interface OfferDraftSlackContext {
  team_id: string;
  channel_id: string;
  thread_ts: string;
  draft_message_ts?: string;
}

export interface OfferDraftResult {
  status: OfferDraftStatus;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  html: string;
  text: string;
  from_email: string;
  from_name: string;
  reply_to_email?: string;
  reply_to_name?: string;
  ai_notes?: string;
  sent_at?: string;
  cancelled_at?: string;
  sendgrid_error?: string;
  slack_context?: OfferDraftSlackContext;
}

// Catalog types
export type CatalogSchema =
  Database["public"]["Tables"]["catalog_schemas"]["Row"];
export type CatalogSchemaInsert =
  Database["public"]["Tables"]["catalog_schemas"]["Insert"];
export type CatalogSchemaUpdate =
  Database["public"]["Tables"]["catalog_schemas"]["Update"];

export type CatalogEntry =
  Database["public"]["Tables"]["catalog_entries"]["Row"];
export type CatalogEntryInsert =
  Database["public"]["Tables"]["catalog_entries"]["Insert"];
export type CatalogEntryUpdate =
  Database["public"]["Tables"]["catalog_entries"]["Update"];

export type CatalogEntryEvent =
  Database["public"]["Tables"]["catalog_entry_events"]["Row"];
export type CatalogEntryEventInsert =
  Database["public"]["Tables"]["catalog_entry_events"]["Insert"];

export type CatalogDiff = Database["public"]["Tables"]["catalog_diffs"]["Row"];
export type CatalogDiffInsert =
  Database["public"]["Tables"]["catalog_diffs"]["Insert"];

export interface CatalogField {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "url";
  description: string;
  is_key?: boolean;
}

export interface CatalogDiffPayload {
  added_entries: { id: string; match_key: string; data: Json }[];
  updated_entries: { id: string; changed_fields: string[] }[];
  new_events: {
    entry_id: string;
    entry_name: string;
    event_type: string;
    title: string;
  }[];
  summary: string;
  total_entries: number;
}

// Webhook payload structure
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  tile: {
    id: string;
    name: string;
  };
  job: {
    id: string;
    started_at: string | null;
    completed_at: string | null;
  };
  result?: {
    content: Json;
    format: OutputFormat;
    source_urls: string[];
  };
  error?: string;
}

// Tile Embeddings (Router)
export type TileEmbedding =
  Database["public"]["Tables"]["tile_embeddings"]["Row"];
export type TileEmbeddingInsert =
  Database["public"]["Tables"]["tile_embeddings"]["Insert"];
export type TileEmbeddingUpdate =
  Database["public"]["Tables"]["tile_embeddings"]["Update"];
