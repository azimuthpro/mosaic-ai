-- Mosaic AI Database Schema
-- This migration creates all tables needed for the application

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ALLOWLIST TABLE
-- Email whitelist for invite-only access
-- =============================================================================
create table public.allowlist (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  created_at timestamp with time zone default now() not null,
  invited_by uuid references auth.users(id) on delete set null
);

-- RLS for allowlist
alter table public.allowlist enable row level security;

-- Only admins can view/modify allowlist (service role only)
-- No public policies - managed via admin functions

-- =============================================================================
-- USERS TABLE
-- Extends auth.users with profile data
-- =============================================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- RLS for users
alter table public.users enable row level security;

-- Users can view their own profile
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- =============================================================================
-- AGENTS TABLE
-- Intelligence gathering agent configurations
-- =============================================================================
create table public.agents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  system_prompt text not null,
  output_format text not null default 'text' check (output_format in ('text', 'list', 'table', 'json')),
  schedule_cron text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- RLS for agents
alter table public.agents enable row level security;

-- Owners can do everything with their agents
create policy "Owners can manage own agents"
  on public.agents for all
  using (auth.uid() = owner_id);

-- =============================================================================
-- AGENT_MEMBERS TABLE
-- Sharing agents with other users (for future use)
-- =============================================================================
create table public.agent_members (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamp with time zone default now() not null,
  unique(agent_id, user_id)
);

-- RLS for agent_members
alter table public.agent_members enable row level security;

-- Users can view memberships for agents they own or are members of
create policy "Users can view their memberships"
  on public.agent_members for select
  using (
    auth.uid() = user_id or
    exists (
      select 1 from public.agents
      where agents.id = agent_members.agent_id
      and agents.owner_id = auth.uid()
    )
  );

-- Only agent owners can manage members
create policy "Owners can manage agent members"
  on public.agent_members for all
  using (
    exists (
      select 1 from public.agents
      where agents.id = agent_members.agent_id
      and agents.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- SOURCES TABLE
-- URLs to be scraped for each agent
-- =============================================================================
create table public.sources (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  url text not null,
  name text,
  is_active boolean default true not null,
  last_scraped_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- RLS for sources
alter table public.sources enable row level security;

-- Users can manage sources for agents they own
create policy "Users can manage sources for own agents"
  on public.sources for all
  using (
    exists (
      select 1 from public.agents
      where agents.id = sources.agent_id
      and agents.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- JOBS TABLE
-- Execution history for agent runs
-- =============================================================================
create table public.jobs (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now() not null
);

-- RLS for jobs
alter table public.jobs enable row level security;

-- Users can view jobs for their agents
create policy "Users can view jobs for own agents"
  on public.jobs for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = jobs.agent_id
      and agents.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- REPORTS TABLE
-- Analysis results from agent runs
-- =============================================================================
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete cascade not null,
  content jsonb not null,
  format text not null default 'text' check (format in ('text', 'list', 'table', 'json')),
  source_urls text[] default array[]::text[],
  created_at timestamp with time zone default now() not null
);

-- RLS for reports
alter table public.reports enable row level security;

-- Users can view reports for their agents
create policy "Users can view reports for own agents"
  on public.reports for select
  using (
    exists (
      select 1 from public.agents
      where agents.id = reports.agent_id
      and agents.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update timestamps
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_users_updated_at
  before update on public.users
  for each row execute procedure public.update_updated_at();

create trigger update_agents_updated_at
  before update on public.agents
  for each row execute procedure public.update_updated_at();

create trigger update_sources_updated_at
  before update on public.sources
  for each row execute procedure public.update_updated_at();

-- =============================================================================
-- INDEXES
-- =============================================================================
create index idx_agents_owner_id on public.agents(owner_id);
create index idx_sources_agent_id on public.sources(agent_id);
create index idx_jobs_agent_id on public.jobs(agent_id);
create index idx_jobs_status on public.jobs(status);
create index idx_reports_agent_id on public.reports(agent_id);
create index idx_reports_job_id on public.reports(job_id);
create index idx_agent_members_agent_id on public.agent_members(agent_id);
create index idx_agent_members_user_id on public.agent_members(user_id);
