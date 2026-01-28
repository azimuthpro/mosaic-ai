export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OutputFormat = "text" | "list" | "table" | "json";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type MemberRole = "owner" | "admin" | "member";
export type LanguageCode = "en" | "pl" | "es" | "it" | "de";
export type SkillCategory =
  | "news"
  | "market"
  | "research"
  | "social"
  | "deep-search"
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
          created_at?: string;
          updated_at?: string;
        };
      };
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
      sources: {
        Row: {
          id: string;
          agent_id: string;
          url: string;
          name: string | null;
          is_active: boolean;
          last_scraped_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          url: string;
          name?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          url?: string;
          name?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          agent_id: string;
          status: JobStatus;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          metadata: Json;
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
          created_at?: string;
        };
      };
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience types
export type User = Database["public"]["Tables"]["users"]["Row"];
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type AgentMember = Database["public"]["Tables"]["agent_members"]["Row"];
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type Allowlist = Database["public"]["Tables"]["allowlist"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];

// Insert types
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type SourceInsert = Database["public"]["Tables"]["sources"]["Insert"];
export type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];
export type ReportInsert = Database["public"]["Tables"]["reports"]["Insert"];
export type SkillInsert = Database["public"]["Tables"]["skills"]["Insert"];

// Update types
export type AgentUpdate = Database["public"]["Tables"]["agents"]["Update"];
export type SourceUpdate = Database["public"]["Tables"]["sources"]["Update"];
export type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
export type SkillUpdate = Database["public"]["Tables"]["skills"]["Update"];

// Extended types with relations
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
