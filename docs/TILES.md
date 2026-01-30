# Tile Ecosystem: Mosaic AI

This document describes the Mosaic and Tile architecture in the Mosaic AI platform, including tile types, connections, and execution.

---

## Architecture Overview

### Mosaics

A **Mosaic** is a workspace container that organizes your intelligence gathering. Each mosaic contains:

- **Tiles**: Individual intelligence gathering units
- **Connections**: Data flow links between tiles
- **Members**: Users with shared access (owner, admin, member roles)
- **Settings**: Workspace-level configuration

Mosaics enable:
- Visual organization of related intelligence tasks
- Team collaboration with role-based access
- Unified execution of connected tiles

### Tiles

A **Tile** is the fundamental intelligence gathering unit. Tiles replace the legacy "Agent" concept with a visual, grid-based representation. Each tile:

- Has a **type** that determines its function
- Has **visual properties** (color, pattern) for quick identification
- Can be **connected** to other tiles for data flow
- Has **sources** that provide input data
- Produces **reports** as output

---

## Tile Types

### 1. URL Reader Tile

**Objective**: Scrape and analyze content from specific URLs.

- **Trigger**:
  - **Schedule**: Cron-based periodic runs (Daily, Weekly, etc.).
  - **Manual**: Triggered by user from the mosaic canvas.
  - **API**: `POST /api/tiles/run` with `tileId`.
- **Input**:
  - `sources`: A list of web URLs to scrape via Firecrawl.
- **Configuration**:
  - `system_prompt`: Instructions for the LLM on how to process the scraped content.
  - `output_format`: The desired structure of the analysis (`text`, `list`, `table`, `json`).
  - `language`: Target language for the report (`en`, `pl`, `es`, `it`, `de`).
