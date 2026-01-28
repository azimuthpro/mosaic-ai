"use client";

import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addSource, deleteSource } from "@/lib/actions/agents";
import { formatRelativeTime, getDomain } from "@/lib/utils";
import type { Source } from "@/types/database";

interface SourceListProps {
  agentId: string;
  sources: Source[];
}

export function SourceList({ agentId, sources }: SourceListProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!newUrl.trim()) return;

    setIsLoading(true);
    const result = await addSource(agentId, newUrl, newName || undefined);

    if (result?.success) {
      setNewUrl("");
      setNewName("");
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
            <div className="space-y-2">
              <Input
                placeholder="https://example.com/page"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
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
                disabled={isLoading || !newUrl.trim()}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewUrl("");
                  setNewName("");
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
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {source.name || getDomain(source.url)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {source.url}
                    </p>
                    {source.last_scraped_at && (
                      <p className="text-xs text-muted-foreground">
                        Last scraped:{" "}
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
