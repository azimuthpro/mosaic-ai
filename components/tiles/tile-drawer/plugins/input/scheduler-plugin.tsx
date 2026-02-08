"use client";

import { Clock } from "lucide-react";

import { AdvancedScheduler } from "@/components/tiles/advanced-scheduler";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";
import { getScheduleLabel } from "../utils";

interface SchedulerPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

export function SchedulerPlugin({ disabled, state }: SchedulerPluginProps) {
  const { configState, updateConfigField, isSaving, pluginState, updatePluginState } = state;
  const scheduleLabel = getScheduleLabel(configState.scheduleCron);

  return (
    <PluginCard
      id="scheduler"
      title="Scheduler"
      description="Configure automatic execution"
      icon={<Clock className="h-4 w-4 text-cyan-400" />}
      section="input"
      collapsed={pluginState["scheduler"] ?? false}
      onCollapsedChange={(collapsed) =>
        updatePluginState("scheduler", collapsed)
      }
      badge={{
        text: scheduleLabel,
        variant: scheduleLabel === "Manual" ? "outline" : "secondary",
      }}
      disabled={disabled}
    >
      <AdvancedScheduler
        value={configState.scheduleCron}
        onChange={(cron) => updateConfigField("scheduleCron", cron)}
        disabled={isSaving || disabled}
      />
    </PluginCard>
  );
}
