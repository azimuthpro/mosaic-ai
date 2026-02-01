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
export type SourceType = "url" | "agent_report" | "web_search";
export type FetchMode = "fast" | "memory";

// New Tile types
export type TileType = "url_reader" | "web_search" | "recursive" | "analyzer";
export type TilePattern = "solid" | "stripes" | "dots" | "gradient";

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

// Agent report source config with optional URL extraction
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
      // Legacy table - use tiles instead
      agents: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          system_prompt: string;
          output_format: OutputFormat;
          language: LanguageCode;
          schedule_cron: string | null;
          is_active: boolean;
          max_chain_depth: number;
          execution_timeout_ms: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          system_prompt: string;
          output_format?: OutputFormat;
          language?: LanguageCode;
          schedule_cron?: string | null;
          is_active?: boolean;
          max_chain_depth?: number;
          execution_timeout_ms?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          system_prompt?: string;
          output_format?: OutputFormat;
          language?: LanguageCode;
          schedule_cron?: string | null;
          is_active?: boolean;
          max_chain_depth?: number;
          execution_timeout_ms?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Legacy table - use mosaic_members instead
      agent_members: {
        Row: {
          id: string;
          agent_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          user_id: string;
          role?: MemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
      };
      // Legacy table - use tile_sources instead
      sources: {
        Row: {
          id: string;
          agent_id: string;
          url: string | null;
          name: string | null;
          is_active: boolean;
          last_scraped_at: string | null;
          created_at: string;
          updated_at: string;
          type: SourceType;
          source_reference_id: string | null;
          config: Json;
        };
        Insert: {
          id?: string;
          agent_id: string;
          url?: string | null;
          name?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          created_at?: string;
          updated_at?: string;
          type?: SourceType;
          source_reference_id?: string | null;
          config?: Json;
        };
        Update: {
          id?: string;
          agent_id?: string;
          url?: string | null;
          name?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          created_at?: string;
          updated_at?: string;
          type?: SourceType;
          source_reference_id?: string | null;
          config?: Json;
        };
      };
      // Legacy table - use tile_jobs instead
      jobs: {
        Row: {
          id: string;
          agent_id: string;
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
          agent_id: string;
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
          agent_id?: string;
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
      // Legacy table - use tile_reports instead
      reports: {
        Row: {
          id: string;
          job_id: string;
          agent_id: string;
          content: Json;
          format: OutputFormat;
          source_urls: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          agent_id: string;
          content: Json;
          format?: OutputFormat;
          source_urls?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          agent_id?: string;
          content?: Json;
          format?: OutputFormat;
          source_urls?: string[];
          created_at?: string;
        };
      };
      // New Mosaic tables
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
          max_chain_depth: number;
          execution_timeout_ms: number;
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
          max_chain_depth?: number;
          execution_timeout_ms?: number;
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
          max_chain_depth?: number;
          execution_timeout_ms?: number;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          mosaic_id: string;
          source_tile_id: string;
          target_tile_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          mosaic_id?: string;
          source_tile_id?: string;
          target_tile_id?: string;
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
          source_reference_id: string | null;
          config: Json;
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
          source_reference_id?: string | null;
          config?: Json;
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
          source_reference_id?: string | null;
          config?: Json;
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
      tile_reports: {
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
      skills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          prompt: string;
          category: SkillCategory;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          prompt: string;
          category?: SkillCategory;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          prompt?: string;
          category?: SkillCategory;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      execution_logs: {
        Row: {
          id: string;
          execution_id: string;
          agent_id: string | null;
          job_id: string | null;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          execution_id: string;
          agent_id?: string | null;
          job_id?: string | null;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string;
          agent_id?: string | null;
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
      log_execution_event: {
        Args: {
          p_execution_id: string;
          p_agent_id: string;
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
      accept_mosaic_invitation: {
        Args: {
          p_token: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      transfer_mosaic_ownership: {
        Args: {
          p_mosaic_id: string;
          p_current_owner_id: string;
          p_new_owner_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Legacy convenience types (kept for backwards compatibility)
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type AgentMember = Database["public"]["Tables"]["agent_members"]["Row"];
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type Allowlist = Database["public"]["Tables"]["allowlist"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];

// Legacy insert types
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type SourceInsert = Database["public"]["Tables"]["sources"]["Insert"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type ReportInsert = Database["public"]["Tables"]["reports"]["Insert"];
export type SkillInsert = Database["public"]["Tables"]["skills"]["Insert"];

// Legacy update types
export type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];
export type SourceUpdate = Database["public"]["Tables"]["sources"]["Update"];
export type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
export type SkillUpdate = Database["public"]["Tables"]["skills"]["Update"];

// New Mosaic types
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

// New Tile types
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
// Note: DB table is still named tile_reports for backwards compatibility
export type TileJobResult = Database["public"]["Tables"]["tile_reports"]["Row"];
export type TileJobResultInsert =
  Database["public"]["Tables"]["tile_reports"]["Insert"];
export type TileJobResultUpdate =
  Database["public"]["Tables"]["tile_reports"]["Update"];

// Backwards compatible aliases
export type TileReport = TileJobResult;
export type TileReportInsert = TileJobResultInsert;
export type TileReportUpdate = TileJobResultUpdate;

// Execution logs
export type ExecutionLog =
  Database["public"]["Tables"]["execution_logs"]["Row"];
export type ExecutionLogInsert =
  Database["public"]["Tables"]["execution_logs"]["Insert"];
export type UserRateLimit =
  Database["public"]["Tables"]["user_rate_limits"]["Row"];

// Tile Skills
export type TileSkill = Database["public"]["Tables"]["tile_skills"]["Row"];
export type TileSkillInsert =
  Database["public"]["Tables"]["tile_skills"]["Insert"];
export type TileSkillUpdate =
  Database["public"]["Tables"]["tile_skills"]["Update"];

// Legacy extended types with relations
export type AgentWithSources = Agent & {
  sources: Source[];
};

export type AgentWithStats = Agent & {
  sources: Source[];
  total_jobs: number;
  last_job: Job | null;
};

export type JobWithReport = Job & {
  report: Report | null;
};

export type ReportWithAgent = Report & {
  agent: Agent;
  job: Job;
};

export type SourceWithReferencedAgent = Source & {
  referenced_agent?: Agent | null;
};

// New extended types with relations
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

// Backwards compatible aliases
export type TileJobWithReport = TileJobWithResult;
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
  recursive: {
    type: "recursive",
    label: "Pipeline",
    color: "#14b8a6", // Neon teal (from homepage)
    pattern: "dots",
    icon: "GitBranch",
    description: "Chain outputs from other tiles",
  },
  analyzer: {
    type: "analyzer",
    label: "Analyzer",
    color: "#f59e0b", // Neon amber (from homepage)
    pattern: "gradient",
    icon: "Brain",
    description: "Process and analyze connected data",
  },
};
