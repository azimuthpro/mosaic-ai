"use client";

import { Hash, Loader2, Slack } from "lucide-react";
import { useState } from "react";

import { SlackChannelPicker } from "@/components/slack/slack-channel-picker";
import { SlackConnectButton } from "@/components/slack/slack-connect-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateTileSlackOutput } from "@/lib/actions/tiles";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface SlackOutputPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

function getBadgeText(enabled: boolean, channelName: string | null): string {
  if (!enabled) return "Off";
  if (channelName) return `#${channelName}`;
  return "On";
}

export function SlackOutputPlugin({
  tile,
  mosaicId,
  disabled,
  state,
}: SlackOutputPluginProps) {
  const { pluginState, updatePluginState } = state;

  const isCollapsed = pluginState["slack_output"] ?? true;

  const [enabled, setEnabled] = useState(tile.slack_output_enabled ?? false);
  const [channelId, setChannelId] = useState<string | null>(
    tile.slack_output_channel_id ?? null,
  );
  const [channelName, setChannelName] = useState<string | null>(
    tile.slack_output_channel_name ?? null,
  );
  const [saving, setSaving] = useState(false);

  async function handleToggleEnabled(value: boolean) {
    setEnabled(value);
    setSaving(true);
    await updateTileSlackOutput(tile.id, {
      enabled: value,
      channelId,
      channelName,
    });
    setSaving(false);
  }

  async function handleChannelChange(id: string, name: string) {
    setChannelId(id);
    setChannelName(name);
    setSaving(true);
    await updateTileSlackOutput(tile.id, {
      enabled,
      channelId: id,
      channelName: name,
    });
    setSaving(false);
  }

  return (
    <PluginCard
      id="slack_output"
      title="Slack Output"
      description="Post results to a Slack channel"
      icon={<Slack className="h-4 w-4 text-[#4A154B]" />}
      section="output"
      collapsed={isCollapsed}
      onCollapsedChange={(collapsed) =>
        updatePluginState("slack_output", collapsed)
      }
      badge={{
        text: getBadgeText(enabled, channelName),
        variant: enabled ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Post results to Slack</Label>
          <div className="flex items-center gap-2">
            {saving && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={disabled || saving}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
        </div>

        {enabled && (
          <div className="space-y-3">
            <SlackConnectButton returnTo={`/mosaics/${mosaicId}`} />

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Hash className="h-3.5 w-3.5" />
                Channel
              </Label>
              <SlackChannelPicker
                value={channelId}
                onChange={handleChannelChange}
                disabled={disabled || saving}
              />
            </div>
          </div>
        )}
      </div>
    </PluginCard>
  );
}
