"use client";

import { CircleDot, Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteUserIntegration } from "@/lib/actions/integrations";

interface GitHubConnectButtonProps {
  returnTo?: string;
  onDisconnect?: () => void;
}

export function GitHubConnectButton({
  returnTo,
  onDisconnect,
}: GitHubConnectButtonProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/github/status")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setUsername(data.username ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await deleteUserIntegration("github", "");
    setUsername(null);
    setDisconnecting(false);
    onDisconnect?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking GitHub connection...
      </div>
    );
  }

  const connectUrl = `/api/auth/github/connect${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <div className="space-y-2">
      {username ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">{username}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-red-400"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            Disconnect
          </Button>
        </div>
      ) : (
        <a href={connectUrl}>
          <Button variant="outline" size="sm" className="gap-2 w-full">
            <CircleDot className="h-4 w-4" />
            Connect GitHub
          </Button>
        </a>
      )}
    </div>
  );
}
