"use client";

import { Loader2, LogOut, Plus, Slack } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteUserIntegration } from "@/lib/actions/integrations";

interface Workspace {
  team_id: string;
  team_name: string;
}

interface SlackConnectButtonProps {
  returnTo?: string;
  onDisconnect?: () => void;
}

export function SlackConnectButton({
  returnTo,
  onDisconnect,
}: SlackConnectButtonProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/slack/channels")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setWorkspaces(data.workspaces ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect(teamId: string) {
    setDisconnecting(teamId);
    await deleteUserIntegration("slack", teamId);
    setWorkspaces((prev) => prev.filter((w) => w.team_id !== teamId));
    setDisconnecting(null);
    onDisconnect?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Slack connection...
      </div>
    );
  }

  const connectUrl = `/api/auth/slack/connect${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <div className="space-y-2">
      {workspaces.map((ws) => (
        <div
          key={ws.team_id}
          className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <Slack className="h-4 w-4 text-[#4A154B]" />
            <span className="text-sm font-medium">{ws.team_name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-red-400"
            onClick={() => handleDisconnect(ws.team_id)}
            disabled={disconnecting === ws.team_id}
          >
            {disconnecting === ws.team_id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            Disconnect
          </Button>
        </div>
      ))}

      <a href={connectUrl}>
        <Button variant="outline" size="sm" className="gap-2 w-full">
          <Plus className="h-4 w-4" />
          {workspaces.length > 0 ? "Add Slack Workspace" : "Connect Slack"}
        </Button>
      </a>
    </div>
  );
}
