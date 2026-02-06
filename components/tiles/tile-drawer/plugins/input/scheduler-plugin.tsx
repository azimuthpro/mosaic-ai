"use client";

import { Clock } from "lucide-react";

import { AdvancedScheduler } from "@/components/tiles/advanced-scheduler";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface SchedulerPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

function getScheduleLabel(cron: string | null): string {
  if (!cron) return "Manual";

  // Parse common presets
  if (cron === "0 * * * *") return "Hourly";
  if (cron === "0 9 * * *") return "Daily";
  if (cron === "0 9 * * 1") return "Weekly";

  // Parse custom cron
  const parts = cron.split(" ");
  if (parts.length !== 5) return "Custom";

  const [, hoursPart, , , daysPart] = parts;
  const hours = hoursPart === "*" ? [] : hoursPart.split(",");
  const isCustom =
    hours.length > 1 || (daysPart !== "*" && daysPart !== "1,2,3,4,5,6,0");

  if (isCustom) return "Custom";
  return "Custom";
}

export function SchedulerPlugin({
  tile,
  disabled,
  state,
}: SchedulerPluginProps) {
  const {
    configState,
    updateConfigField,
    isSaving,
    pluginState,
    updatePluginState,
  } = state;

  const scheduleLabel = getScheduleLabel(configState.scheduleCron);
  const isActive = configState.isActive;

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
      toggleEnabled
      isEnabled={isActive}
      onToggleEnabled={() => {
        updateConfigField("isActive", !isActive);
        // Also trigger server update
        state.handleToggleActive();
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
