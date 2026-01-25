# Mosaic AI - Technical Specification

## 1. Executive Summary

Mosaic AI is an automated intelligence gathering and analysis platform. It allows users to define "Agents" that periodically scrape specific web pages using Firecrawl, process that data using AI prompts, and store the results in a database. Additionally, it generates reports based on this data and integrates with Google Drive/Sheets for easy access.

## 2. Technology Stack

### Core Application

- **Frontend/Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Hosting**: [Vercel](https://vercel.com/)

### Backend & Infrastructure

- **Authentication**: [Supabase Auth](https://supabase.com/auth)
- **Database**: [Supabase Database](https://supabase.com/database) (PostgreSQL)
- **Storage**: Supabase Storage (if needed for raw HTML/assets)
- **Scheduled Jobs**: Vercel Cron Jobs (invoking API routes)

### External Integrations

- **Data Gathering**: [Firecrawl](https://firecrawl.dev/) (Web scraping/crawling)
- **AI/LLM**: [Vercel AI SDK](https://sdk.vercel.ai/docs) with **Google Gemini 3 Flash**
- **Reporting (Primary)**: Google Drive API / Google Sheets API
- **Reporting (Future)**: Slack Integration, Webhooks

## 3. System Architecture

### 3.1. High-Level Data Flow

1.  **Configuration**: User configures an Agent (Source URLs, Prompt, Schedule) via the Admin Dashboard.
2.  **Scheduling**: Vercel Cron triggers a serverless function at the defined interval.
3.  **Gathering**: The function calls Firecrawl to scrape the target URLs.
4.  **Processing**: Scraped content is fed into an LLM along with the User's System Prompt to extract/analyze specific information.
5.  **Storage**: The structured analysis result is stored in the Supabase Database.
6.  **Reporting**: A separate (or chained) process formats the data and appends it to a Google Sheet in the user's Google Drive.

## 4. Database Schema (Supabase)

### 4.1. `users` (Managed by Supabase Auth)

- `id`: UUID (FK to auth.users)
- `email`: String
- `created_at`: Timestamp

### 4.2. `allowlist` (Access Control)

- `email`: String (Primary Key)
- `created_at`: Timestamp

### 4.2. `agents`

Represents a configuration for gathering and logical analysis.

- `id`: UUID (Primary Key)
- `user_id`: UUID (FK to users.id)
- `name`: String (e.g., "Competitor Price Tracker")
- `description`: Text
- `system_prompt`: Text (Instructions for the LLM on how to process gathered data)
- `output_format`: Enum ('text', 'list', 'table', 'json') (Default: 'text')
- `schedule_cron`: String (Cron expression, e.g., "0 9 \* \* \*" for daily at 9am)
- `is_active`: Boolean
- `created_at`: Timestamp

### 4.3. `agent_members` (Sharing & Permissions)

- `id`: UUID
- `agent_id`: UUID (FK to agents.id)
- `user_id`: UUID (FK to users.id)
- `role`: Enum ('owner', 'admin', 'member')
  - **Owner**: Can edit, delete, and manage members.
  - **Admin**: Can edit configuration.
  - **Member**: Read-only access to reports.
- `created_at`: Timestamp

### 4.4. `sources`

URLs associated with an agent to be scraped.

- `id`: UUID (Primary Key)
- `agent_id`: UUID (FK to agents.id)
- `url`: String
- `last_scraped_at`: Timestamp

### 4.4. `jobs`

Execution history of agent runs.

- `id`: UUID
- `agent_id`: UUID
- `status`: Enum ('pending', 'processing', 'completed', 'failed')
- `started_at`: Timestamp
- `completed_at`: Timestamp
- `log`: Text (Error messages or execution summary)

### 4.5. `reports`

The actual data extracted/analyzed.

- `id`: UUID
- `job_id`: UUID
- `source_id`: UUID (Optional, if report is per source)
- `raw_content`: Text (Optional, raw scrape data)
- `analysis_result`: JSONB (The structured output from the LLM)
- `created_at`: Timestamp

## 5. Functional Requirements

### 5.1. User Experience (UX) Principles

- **Abstraction**: The User Interface MUST NOT expose underlying technical providers (e.g., "Firecrawl", "Gemini", "Cron syntax").
- **Terminology**: Use user-friendly terms:
  - "Firecrawl" -> "Web Reader" or "Source".
  - "Prompt" -> "Instructions".
  - "Cron" -> "Schedule" (Daily, Weekly).
- **Simplicity**: Complex configurations should be hidden behind "Advanced Settings" or managed automatically.

### 5.2. Landing Page

- **Hero Section**: Simple value proposition ("Automate your web research").
- **Call to Action**: "Sign Up" / "Login" buttons.
- **Access Info**: Note that the platform is currently invite-only.

### 5.3. User Authentication

- Sign Up / Login / Logout via Supabase.
- Email/Password or OAuth (Google/GitHub).
- **Validation**: Sign-up is RESTRICTED. Email must exist in `allowlist` table.

### 5.3. Dashboard

- List of Agents.
- Button to "Create New Agent".
- Status overview of recent Jobs (Success/Fail).

### 5.3. Agent Management

- **Create/Edit Agent**:
  - Input Name.
  - Input Instruction/Prompt (e.g., "Extract product price and availability").
  - Select Output Format (Text, List, Table, JSON).
  - Input Instruction/Prompt (e.g., "Extract product price and availability").
  - Select Output Format (Text, List, Table, JSON).
  - Input List of URLs.
  - Select Frequency (Daily, Weekly, etc.).
  - Connect Google Drive (OAuth flow to select/create Sheet).
- **Sharing**:
  - Invite users by email to access an Agent.
  - Assign Role: Owner, Admin, Member.

- **Simple Agent Creator (Wizard)**:
  - Step-by-step guide for non-technical users to define source, prompt, and output style without dealing with complex configs.

### 5.5. Report Viewer

- **Report List**: View history of generated reports for each agent.
- **Detail View**: Render the report content based on its format (e.g., render Markdown tables, nice list formatting, or raw text).
- **Simple Agent Creator (Wizard)**:
  - Step-by-step guide for non-technical users to define source, prompt, and output style without dealing with complex configs.

### 5.5. Report Viewer

- **Report List**: View history of generated reports for each agent.
- **Detail View**: Render the report content based on its format (e.g., render Markdown tables, nice list formatting, or raw text).

### 5.4. Data Gathering & Analysis Engine (Backend)

- **Cron Endpoint**: `/api/cron/trigger` (Protected).
- **Logic**:
  1.  Check `agents` for due schedules.
  2.  For each active agent:
      - Fetch `sources`.
      - Call Firecrawl API for each URL.
      - Receive Markdown/HTML.
      - Send to LLM with `system_prompt`.
      - Store result in `reports`.
      - Append row to `google_sheet_id`.

## 6. Integrations & Automations

### 6.1. Data Gathering (System Integration)

- **Firecrawl**: Used internally by the system to scrape/crawl URLs. **Hidden from End User.**
- **Config**: API Key stored in environment variables.
- **Mode**: Scrape (Single Page) or Crawl (Deep). _MVP: Scrape specific URLs._

### 6.2. User Automations (Output)

Users can configure specific "Automations" for each Agent to handle the generated reports.

#### 6.2.1. Google Drive / Sheets (Priority 1)

- **Auth**: User grants "write" access to their Drive via OAuth.
- **Action**: Create a new Sheet named "Mosaic Report - [Agent Name]" on Agent creation.
- **Update**: Append a new row with timestamp and analyzed fields for every successful job.

#### 6.2.2. Slack (Future)

- **Integration**: Send notifications and brief summaries to a Slack channel.

#### 6.2.3. Webhooks (Future)

- **Integration**: Send JSON payload to a user-defined URL upon report completion.

## 7. Security & Privacy

- **RLS (Row Level Security)**: Enabled on all Supabase tables.
  - Users can read/write their own Agents.
  - Shared Agents are accessible based on `agent_members` role.
- **API Keys**: Firecrawl and GOOGLE AI keys stored in Vercel Environment Variables (Server-side only).
- **OAuth Tokens**: Google tokens stored securely in `user_secrets` table or Supabase Vault.

## 8. MVP Roadmap

1.  **Setup**: Next.js + Supabase + UI Shell.
2.  **Auth**: Implementing Login flow.
3.  **Agent CRUD**: Database tables and UI forms.
4.  **Backend Logic**: API Route to test Firecrawl + LLM integration manually.
5.  **Scheduling**: Connect Vercel Cron.
6.  **Google Integration**: Add "Export to Sheets" feature.
