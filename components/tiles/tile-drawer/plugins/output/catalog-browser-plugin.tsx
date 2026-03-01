"use client";

import {
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CatalogEntryWithEventCount,
  deleteCatalogEntry,
  getCatalogEntries,
  getCatalogEntryEvents,
  getCatalogSchemaFields,
  getCatalogStats,
} from "@/lib/actions/catalog";
import { formatRelativeTime } from "@/lib/utils/format";
import type { CatalogEntryEvent, CatalogField } from "@/types/database";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface CatalogBrowserPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  funding: "bg-green-500/20 text-green-400",
  hiring: "bg-blue-500/20 text-blue-400",
  product: "bg-purple-500/20 text-purple-400",
  expansion: "bg-amber-500/20 text-amber-400",
  partnership: "bg-cyan-500/20 text-cyan-400",
  acquisition: "bg-red-500/20 text-red-400",
  news: "bg-gray-500/20 text-gray-400",
  other: "bg-gray-500/20 text-gray-400",
};

export function CatalogBrowserPlugin({
  tile,
  disabled,
  state,
}: CatalogBrowserPluginProps) {
  const { pluginState, updatePluginState } = state;

  const [entries, setEntries] = useState<CatalogEntryWithEventCount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [fields, setFields] = useState<CatalogField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [entryEvents, setEntryEvents] = useState<CatalogEntryEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalEntries: number;
    entityType: string | null;
  }>({ totalEntries: 0, entityType: null });

  const pageSize = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load fields and stats on mount
  useEffect(() => {
    getCatalogSchemaFields(tile.id).then(setFields);
    getCatalogStats(tile.id).then((s) =>
      setStats({ totalEntries: s.totalEntries, entityType: s.entityType }),
    );
  }, [tile.id]);

  // Load entries
  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    const result = await getCatalogEntries(tile.id, {
      page,
      pageSize,
      search: searchDebounced || undefined,
      sortField: sortField || undefined,
      sortDir,
    });
    setEntries(result.entries);
    setTotal(result.total);
    setIsLoading(false);
  }, [tile.id, page, pageSize, searchDebounced, sortField, sortDir]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  // Load events when entry is expanded
  useEffect(() => {
    if (!expandedEntryId) return;
    setIsLoadingEvents(true);
    getCatalogEntryEvents(expandedEntryId, { pageSize: 50 }).then((result) => {
      setEntryEvents(result.events);
      setIsLoadingEvents(false);
    });
  }, [expandedEntryId]);

  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this entity and all its events?")) return;
    setDeletingId(entryId);
    const result = await deleteCatalogEntry(entryId);
    if (result.error) {
      alert(result.error);
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setTotal((prev) => prev - 1);
      if (expandedEntryId === entryId) setExpandedEntryId(null);
    }
    setDeletingId(null);
  };

  const totalPages = Math.ceil(total / pageSize);
  const keyField = fields.find((f) => f.is_key);

  return (
    <PluginCard
      id="catalog-browser"
      title="Entity Catalog"
      description={
        stats.entityType
          ? `${stats.entityType} entities`
          : "Browse catalog entries"
      }
      icon={<Database className="h-4 w-4 text-green-400" />}
      section="output"
      collapsed={pluginState["catalog-browser"] ?? false}
      onCollapsedChange={(c) => updatePluginState("catalog-browser", c)}
      badge={{
        text: `${stats.totalEntries} entities`,
        variant: stats.totalEntries > 0 ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      {/* Search & Sort Controls */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {fields.length > 0 && (
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Recent</SelectItem>
              {fields.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? "A-Z" : "Z-A"}
        </Button>
      </div>

      {/* Entries List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          {search
            ? "No matching entities found."
            : "No entities yet. Run the tile to populate the catalog."}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            const data =
              typeof entry.data === "object" && entry.data !== null
                ? (entry.data as Record<string, unknown>)
                : {};
            const displayName =
              keyField && data[keyField.name]
                ? String(data[keyField.name])
                : entry.match_key;

            return (
              <div
                key={entry.id}
                className="rounded-lg border border-border bg-muted/20 overflow-hidden"
              >
                {/* Entry Header */}
                <button
                  onClick={() =>
                    setExpandedEntryId(isExpanded ? null : entry.id)
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatRelativeTime(entry.updated_at)}
                    </p>
                  </div>
                  {entry.event_count > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {entry.event_count} events
                    </Badge>
                  )}
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    {/* Entity Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      {fields.map((field) => {
                        const value = data[field.name];
                        if (value === undefined || value === null) return null;
                        return (
                          <div key={field.name}>
                            <p className="text-xs text-muted-foreground">
                              {field.name}
                            </p>
                            <p className="text-sm break-all">
                              {field.type === "url" ? (
                                <a
                                  href={String(value)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                                >
                                  {String(value).substring(0, 40)}...
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                String(value)
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Events Timeline */}
                    {isLoadingEvents ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : entryEvents.length > 0 ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Events
                        </p>
                        <div className="space-y-2">
                          {entryEvents.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Badge
                                className={`text-xs shrink-0 ${EVENT_TYPE_COLORS[event.event_type] || EVENT_TYPE_COLORS.other}`}
                              >
                                {event.event_type}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm">
                                  {event.title}
                                </p>
                                {event.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {event.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  {event.event_date && (
                                    <span>{event.event_date}</span>
                                  )}
                                  {event.source_url && (
                                    <a
                                      href={event.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                                    >
                                      Source
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Delete Button */}
                    <div className="pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete entry
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </PluginCard>
  );
}
