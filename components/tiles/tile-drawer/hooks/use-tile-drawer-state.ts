"use client";

import { useCallback, useEffect, useState } from "react";

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
} from "@/lib/actions/tiles";
import type { TileWithSources } from "@/types/database";

import {
  type ApiKey,
  type AvailableTile,
  DEFAULT_SOURCE_TYPES,
  type DrawerSection,
  PLUGIN_STATE_STORAGE_KEY,
  type PluginCollapsedState,
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

  // Reset form state when a different tile is opened
  useEffect(() => {
    if (tile && open) {
      setConfigState({
        name: tile.name,
        instructions: tile.system_prompt || "",
        isActive: tile.is_active,
        scheduleCron: tile.schedule_cron,
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
      });
    }
  }, [tile, open]);

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
        type: sourceForm.type as "url" | "web_search",
      };

      if (sourceForm.name) {
        params.name = sourceForm.name;
      }

      if (sourceForm.type === "url") {
        params.url = sourceForm.url;
        params.urlConfig = { extract_depth: sourceForm.extractDepth };
      } else if (sourceForm.type === "web_search") {
        params.config = { query: sourceForm.searchQuery };
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
  }, [tile, sourceForm, resetSourceForm]);

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
