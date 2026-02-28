"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SlackChannel {
  id: string;
  name: string;
}

interface WorkspaceChannels {
  team_id: string;
  team_name: string;
  channels: SlackChannel[];
}

interface SlackChannelPickerProps {
  value: string | null;
  onChange: (
    channelId: string,
    channelName: string,
    teamId: string,
    teamName: string,
  ) => void;
  disabled?: boolean;
  /** Pre-select a specific workspace */
  teamId?: string;
}

export function SlackChannelPicker({
  value,
  onChange,
  disabled,
  teamId: initialTeamId,
}: SlackChannelPickerProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceChannels[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    initialTeamId || "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/slack/channels")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to load channels");
          return;
        }
        const data = await res.json();
        const ws: WorkspaceChannels[] = data.workspaces || [];
        setWorkspaces(ws);

        // Auto-select workspace if only one, or if initialTeamId matches
        if (initialTeamId) {
          setSelectedTeamId(initialTeamId);
        } else if (ws.length === 1) {
          setSelectedTeamId(ws[0].team_id);
        }
      })
      .catch(() => setError("Failed to load channels"))
      .finally(() => setLoading(false));
  }, [initialTeamId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading channels...
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  if (workspaces.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No channels found. Make sure the Slack bot has been added to channels.
      </p>
    );
  }

  const activeWorkspace = workspaces.find((w) => w.team_id === selectedTeamId);
  const channels = activeWorkspace?.channels || [];

  return (
    <div className="space-y-2">
      {workspaces.length > 1 && (
        <div className="space-y-1">
          <Label className="text-xs">Workspace</Label>
          <Select
            value={selectedTeamId}
            onValueChange={setSelectedTeamId}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a workspace..." />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.team_id} value={ws.team_id}>
                  {ws.team_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedTeamId && channels.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No channels found in this workspace. Make sure the Slack bot has been
          added to channels.
        </p>
      )}

      {selectedTeamId && channels.length > 0 && (
        <Select
          value={value || ""}
          onValueChange={(id) => {
            const channel = channels.find((c) => c.id === id);
            if (channel) {
              onChange(
                channel.id,
                channel.name,
                activeWorkspace!.team_id,
                activeWorkspace!.team_name,
              );
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a channel..." />
          </SelectTrigger>
          <SelectContent>
            {channels.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                #{ch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
