"use client";

import { Bot, Globe, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addSource,
  deleteSource,
  getUserAgentsForSourceSelection,
} from "@/lib/actions/agents";
import { formatRelativeTime, getDomain } from "@/lib/utils";
import type { Source, SourceType, WebSearchConfig } from "@/types/database";

interface SourceListProps {
  agentId: string;
  sources: Source[];
}

export function SourceList({ agentId, sources }: SourceListProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("url");
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDepth, setSearchDepth] = useState<"basic" | "advanced">("basic");
  const [maxResults, setMaxResults] = useState(5);
  const [availableAgents, setAvailableAgents] = useState<
    { id: string; name: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdding && sourceType === "agent_report") {
      let cancelled = false;
      getUserAgentsForSourceSelection(agentId).then((agents) => {
        if (!cancelled) {
          setAvailableAgents(agents);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [isAdding, sourceType, agentId]);

  function resetForm() {
    setNewUrl("");
    setNewName("");
    setSelectedAgentId("");
    setSearchQuery("");
    setSearchDepth("basic");
    setMaxResults(5);
    setSourceType("url");
    setError(null);
  }

  async function handleAdd() {
    setError(null);
    if (!isSourceValid()) return;
    setIsLoading(true);

    const config =
      sourceType === "web_search"
        ? {
            query: searchQuery,
            search_depth: searchDepth,
            max_results: maxResults,
          }
        : undefined;

    const result = await addSource(agentId, {
      agentId,
      type: sourceType,
      url: sourceType === "url" ? newUrl : undefined,
      name: newName || undefined,
      sourceReferenceId:
        sourceType === "agent_report" ? selectedAgentId : undefined,
      config,
    });

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (result?.success) {
      resetForm();
      setIsAdding(false);
      router.refresh();
    }

    setIsLoading(false);
  }

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId);
    await deleteSource(sourceId);
    router.refresh();
    setDeletingId(null);
  }

  function isSourceValid(): boolean {
    if (sourceType === "url") return newUrl.trim().length > 0;
    if (sourceType === "web_search") return searchQuery.trim().length > 0;
    return selectedAgentId.length > 0;
  }

  function getSourceDisplayName(source: Source): string {
    if (source.name) return source.name;
    if (source.type === "url" && source.url) return getDomain(source.url);
    if (source.type === "web_search") {
      const config = source.config as WebSearchConfig | null;
      return config?.query ? `Search: ${config.query}` : "Web Search";
    }
    return "Agent Report";
  }

  function getSourceSubtitle(source: Source): string {
    if (source.type === "url" && source.url) return source.url;
    if (source.type === "web_search") {
      const config = source.config as WebSearchConfig | null;
      const depth =
        config?.search_depth === "advanced" ? "Deep search" : "Basic search";
      const results = config?.max_results || 5;
      return `${depth} - ${results} results`;
    }
    return "From another agent";
  }

  function getSourceIcon(source: Source) {
    if (source.type === "agent_report") return Bot;
    if (source.type === "web_search") return Search;
    return Globe;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sources</CardTitle>
          <CardDescription>Web pages monitored by this agent</CardDescription>
        </div>
        {!isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Source
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isAdding && (
          <div className="mb-4 space-y-3 rounded-lg border p-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={sourceType === "url" ? "default" : "outline"}
                onClick={() => setSourceType("url")}
              >
                <Globe className="mr-2 h-4 w-4" />
                Web URL
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sourceType === "web_search" ? "default" : "outline"}
                onClick={() => setSourceType("web_search")}
              >
                <Search className="mr-2 h-4 w-4" />
                Web Search
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sourceType === "agent_report" ? "default" : "outline"}
                onClick={() => setSourceType("agent_report")}
              >
                <Bot className="mr-2 h-4 w-4" />
                Agent Report
              </Button>
            </div>

            <div className="space-y-2">
              {sourceType === "url" && (
                <Input
                  placeholder="https://example.com/page"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              )}
              {sourceType === "web_search" && (
                <>
                  <Input
                    placeholder="Search query (e.g., latest AI developments)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Select
                      value={searchDepth}
                      onValueChange={(v) =>
                        setSearchDepth(v as "basic" | "advanced")
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic Search</SelectItem>
                        <SelectItem value="advanced">Deep Search</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(maxResults)}
                      onValueChange={(v) => setMaxResults(Number(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 5, 7, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} results
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {sourceType === "agent_report" && (
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAgents.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No other agents available
                      </SelectItem>
                    ) : (
                      availableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <Input
                placeholder="Label (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={isLoading || !isSourceValid()}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No sources added yet. Add a URL to start monitoring.
          </p>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => {
              const Icon = getSourceIcon(source);
              return (
                <div
                  key={source.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {getSourceDisplayName(source)}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {getSourceSubtitle(source)}
                      </p>
                      {source.last_scraped_at && (
                        <p className="text-xs text-muted-foreground">
                          Last fetched:{" "}
                          {formatRelativeTime(source.last_scraped_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(source.id)}
                    disabled={deletingId === source.id}
                  >
                    {deletingId === source.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
