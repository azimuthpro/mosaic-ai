# Agent Ecosystem: Mosaic AI

This document describes the various types of agents available in the Mosaic AI platform, their inputs, outputs, triggers, and configurations.

---

## 1. Web Reader Agent (MVP)

**Objective**: Scrape and analyze content from specific URLs.

- **Trigger**:
  - **Schedule**: Cron-based periodic runs (Daily, Weekly, etc.).
  - **Manual**: Triggered by user from the dashboard.
  - **Inbound API**: `PATCH /api/v1/agents/{agent_id}/trigger`.
- **Input**:
  - `urls`: A list of web addresses to scrape.
- **Configuration**:
  - `system_prompt`: Instructions for the LLM on how to process the scraped content.
  - `output_format`: The desired structure of the analysis (`text`, `list`, `table`, `json`).
  - `language`: Target language for the report (`en`, `pl`, `es`, `it`, `de`).
- **Output**:
  - Structured analysis stored in the `reports` table.
  - Optional: Appended row to a connected Google Sheet.

---

## 2. Recursive Agent (MVP)

**Objective**: Chain intelligence by using outputs from other agents as input.

- **Trigger**:
  - **Dependency-based**: Automatically starts after the "source" agent completes its job.
  - **Schedule/Manual**: Similar to Web Reader Agent.
  - **Inbound API**: `PATCH /api/v1/agents/{agent_id}/trigger`.
- **Input**:
  - `agent_report`: The latest successful report from one or more referenced agents.
- **Configuration**:
  - `source_reference_id`: UUID of the agent whose output will be ingested.
  - `system_prompt`: Instructions for consolidating or further analyzing the data.
  - `output_format`: Desired output structure.
- **Output**:
  - Higher-level intelligence or consolidated reports.

---

## 3. Researcher Agent (BETA)

**Objective**: Perform autonomous web searches to gather information on dynamic topics.

- **Trigger**:
  - **Schedule/Manual**: Regular research missions.
  - **Inbound API**: `PATCH /api/v1/agents/{agent_id}/trigger`.
- **Input**:
  - `web_search`: A search query (can include dynamic placeholders).
- **Configuration**:
  - `query`: The search term passed to the Tavily API.
  - `search_depth`: `basic` or `advanced` search modes.
  - `max_results`: Number of search results to process (default: 5).
  - `include_raw_content`: Whether to pull full page content from search results.
  - `system_prompt`: Instructions for synthesizing search results.
- **Output**:
  - Comprehensive research reports based on multiple web sources.

---

## 4. API Push Agent (Actionable)

**Objective**: Allow external systems to trigger an agent run by "pushing" specific data context via API.

- **Trigger**:
  - **Inbound API**: `PATCH /api/v1/agents/{agent_id}/trigger`.
- **Input**:
  - `json_data`: A JSON object containing specific fields (e.g., `{"company_name": "Antigravity", "search_intent": "Contact details"}`).
- **Configuration**:
  - **Variable Mapping**: The `system_prompt` can use handlebars-style placeholders (e.g., `{{company_name}}`) which are dynamically replaced by values from the incoming JSON payload.
  - `system_prompt`: Instructions on how to use the pushed data for analysis or further research.
- **Output**:
  - Instant processing and structured result generation.

---

## 5. Lead Enrichment Agent (Deep Research)

**Objective**: Specialized service for finding professional contact details and LinkedIn profiles across the web.

- **Trigger**:
  - **Schedule/Manual**: Periodic lead list processing.
  - **Reactive**: Triggered when a "Feeder Agent" identifies a new prospect.
  - **Inbound API**: `PATCH /api/v1/agents/{agent_id}/trigger`.
- **Process (Deep Search Logic)**:
  - **Discovery**: Uses `web_search` (Tavily) to locate official company pages and professional profiles.
  - **Verification**: Cross-references findings across multiple sources (LinkedIn, Company About Us, Team pages).
  - **Extraction**: Uses `Web Reader` (Firecrawl) to scrape specific profile data and contact sections.
- **Configuration**:
  - `target_entities`: List of names or companies to enrich.
  - `extraction_fields`: Fields to find (e.g., `LinkedIn URL`, `Email Address`, `Phone Number`).
- **Output**:
  - Verified professional profiles and contact information.

---

## 6. Skills (Extensibility)

Agents can be enhanced with "Skills" which are predefined instruction sets for specific domains.

- **Categories**: `news`, `market`, `research`, `social`, `deep-search`.
- **Purpose**: Standardize how agents handle common tasks (e.g., "Market Analysis Skill" provides a tested prompt for extracting financial data).

---

## 7. Future Agent Types (Roadmap)

| Type           | Input          | Description                                             |
| :------------- | :------------- | :------------------------------------------------------ |
| `file_upload`  | PDF, CSV, Text | Analyze local documents uploaded by the user.           |
| `api_endpoint` | JSON/XML       | Fetch and process data from external REST/GraphQL APIs. |
| `db_query`     | SQL            | Ingest data directly from connected databases.          |
| `rss_feed`     | XML Feed       | Monitor news and blogs for real-time updates.           |
| `google_drive` | GDoc/GSheet    | Monitor specific folders for new or updated files.      |

---

## Summary of Agent Triggers

| Trigger Type         | Description                                                           |
| :------------------- | :-------------------------------------------------------------------- |
| **Scheduled (Cron)** | Periodic execution based on user-defined frequency.                   |
| **Reactive (Chain)** | Triggered by the completion of another agent's report.                |
| **Inbound (API)**    | Triggered via `PATCH` request with custom JSON data.                  |
| **On-Demand**        | Manually executed via Dashboard.                                      |
| **Webhook (Future)** | Triggered by external system events (e.g., new file in Google Drive). |