- **Visual**:
  - Default color: Blue (#3B82F6)
  - Pattern: Solid
  - Icon: Globe
- **Output**:
  - Structured analysis stored in the `tile_reports` table.

---

### 2. Web Search Tile

**Objective**: Perform autonomous web searches to gather information on dynamic topics.

- **Trigger**:
  - **Schedule/Manual**: Regular research missions.
  - **API**: `POST /api/tiles/run` with `tileId`.
- **Input**:
  - `sources`: Web search queries processed via Tavily API.
- **Configuration**:
  - `query`: The search term passed to the Tavily API.
  - `search_depth`: `basic` or `advanced` search modes.
  - `max_results`: Number of search results to process (default: 5).
  - `include_raw_content`: Whether to pull full page content from search results.
  - `system_prompt`: Instructions for synthesizing search results.
- **Visual**:
  - Default color: Purple (#8B5CF6)
  - Pattern: Stripes
  - Icon: Search
- **Output**:
  - Comprehensive research reports based on multiple web sources.

---

### 3. Pipeline Tile (Recursive)

**Objective**: Chain intelligence by using outputs from connected tiles as input.

- **Trigger**:
  - **Dependency-based**: Automatically starts after connected source tiles complete.
  - **Schedule/Manual**: Similar to URL Reader Tile.
  - **API**: `POST /api/tiles/run` with `tileId`.
- **Input**:
  - `connections`: Reports from connected tiles (via tile_connections).
  - `sources`: Can also include direct sources (URLs, searches).
- **Configuration**:
  - `system_prompt`: Instructions for consolidating or further analyzing the data.
  - `output_format`: Desired output structure.
  - `max_chain_depth`: Maximum recursion depth (1-10, default: 5).
- **Visual**:
  - Default color: Green (#10B981)
  - Pattern: Dots
  - Icon: GitBranch
- **Output**:
  - Higher-level intelligence or consolidated reports.

---

### 4. Analyzer Tile

**Objective**: Process and analyze data from connected tiles with specialized analysis.

- **Trigger**:
  - **Schedule/Manual**: Regular analysis runs.
  - **API**: `POST /api/tiles/run` with `tileId`.
- **Input**:
  - `connections`: Data from connected tiles.
- **Configuration**:
  - `system_prompt`: Specialized analysis instructions.
  - `output_format`: Desired output structure.
- **Visual**:
  - Default color: Amber (#F59E0B)
  - Pattern: Gradient
  - Icon: Brain
- **Output**:
  - Processed analysis based on connected tile outputs.

---

## Tile Connections

Connections define data flow between tiles in a mosaic.

### Connection Properties

- **Source Tile**: The tile that produces output
- **Target Tile**: The tile that receives input
- **Mosaic Scope**: Connections only exist within a single mosaic

### Connection Rules

1. **No Self-Reference**: A tile cannot connect to itself
2. **No Circular Dependencies**: Connections cannot form cycles
3. **Depth Limits**: Chain depth is limited to prevent infinite recursion

### Visual Indication

- Connected tiles "glow" when a tile is selected
- Connection lines can be displayed on canvas view
- Color-coded to match source tile color

---

## Tile Sources

Each tile can have multiple sources that provide input data:

| Source Type      | Description                                    | Required Config        |
| :--------------- | :--------------------------------------------- | :--------------------- |
| `url`            | Web page scraped via Firecrawl                 | `url`                  |
| `agent_report`   | Latest report from a connected tile            | `source_reference_id`  |
| `web_search`     | AI-powered search via Tavily                   | `query` in `config`    |

---

## Mosaic Sharing

Mosaics support role-based access control:

| Role       | Capabilities                                           |
| :--------- | :----------------------------------------------------- |
| `owner`    | Full control: delete mosaic, manage members, all tiles |
| `admin`    | Manage tiles: create, edit, delete, run                |
| `member`   | View only: see tiles and reports                       |

---

## Execution

### Manual Execution

Users can manually run any tile from the mosaic canvas using the "Run" button on each tile card.

### Scheduled Execution

Tiles can be configured with a `schedule_cron` for periodic execution via Vercel Cron Jobs.

### API Execution

```http
POST /api/tiles/run
Content-Type: application/json

{
  "tileId": "uuid-of-tile"
}
```

### Execution Guards

- **Rate Limiting**: Per-user hourly and concurrent execution limits
- **Timeout Protection**: Maximum execution time (default: 5 minutes)
- **Depth Limiting**: Maximum chain depth (default: 5)
- **Cycle Detection**: Runtime prevention of circular execution

---

## Data Model

### Tile Table

| Column                | Type      | Description                              |
| :-------------------- | :-------- | :--------------------------------------- |
| `id`                  | UUID      | Primary key                              |
| `mosaic_id`           | UUID      | Parent mosaic                            |
| `name`                | VARCHAR   | Display name                             |
| `tile_type`           | ENUM      | url_reader, web_search, recursive, analyzer |
| `color`               | VARCHAR   | Hex color code                           |
| `pattern`             | ENUM      | solid, stripes, dots, gradient           |
| `grid_x`, `grid_y`    | INT       | Position on canvas                       |
| `grid_width`, `grid_height` | INT  | Size on canvas                           |
| `system_prompt`       | TEXT      | AI instructions                          |
| `output_format`       | ENUM      | text, list, table, json                  |
| `schedule_cron`       | VARCHAR   | Cron expression for scheduling           |
| `is_active`           | BOOLEAN   | Enable/disable tile                      |

### Tile Connections Table

| Column            | Type      | Description                              |
| :---------------- | :-------- | :--------------------------------------- |
| `id`              | UUID      | Primary key                              |
| `mosaic_id`       | UUID      | Parent mosaic                            |
| `source_tile_id`  | UUID      | Tile providing output                    |
| `target_tile_id`  | UUID      | Tile receiving input                     |

---

## Migration from Agents

Existing agents are automatically migrated to tiles:

1. A default mosaic "My First Mosaic" is created for each user
2. All agents become tiles in that mosaic
3. Agent types are mapped to tile types based on sources:
   - URL sources → `url_reader`
   - Agent report sources → `recursive`
   - Web search sources → `web_search`
4. Sources, jobs, and reports are migrated to new tables

Legacy agent tables are preserved for backwards compatibility but marked as deprecated.

---

## Future Tile Types (Roadmap)

| Type           | Input          | Description                                   |
| :------------- | :------------- | :-------------------------------------------- |
| `file_upload`  | PDF, CSV, Text | Analyze uploaded documents                    |
| `api_endpoint` | JSON/XML       | Fetch from external REST/GraphQL APIs         |
| `rss_feed`     | XML Feed       | Monitor news and blogs                        |
| `aggregator`   | Multiple tiles | Combine outputs from many tiles               |
