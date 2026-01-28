"use client";

import { Bot, Globe, Loader2, Plus, Trash2 } from "lucide-react";
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
import type { Source, SourceType } from "@/types/database";

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
    setSourceType("url");
    setError(null);
  }

  async function handleAdd() {
    setError(null);
    if (!isSourceValid()) return;
    setIsLoading(true);

    const result = await addSource(agentId, {
      agentId,
      type: sourceType,
      url: sourceType === "url" ? newUrl : undefined,
      name: newName || undefined,
      sourceReferenceId:
        sourceType === "agent_report" ? selectedAgentId : undefined,
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
    return selectedAgentId.length > 0;
  }

  function getSourceDisplayName(source: Source): string {
    if (source.name) return source.name;
    if (source.type === "url" && source.url) return getDomain(source.url);
    return "Agent Report";
  }

  function getSourceSubtitle(source: Source): string {
    return source.type === "url" && source.url ? source.url : "From another agent";
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

            <div className="flex gap-2">
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
                variant={sourceType === "agent_report" ? "default" : "outline"}
                onClick={() => setSourceType("agent_report")}
              >
                <Bot className="mr-2 h-4 w-4" />
                Agent Report
              </Button>
            </div>

            <div className="space-y-2">
              {sourceType === "url" ? (
                <Input
                  placeholder="https://example.com/page"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              ) : (
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
              const Icon = source.type === "agent_report" ? Bot : Globe;
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
