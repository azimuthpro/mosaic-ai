"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getTileExecutionStatus,
  getTileJobResults,
  type TileExecutionStatus,
  type TileJobResultSummary,
} from "@/lib/actions/tile-execution";
import {
  addTileSource,
  createTileConnection,
  deleteTileConnection,
  deleteTileSource,
  getTilesForSourceSelection,
  toggleTileActive,
  updateTile,
  updateTileConnection,
  updateTileSource,
} from "@/lib/actions/tiles";
import type { TileWithSources } from "@/types/database";

import {
  type ApiKey,
  type AvailableTile,
  DEFAULT_SOURCE_TYPES,
  type DrawerSection,
  PLUGIN_STATE_STORAGE_KEY,
  type PluginCollapsedState,
  type SourceEditFormState,
  type SourceFormState,
  type TileConfigState,
} from "../types";

interface UseTileDrawerStateProps {
  tile: TileWithSources | null;
  mosaicId: string;
  open: boolean;
}

export function useTileDrawerState({
  tile,
  mosaicId,
  open,
}: UseTileDrawerStateProps) {
  // Active section tab
  const [activeSection, setActiveSection] = useState<DrawerSection>("status");

  // Execution status
  const [executionStatus, setExecutionStatus] =
    useState<TileExecutionStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Running state
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Config form state
  const [configState, setConfigState] = useState<TileConfigState>({
    name: "",
    instructions: "",
    isActive: true,
    scheduleCron: null,
    triggerOnSourceUpdate: false,
    outputFormat: "text",
    outputSchema: "",
  });

  // Source form state
  const [sourceForm, setSourceForm] = useState<SourceFormState>({
    type: "url",
    url: "",
    name: "",
    searchQuery: "",
    extractDepth: "basic",
    selectedTileId: "",
    extractUrlsFromReport: false,
    maxUrls: 10,
    fetchMode: "fast",
    slackChannelId: "",
    slackChannelName: "",
    slackTeamId: "",
    slackTeamName: "",
    slackDays: 1,
    slackIncludeThreads: true,
  });

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  // Job results state
  const [jobResults, setJobResults] = useState<TileJobResultSummary[]>([]);
  const [isLoadingJobResults, setIsLoadingJobResults] = useState(false);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // Source management
  const [availableTiles, setAvailableTiles] = useState<AvailableTile[]>([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingConnectionId, setDeletingConnectionId] = useState<
    string | null
  >(null);
  const [deletingResultId, setDeletingResultId] = useState<string | null>(null);

  // Source editing state
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SourceEditFormState>({
    url: "",
    name: "",
    searchQuery: "",
    extractDepth: "basic",
    isActive: true,
    slackDays: 1,
    slackIncludeThreads: true,
  });
  const [isSavingSource, setIsSavingSource] = useState(false);

  // URL source modal state
  const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);
  const [editingUrlSource, setEditingUrlSource] = useState<
    TileWithSources["sources"][0] | null
  >(null);

  // Connection editing state
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(
    null,
  );
  const [editConnectionSourceTileId, setEditConnectionSourceTileId] =
    useState<string>("");
  const [isSavingConnection, setIsSavingConnection] = useState(false);

  // Increment to re-fetch execution status and job results without resetting forms
  const [dataVersion, setDataVersion] = useState(0);
  const refreshData = useCallback(() => setDataVersion((v) => v + 1), []);

  // Plugin collapsed state (persisted in localStorage)
  const [pluginState, setPluginState] = useState<PluginCollapsedState>({});

  // Load plugin state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PLUGIN_STATE_STORAGE_KEY);
      if (stored) {
        setPluginState(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save plugin state to localStorage
  const updatePluginState = useCallback(
    (pluginId: string, collapsed: boolean) => {
      setPluginState((prev) => {
        const newState = { ...prev, [pluginId]: collapsed };
        try {
          localStorage.setItem(
            PLUGIN_STATE_STORAGE_KEY,
            JSON.stringify(newState),
          );
        } catch {
          // Ignore localStorage errors
        }
        return newState;
      });
    },
    [],
  );

  // Fetch execution status when tile changes or after a manual refresh
  useEffect(() => {
    if (tile && open) {
      setIsLoadingStatus(true);
      getTileExecutionStatus(tile.id).then((status) => {
        setExecutionStatus(status);
        setIsLoadingStatus(false);
      });
    }
  }, [tile, open, dataVersion]);

  // Poll execution status while running
  useEffect(() => {
    if (!tile || !open || !isRunning) return;
    const interval = setInterval(async () => {
      const status = await getTileExecutionStatus(tile.id);
      if (status) setExecutionStatus(status);
    }, 3000);
    return () => clearInterval(interval);
  }, [tile, open, isRunning]);

  // Track which tile the form was last initialized for
  const initializedTileIdRef = useRef<string | null>(null);

  // Reset form state only when a different tile is opened or drawer reopens
  useEffect(() => {
    if (tile && open) {
      // Skip reset if form was already initialized for this tile
      if (initializedTileIdRef.current === tile.id) return;
      initializedTileIdRef.current = tile.id;

      setConfigState({
        name: tile.name,
        instructions: tile.system_prompt || "",
        isActive: tile.is_active,
        scheduleCron: tile.schedule_cron,
        triggerOnSourceUpdate: tile.trigger_on_source_update ?? false,
        outputFormat: tile.output_format || "text",
        outputSchema: tile.output_schema || "",
      });

      setSourceForm({
        type: DEFAULT_SOURCE_TYPES[tile.tile_type],
        url: "",
        name: "",
        searchQuery: "",
        extractDepth: "basic",
        selectedTileId: "",
        extractUrlsFromReport: false,
        maxUrls: 10,
        fetchMode: "fast",
        slackChannelId: "",
        slackChannelName: "",
        slackTeamId: "",
        slackTeamName: "",
        slackDays: 1,
        slackIncludeThreads: true,
      });

      // Reset edit state when switching tiles
      setEditingSourceId(null);
      setEditingConnectionId(null);
    }
  }, [tile, open]);

  // Clear initialized ref when drawer closes so next open resets the form
  useEffect(() => {
    if (!open) {
      initializedTileIdRef.current = null;
    }
  }, [open]);

  // Load API keys when input section is selected
  useEffect(() => {
    if (activeSection === "input" && tile) {
      setIsLoadingKeys(true);
      fetch(`/api/v1/mosaics/${mosaicId}/keys`)
        .then((res) => res.json())
        .then((data) => {
          setApiKeys(data.keys || []);
          setIsLoadingKeys(false);
        })
        .catch(() => {
          setIsLoadingKeys(false);
        });
    }
  }, [activeSection, tile, mosaicId]);

  // Load job results when output section is selected
  useEffect(() => {
    if (activeSection === "output" && tile) {
      setIsLoadingJobResults(true);
      getTileJobResults(tile.id).then((data) => {
        setJobResults(data);
        setIsLoadingJobResults(false);
      });
    }
  }, [activeSection, tile, dataVersion]);

  // Load available tiles when input section is selected (for tile report sources)
  useEffect(() => {
    if (activeSection === "input" && tile) {
      setIsLoadingTiles(true);
      getTilesForSourceSelection(mosaicId, tile.id).then((tiles) => {
        setAvailableTiles(tiles);
        setIsLoadingTiles(false);
      });
    }
  }, [activeSection, tile, mosaicId]);

  // Config update handlers
  const updateConfigField = useCallback(
    <K extends keyof TileConfigState>(field: K, value: TileConfigState[K]) => {
      setConfigState((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Source form update handlers
  const updateSourceField = useCallback(
    <K extends keyof SourceFormState>(field: K, value: SourceFormState[K]) => {
      setSourceForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetSourceForm = useCallback(() => {
    if (!tile) return;
    setSourceForm({
      type: DEFAULT_SOURCE_TYPES[tile.tile_type],
      url: "",
      name: "",
      searchQuery: "",
      extractDepth: "basic",
      selectedTileId: "",
      extractUrlsFromReport: false,
      maxUrls: 10,
      fetchMode: "fast",
      slackChannelId: "",
      slackChannelName: "",
      slackTeamId: "",
      slackTeamName: "",
      slackDays: 1,
      slackIncludeThreads: true,
    });
  }, [tile]);

  // Save config
  const saveConfig = useCallback(async () => {
    if (!tile) return;
    setIsSaving(true);
    try {
      await updateTile(tile.id, {
        name: configState.name,
        systemPrompt: configState.instructions,
        scheduleCron: configState.scheduleCron ?? undefined,
        triggerOnSourceUpdate: configState.triggerOnSourceUpdate,
        outputFormat: configState.outputFormat,
        outputSchema:
          configState.outputFormat === "json"
            ? configState.outputSchema
            : undefined,
      });
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  }, [tile, configState]);

  // Toggle active state
  const handleToggleActive = useCallback(async () => {
    if (!tile) return;
    const newActive = !configState.isActive;
    updateConfigField("isActive", newActive);
    await toggleTileActive(tile.id);
  }, [tile, configState.isActive, updateConfigField]);

  // Toggle trigger-on-source-update (immediately persists to DB)
  const handleToggleTriggerOnSourceUpdate = useCallback(async () => {
    if (!tile) return;
    const newValue = !configState.triggerOnSourceUpdate;
    updateConfigField("triggerOnSourceUpdate", newValue);
    await updateTile(tile.id, { triggerOnSourceUpdate: newValue });
  }, [tile, configState.triggerOnSourceUpdate, updateConfigField]);

  // Add source
  const handleAddSource = useCallback(async () => {
    if (!tile) return;

    if (sourceForm.type === "url" && !sourceForm.url.trim()) {
      alert("Please enter a URL");
      return;
    }
    if (sourceForm.type === "web_search" && !sourceForm.searchQuery.trim()) {
      alert("Please enter a search query");
      return;
    }
    if (sourceForm.type === "tile_connection" && !sourceForm.selectedTileId) {
      alert("Please select a tile");
      return;
    }
    if (sourceForm.type === "slack_channel" && !sourceForm.slackChannelId) {
      alert("Please select a Slack channel");
      return;
    }

    setIsAddingSource(true);
    try {
      if (sourceForm.type === "tile_connection") {
        const result = await createTileConnection(
          mosaicId,
          sourceForm.selectedTileId,
          tile.id,
        );
        if (result.error) {
          alert(result.error);
        } else {
          resetSourceForm();
        }
        return;
      }

      const params: Parameters<typeof addTileSource>[0] = {
        tileId: tile.id,
        type: sourceForm.type,
      };

      if (sourceForm.name) {
        params.name = sourceForm.name;
      }

      if (sourceForm.type === "url") {
        params.url = sourceForm.url;
        params.urlConfig = { extract_depth: sourceForm.extractDepth };
      } else if (sourceForm.type === "web_search") {
        params.config = { query: sourceForm.searchQuery };
      } else if (sourceForm.type === "slack_channel") {
        params.slackConfig = {
          channel_id: sourceForm.slackChannelId,
          channel_name: sourceForm.slackChannelName,
          max_messages: 500,
          include_threads: sourceForm.slackIncludeThreads,
          hours_back: sourceForm.slackDays * 24,
          ...(sourceForm.slackTeamId && {
            team_id: sourceForm.slackTeamId,
            team_name: sourceForm.slackTeamName,
          }),
        };
      }

      const result = await addTileSource(params);

      if (result.error) {
        alert(result.error);
      } else {
        resetSourceForm();
      }
    } catch (error) {
      console.error("Failed to add source:", error);
      alert("Failed to add source");
    } finally {
      setIsAddingSource(false);
    }
  }, [tile, sourceForm, resetSourceForm, mosaicId]);

  // Delete source
  const handleDeleteSource = useCallback(async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return;

    setDeletingSourceId(sourceId);
    try {
      const result = await deleteTileSource(sourceId);
      if (result.error) {
        alert(result.error);
      }
    } catch (error) {
      console.error("Failed to delete source:", error);
      alert("Failed to delete source");
    } finally {
      setDeletingSourceId(null);
    }
  }, []);

  // Delete connection
  const handleDeleteConnection = useCallback(async (connectionId: string) => {
    if (!confirm("Are you sure you want to remove this connection?")) return;

    setDeletingConnectionId(connectionId);
    try {
      const result = await deleteTileConnection(connectionId);
      if (result.error) {
        alert(result.error);
      }
    } catch (error) {
      console.error("Failed to delete connection:", error);
      alert("Failed to delete connection");
    } finally {
      setDeletingConnectionId(null);
    }
  }, []);

  // Source editing handlers
  const handleStartEditSource = useCallback(
    (source: {
      id: string;
      url: string | null;
      name: string | null;
      type: string;
      config: unknown;
      is_active: boolean;
    }) => {
      const config = source.config as {
        extract_depth?: string;
        query?: string;
        hours_back?: number;
        include_threads?: boolean;
        team_id?: string;
        team_name?: string;
      } | null;
      setEditingSourceId(source.id);
      setEditForm({
        url: source.url || "",
        name: source.name || "",
        searchQuery: config?.query || "",
        extractDepth:
          (config?.extract_depth as "basic" | "advanced") || "basic",
        isActive: source.is_active,
        slackDays: Math.round((config?.hours_back ?? 24) / 24),
        slackIncludeThreads: config?.include_threads ?? true,
      });
    },
    [],
  );

  const handleCancelEditSource = useCallback(() => {
    setEditingSourceId(null);
  }, []);

  const updateEditField = useCallback(
    <K extends keyof SourceEditFormState>(
      field: K,
      value: SourceEditFormState[K],
    ) => {
      setEditForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSaveSource = useCallback(async () => {
    if (!editingSourceId || !tile) return;

    const source = tile.sources.find((s) => s.id === editingSourceId);
    if (!source) return;

    if (source.type === "url" && !editForm.url.trim()) {
      alert("URL cannot be empty");
      return;
    }
    if (source.type === "web_search" && !editForm.searchQuery.trim()) {
      alert("Search query cannot be empty");
      return;
    }

    setIsSavingSource(true);
    try {
      const params: Parameters<typeof updateTileSource>[1] = {
        name: editForm.name || null,
        is_active: editForm.isActive,
      };

      if (source.type === "url") {
        params.url = editForm.url;
        params.config = { extract_depth: editForm.extractDepth };
      } else if (source.type === "web_search") {
        params.config = { query: editForm.searchQuery };
      } else if (source.type === "slack_channel") {
        const existingConfig = (source.config || {}) as Record<string, unknown>;
        params.config = {
          ...existingConfig,
          include_threads: editForm.slackIncludeThreads,
          hours_back: editForm.slackDays * 24,
        };
      }

      const result = await updateTileSource(editingSourceId, params);
      if (result.error) {
        alert(result.error);
      } else {
        setEditingSourceId(null);
      }
    } catch (error) {
      console.error("Failed to update source:", error);
      alert("Failed to update source");
    } finally {
      setIsSavingSource(false);
    }
  }, [editingSourceId, editForm, tile]);

  // Connection editing handlers
  const handleStartEditConnection = useCallback(
    (connectionId: string, currentSourceTileId: string) => {
      setEditingConnectionId(connectionId);
      setEditConnectionSourceTileId(currentSourceTileId);
    },
    [],
  );

  const handleCancelEditConnection = useCallback(() => {
    setEditingConnectionId(null);
  }, []);

  const handleSaveConnection = useCallback(async () => {
    if (!editingConnectionId || !editConnectionSourceTileId) return;

    setIsSavingConnection(true);
    try {
      const result = await updateTileConnection(
        editingConnectionId,
        editConnectionSourceTileId,
      );
      if (result.error) {
        alert(result.error);
      } else {
        setEditingConnectionId(null);
      }
    } catch (error) {
      console.error("Failed to update connection:", error);
      alert("Failed to update connection");
    } finally {
      setIsSavingConnection(false);
    }
  }, [editingConnectionId, editConnectionSourceTileId]);

  // URL source modal handlers
  const openAddUrlDialog = useCallback(() => {
    setIsUrlDialogOpen(true);
    setEditingUrlSource(null);
  }, []);

  const openEditUrlDialog = useCallback(
    (source: TileWithSources["sources"][0]) => {
      setIsUrlDialogOpen(true);
      setEditingUrlSource(source);
    },
    [],
  );

  const handleUrlSourceSaved = useCallback(() => {
    setIsUrlDialogOpen(false);
    setEditingUrlSource(null);
    refreshData();
  }, [refreshData]);

  // API key handlers
  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const response = await fetch(`/api/v1/mosaics/${mosaicId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowNewKey(data.key);
        setApiKeys((prev) => [
          {
            id: data.id,
            name: data.name,
            key_prefix: data.key_prefix,
            last_used_at: null,
            is_active: true,
            created_at: data.created_at,
          },
          ...prev,
        ]);
        setNewKeyName("");
      }
    } catch (error) {
      console.error("Failed to create key:", error);
    } finally {
      setIsCreatingKey(false);
    }
  }, [newKeyName, mosaicId]);

  const handleRevokeKey = useCallback(
    async (keyId: string) => {
      if (!confirm("Are you sure you want to revoke this API key?")) return;
      try {
        await fetch(`/api/v1/mosaics/${mosaicId}/keys?key_id=${keyId}`, {
          method: "DELETE",
        });
        setApiKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, is_active: false } : k)),
        );
      } catch (error) {
        console.error("Failed to revoke key:", error);
      }
    },
    [mosaicId],
  );

  return {
    // Section state
    activeSection,
    setActiveSection,

    // Execution status
    executionStatus,
    isLoadingStatus,

    // Running state
    isRunning,
    setIsRunning,
    isSaving,

    // Config state
    configState,
    updateConfigField,
    saveConfig,
    handleToggleActive,
    handleToggleTriggerOnSourceUpdate,

    // Source state
    sourceForm,
    updateSourceField,
    resetSourceForm,
    handleAddSource,
    handleDeleteSource,
    availableTiles,
    isLoadingTiles,
    isAddingSource,
    deletingSourceId,
    handleDeleteConnection,
    deletingConnectionId,
    editingConnectionId,
    editConnectionSourceTileId,
    setEditConnectionSourceTileId,
    isSavingConnection,
    handleStartEditConnection,
    handleCancelEditConnection,
    handleSaveConnection,
    editingSourceId,
    editForm,
    isSavingSource,
    handleStartEditSource,
    handleCancelEditSource,
    updateEditField,
    handleSaveSource,

    // URL source modal state
    isUrlDialogOpen,
    setIsUrlDialogOpen,
    editingUrlSource,
    openAddUrlDialog,
    openEditUrlDialog,
    handleUrlSourceSaved,
    mosaicId,

    // API keys state
    apiKeys,
    isLoadingKeys,
    isCreatingKey,
    newKeyName,
    setNewKeyName,
    showNewKey,
    setShowNewKey,
    handleCreateKey,
    handleRevokeKey,

    // Job results state
    jobResults,
    setJobResults,
    isLoadingJobResults,
    expandedResultId,
    setExpandedResultId,
    deletingResultId,
    setDeletingResultId,

    // Refresh
    refreshData,

    // Plugin state
    pluginState,
    updatePluginState,
  };
}

export type TileDrawerState = ReturnType<typeof useTileDrawerState>;
