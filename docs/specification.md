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
- **AI/LLM**: [Vercel AI SDK](https://sdk.vercel.ai/docs) with **Google Gemini 2.0 Flash**
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

### 4.3. `agents`

Represents a configuration for gathering and logical analysis.

- `id`: UUID (Primary Key)
- `user_id`: UUID (FK to users.id, original creator - also tracked as 'owner' in agent_members)
- `name`: String (e.g., "Competitor Price Tracker")
- `description`: Text
- `system_prompt`: Text (Instructions for the LLM on how to process gathered data)
- `output_format`: Enum ('text', 'list', 'table', 'json') (Default: 'text')
- `schedule_cron`: String (Cron expression, e.g., "0 9 \* \* \*" for daily at 9am)
- `timezone`: String (Default: 'UTC', IANA timezone for schedule interpretation)
- `is_active`: Boolean
- `google_sheet_id`: String (Optional, ID of connected Google Sheet)
- `created_at`: Timestamp

### 4.4. `agent_members` (Sharing & Permissions)

- `id`: UUID
- `agent_id`: UUID (FK to agents.id)
- `user_id`: UUID (FK to users.id)
- `role`: Enum ('owner', 'admin', 'member')
  - **Owner**: Can edit, delete, and manage members.
  - **Admin**: Can edit configuration.
  - **Member**: Read-only access to reports.
- `created_at`: Timestamp

### 4.5. `sources`

Defined inputs for an agent to process.

- `id`: UUID (Primary Key)
- `agent_id`: UUID (FK to agents.id)
- `type`: Enum ('url', 'agent_report', 'web_search', 'file_upload', 'api_endpoint', 'db_query', 'rss_feed', 'google_drive')
- `url`: String (Optional, for 'url' and 'rss_feed' types)
- `search_query`: String (Optional, template for 'web_search' e.g. "Details about {{topic}}")
- `source_reference_id`: UUID (Optional, FK to another agent's ID for 'agent_report' type)
- `config`: JSONB (Optional, type-specific configuration like API keys, selectors, or query parameters)
- `last_scraped_at`: Timestamp

### 4.6. `jobs`

Execution history of agent runs.

- `id`: UUID
- `agent_id`: UUID (FK to agents.id)
- `status`: Enum ('pending', 'processing', 'completed', 'failed')
- `started_at`: Timestamp
- `completed_at`: Timestamp
- `log`: Text (Error messages or execution summary)

### 4.7. `reports`

The actual data extracted/analyzed.

- `id`: UUID
- `job_id`: UUID (FK to jobs.id)
- `source_id`: UUID (Optional, FK to sources.id, if report is per source)
- `raw_content`: Text (Optional, raw scrape data)
- `analysis_result`: JSONB (The structured output from the LLM)
- `created_at`: Timestamp

### 4.8. `user_secrets`

OAuth tokens and sensitive credentials.

- `id`: UUID (Primary Key)
- `user_id`: UUID (FK to users.id)
- `provider`: String (e.g., 'google', 'slack')
- `access_token`: Text (Encrypted)
- `refresh_token`: Text (Encrypted)
- `expires_at`: Timestamp
- `created_at`: Timestamp
- `updated_at`: Timestamp

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

### 5.4. Dashboard

- List of Agents.
- Button to "Create New Agent".
- Status overview of recent Jobs (Success/Fail).

### 5.5. Agent Management

- **Create/Edit Agent**:
  - Input Name.
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

### 5.6. Data Gathering & Analysis Engine (Backend)

- **Cron Endpoint**: `/api/cron/trigger` (Protected).
- **Logic**:
  1.  Check `agents` for due schedules.
  2.  For each active agent:
      - Fetch `sources`.
      - **Handle Sources by Type**:
        - `url`: Call Firecrawl API for the URL.
        - `agent_report`: Fetch the latest successful `analysis_result` from the referenced agent's reports.
      - Receive text/JSON content from all sources.
      - Send to LLM with `system_prompt`.
      - Store result in `reports`.
      - Append row to `google_sheet_id`.

### 5.7. Report Viewer

- **Report List**: View history of generated reports for each agent.
- **Detail View**: Render the report content based on its format (e.g., render Markdown tables, nice list formatting, or raw text).

## 6. Integrations & Automations

### 6.1. Data Gathering (Source Types)

The system supports diverse source types, allowing agents to ingest data from the web, other agents, or internal systems.

| Type            | Description                                                 | Current Status |
| :-------------- | :---------------------------------------------------------- | :------------- |
| `url`           | Standard web scraping/crawling via Firecrawl.               | **MVP**        |
| `agent_report`  | Uses the output (report) of another agent as input.         | **MVP**        |
| `web_search`    | Performs autonomous web searches based on dynamic keywords. | **Next**       |
| `file_upload`   | Ingests PDF, CSV, or Text files uploaded by the user.       | Future         |
| `api_endpoint`  | Fetches JSON/XML from external REST/GraphQL APIs.           | Future         |
| `db_query`      | Executes a query on a connected database.                   | Future         |
| `rss_feed`      | Monitors RSS/Atom feeds for new entries.                    | Future         |
| `google_drive`  | Monitors specific folders for new documents.                | Future         |

- **Recursive Processing**: When using `agent_report`, the system leverages the dependency graph. An agent run may trigger dependent agents or wait for their latest reports.

#### 6.1.1. Deep Search & Research Chaining

Deep Search allows agents to go beyond a single source. They can use findings from one source to trigger a broader research mission.

1.  **Discovery**: A "Feeder Agent" (e.g., RSS/News monitor) identifies a relevant entity or event (e.g., "New construction project at 5th Ave").
2.  **Extraction**: The system extracts key metadata from the feeder report (Topics, Locations, People).
3.  **Research Initiation**: A "Research Agent" uses these keywords to perform a `web_search`.
4.  **Deep Exploration**:
    - The Research Agent generates multiple search queries (e.g., "Owner of 5th Ave construction", "City planning permit #[ID]").
    - For each result, it uses Firecrawl to scrape relevant pages.

#### 6.1.2. Data Quality Optimization (The "Best Solution")

To ensure high-quality data and minimize "hallucinations" or shallow results, the system follows these principles:

- **Triangulation (Triple Verification)**: Any critical fact (e.g., an investment amount or a CEO's name) must be verified across at least 3 distinct sources before being marked as "High Confidence".
- **Chain of Reasoning**: The LLM must document its research "path"—listing which queries were run and why—inside the `raw_content` or a `meta` field.
- **Entity Linking**: The system auto-links discovered names to known entities (LinkedIn profiles, Crunchbase entries, Official Registries) to ensure persons/companies are correctly identified.
- **Recursive Crawling**: If a search result leads to an official company domain, the agent automatically switches to "Crawl Mode" to scan the entire About Us, Press, and Team sections for exhaustive data.

### 6.2. User Automations (Output)

Users can configure specific "Automations" for each Agent to handle the generated reports.

#### 6.2.1. Google Drive / Sheets (MVP)

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

### 7.1. Error Handling

- **Firecrawl Failures**: Retry up to 3 times with exponential backoff. Mark job as 'failed' after all retries exhausted.
- **LLM Response Validation**: Validate output matches expected `output_format`. Re-prompt once if malformed.
- **Timeout Policy**: Source scraping timeout: 30s. LLM processing timeout: 60s.
- **Partial Failures**: If some sources fail, process available data and log failures in `jobs.log`.

### 7.2. Rate Limiting

- **API Endpoints**: 100 requests/minute per user.
- **Firecrawl Quota**: Respect provider limits; queue excess requests.
- **Per-User Limits**: Max 10 active agents per user (MVP).
- **Cron Frequency**: Minimum interval of 1 hour between agent runs.

### 7.3. Agent Dependencies

- **Circular Detection**: System validates `agent_report` references to prevent circular dependencies.
- **Execution Order**: Dependent agents wait for source agents to complete before running.
- **Stale Data Policy**: If source agent hasn't run in 24h, use cached report with warning flag.

### 7.4. Security Implementation

- **Cron Protection**: Vercel cron endpoints verified via `CRON_SECRET` header.
- **CSRF Protection**: All mutating API routes require valid session token.
- **Input Sanitization**: User prompts sanitized before LLM submission; URLs validated against allowlist patterns.
- **Audit Logging**: All agent CRUD operations logged with user ID and timestamp.

## 8. MVP Roadmap

1.  **Setup**: Next.js + Supabase + UI Shell.
2.  **Auth**: Implementing Login flow.
3.  **Agent CRUD**: Database tables and UI forms.
4.  **Backend Logic**: API Route to test Firecrawl + LLM integration manually.
5.  **Scheduling**: Connect Vercel Cron.
6.  **Google Integration**: Add "Export to Sheets" feature.
