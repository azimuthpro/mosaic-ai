# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-02-07

### Added
- Webhook system for tile job event notifications (started, completed, failed)
- Webhook delivery history and retry tracking
- Webhook API routes for CRUD, testing, and delivery history
- Unified output format with Zod schema support (text/JSON with schema editor)
- Memory mode for tile sources (includes historical context from last 30 days)
- Job result deletion for owners and admins
- Universal tile connections with type-specific data extraction

### Changed
- Tile drawer refactored to plugin-based architecture (input, processing, output sections)
- Removed `recursive` tile type; existing recursive tiles converted to `analyzer`
- Consolidated database schema into single initial migration
- Simplified create dialogs (removed optional description fields)
- Renamed Dashboard menu item to Mosaics

### Fixed
- Drawer data refresh after manual tile run
- Citext extension moved to extensions schema for Supabase linter compliance
- Replaced uuid_generate_v4() with built-in gen_random_uuid()

## [1.1.0] - 2026-01-31

### Added
- Tile results now render as formatted markdown for improved readability

## [1.0.0] - 2026-01-31

### Breaking Changes
- Complete architecture refactor from Agent system to Mosaic/Tile model
- Legacy agent tables and APIs removed
- New V1 API structure (`/api/v1/tiles/[tileId]/*`)

### Added
- Mosaic workspaces with visual tile canvas
- Magic link authentication (passwordless email-based login)
- Tile connections for data pipelines between tiles
- Member invitation and ownership transfer
- Runtime URL sources for url_reader tiles
- Advanced scheduler with hourly resolution and day-of-week selection
- Per-mosaic timezone configuration
- Security guards and rate limiting (per-user hourly and concurrent limits)
- Tile drawer with API curl examples and request/response schemas

### Changed
- Auto-generated mosaic names
- Pending invitations UI
- Database schema cleanup (tile_reports → tile_job_results)

## [0.5.0] - 2026-01-31

### Added
- Advanced scheduler with hourly resolution and day-of-week selection
- Per-mosaic timezone settings; cron respects configured timezone
- Tile drawer API curl examples and request/response schemas

### Changed
- Renamed tile_reports to tile_job_results
- Removed legacy agent tables
- Client-side navigation for mosaic creation, auto-close dialogs

## [0.4.0] - 2026-01-28

### Added
- Source types system: tiles can use URL sources or other tiles' reports as input
- Tile-as-source feature enables chaining tiles for multi-stage analysis pipelines
- Circular dependency detection prevents invalid tile reference loops
- Unified content fetcher handles both web scraping and tile report retrieval
- Skills system integration for tile customization

### Changed
- Updated wizard and source list UI with type selection (Web URL / Tile Report)
- Database migration adds source_type enum, reference columns, and RLS policies

## [0.3.0] - 2026-01-27

### Added
- Agent toggle switch for enabling/disabling agents directly from cards
- Invite request form and workflow for marketing page
- Vercel Analytics integration

### Changed
- Removed description field from agent creation wizard

### Fixed
- Supabase security linter warnings
- OpenAPI specification with missing schemas and security specs

## [0.2.0] - 2026-01-25

### Added
- Core application scaffold with full authentication flow
- Dashboard with agent management: create, edit, view, and run agents
- Reports system for viewing and filtering analysis results
- Marketing landing page
- API routes for agent execution, cron triggers, and allowlist verification
- UI component library with shadcn/ui and Radix primitives
- Supabase database migrations and TypeScript type definitions
- Proxy middleware and Vercel deployment configuration

## [0.1.1] - 2026-01-25

### Added
- CLAUDE.md for Claude Code guidance
- Technical specification document (docs/specification.md)

## [0.1.0] - 2026-01-25

### Added
- Initial Next.js 16 project setup with App Router
- TypeScript, Tailwind CSS v4, ESLint configuration
