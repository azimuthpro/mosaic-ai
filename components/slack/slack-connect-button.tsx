"use client";

import { CheckCircle2, Loader2, LogOut, Slack } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteUserIntegration } from "@/lib/actions/integrations";

interface SlackConnectButtonProps {
  returnTo?: string;
  onDisconnect?: () => void;
}

export function SlackConnectButton({
  returnTo,
  onDisconnect,
}: SlackConnectButtonProps) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch("/api/slack/channels")
      .then((res) => setConnected(res.ok))
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    await deleteUserIntegration("slack");
    setConnected(false);
    setDisconnecting(false);
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

  if (connected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium">Slack connected</span>
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
    );
  }

  const connectUrl = `/api/auth/slack/connect${returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <a href={connectUrl}>
      <Button variant="outline" size="sm" className="gap-2 w-full">
        <Slack className="h-4 w-4" />
        Connect Slack
      </Button>
    </a>
  );
}
