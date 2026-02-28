import type {
  FetchMode,
  OutputFormat,
  TileType,
  TileWithSources,
} from "@/types/database";

// Section accent colors (DAW plugin rack style)
export const SECTION_COLORS = {
  input: "cyan",
  processing: "purple",
  output: "green",
  status: "amber",
} as const;

export type SectionType = keyof typeof SECTION_COLORS;

// Tile type labels for display
export const TILE_TYPE_LABELS: Record<TileType, string> = {
  url_reader: "URL Reader",
  web_search: "Web Search",
  analyzer: "Analyzer",
  slack_reader: "Slack Reader",
};

// Source type configuration for icons and colors
export const SOURCE_TYPE_CONFIG = {
  url: { icon: "Globe", color: "text-cyan-400", label: "URL" },
  web_search: { icon: "Search", color: "text-pink-400", label: "Web Search" },
  tile_connection: {
    icon: "Link2",
    color: "text-teal-400",
    label: "Tile Connection",
  },
  slack_channel: {
    icon: "Hash",
    color: "text-[#4A154B]",
    label: "Slack Channel",
  },
} as const;

export type SourceTypeKey = keyof typeof SOURCE_TYPE_CONFIG;

// Default source types per tile type
export const DEFAULT_SOURCE_TYPES: Record<TileType, SourceTypeKey> = {
  url_reader: "url",
  web_search: "web_search",
  analyzer: "tile_connection",
  slack_reader: "slack_channel",
};

// Plugin collapsed state storage key
export const PLUGIN_STATE_STORAGE_KEY = "mosaic-tile-drawer-plugin-state";

// Plugin state interface for localStorage persistence
export interface PluginCollapsedState {
  [pluginId: string]: boolean;
}

// Drawer props passed to components
export interface TileDrawerProps {
  tile: TileWithSources | null;
  mosaicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunTile?: (tileId: string) => Promise<void>;
}

// API Key interface
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

// Source form state
export interface SourceFormState {
  type: SourceTypeKey;
  url: string;
  name: string;
  searchQuery: string;
  extractDepth: "basic" | "advanced";
  selectedTileId: string;
  extractUrlsFromReport: boolean;
  maxUrls: number;
  fetchMode: FetchMode;
  slackChannelId: string;
  slackChannelName: string;
}

// Source edit form state (for editing existing sources)
export interface SourceEditFormState {
  url: string;
  name: string;
  searchQuery: string;
  extractDepth: "basic" | "advanced";
  isActive: boolean;
}

// Tile config form state
export interface TileConfigState {
  name: string;
  instructions: string;
  isActive: boolean;
  scheduleCron: string | null;
  triggerOnSourceUpdate: boolean;
  outputFormat: OutputFormat;
  outputSchema: string;
}

// Execution status types (imported from tile-execution but reexported for convenience)
export type {
  TileExecutionStatus,
  TileJobResultSummary,
} from "@/lib/actions/tile-execution";

// Available tile for source selection
export interface AvailableTile {
  id: string;
  name: string;
  tile_type: string;
}

// Plugin badge info
export interface PluginBadgeInfo {
  text: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

// Plugin base props
export interface PluginBaseProps {
  tile: TileWithSources;
  mosaicId: string;
  disabled?: boolean;
}

// Section tab type
export type DrawerSection = "status" | "input" | "processing" | "output";
