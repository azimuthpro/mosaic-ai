"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
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

interface SlackMultiChannelPickerProps {
  channels: SlackChannel[];
  onChange: (channels: SlackChannel[]) => void;
  maxChannels: number;
  disabled?: boolean;
}

export function SlackMultiChannelPicker({
  channels: selectedChannels,
  onChange,
  maxChannels,
  disabled,
}: SlackMultiChannelPickerProps) {
  const [availableChannels, setAvailableChannels] = useState<SlackChannel[]>(
    [],
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
        setAvailableChannels(data.channels || []);
      })
      .catch(() => setError("Failed to load channels"))
      .finally(() => setLoading(false));
  }, []);

  const selectedIds = new Set(selectedChannels.map((c) => c.id));
  const unselectedChannels = availableChannels.filter(
    (c) => !selectedIds.has(c.id),
  );
  const isLimitReached = selectedChannels.length >= maxChannels;

  function handleAdd(channelId: string) {
    const channel = availableChannels.find((c) => c.id === channelId);
    if (channel && !selectedIds.has(channelId)) {
      onChange([...selectedChannels, channel]);
    }
  }

  function handleRemove(channelId: string) {
    onChange(selectedChannels.filter((c) => c.id !== channelId));
  }

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

  if (availableChannels.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No channels found. Make sure the Slack bot has been added to channels.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {selectedChannels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedChannels.map((ch) => (
            <Badge
              key={ch.id}
              variant="secondary"
              className="flex items-center gap-1.5 pr-1"
            >
              <span>#{ch.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(ch.id)}
                disabled={disabled}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {!isLimitReached && unselectedChannels.length > 0 && (
        <Select value="" onValueChange={handleAdd} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Add a channel..." />
          </SelectTrigger>
          <SelectContent>
            {unselectedChannels.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                #{ch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedChannels.length}/{maxChannels} channels selected
      </p>
    </div>
  );
}
