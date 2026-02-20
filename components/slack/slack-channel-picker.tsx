"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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

interface SlackChannelPickerProps {
  value: string | null;
  onChange: (channelId: string, channelName: string) => void;
  disabled?: boolean;
}

export function SlackChannelPicker({
  value,
  onChange,
  disabled,
}: SlackChannelPickerProps) {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
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
        setChannels(data.channels || []);
      })
      .catch(() => setError("Failed to load channels"))
      .finally(() => setLoading(false));
  }, []);

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

  if (channels.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No channels found. Make sure the Slack bot has been added to channels.
      </p>
    );
  }

  return (
    <Select
      value={value || ""}
      onValueChange={(id) => {
        const channel = channels.find((c) => c.id === id);
        if (channel) onChange(channel.id, channel.name);
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
  );
}
