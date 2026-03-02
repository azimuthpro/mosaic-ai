"use client";

import { Clock, Hand, Timer, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScheduleMode = "preset" | "custom";
type PresetType = "manual" | "hourly";

interface ScheduleConfig {
  mode: ScheduleMode;
  preset?: PresetType;
  custom?: {
    hours: number[];
    daysOfWeek: number[];
  };
}

const PRESET_OPTIONS = [
  {
    value: "manual" as const,
    label: "Manual",
    description: "Run only when triggered manually",
    cron: null,
    icon: Hand,
  },
  {
    value: "hourly" as const,
    label: "Hourly",
    description: "Run every hour",
    cron: "0 * * * *",
    icon: Timer,
  },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun", fullLabel: "Sunday" },
  { value: 1, label: "Mon", fullLabel: "Monday" },
  { value: 2, label: "Tue", fullLabel: "Tuesday" },
  { value: 3, label: "Wed", fullLabel: "Wednesday" },
  { value: 4, label: "Thu", fullLabel: "Thursday" },
  { value: 5, label: "Fri", fullLabel: "Friday" },
  { value: 6, label: "Sat", fullLabel: "Saturday" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function configToCron(config: ScheduleConfig): string | null {
  if (config.mode === "preset") {
    const preset = PRESET_OPTIONS.find((p) => p.value === config.preset);
    return preset?.cron ?? null;
  }

  if (!config.custom) return null;

  const { hours, daysOfWeek } = config.custom;
  if (hours.length === 0) return null;

  const hoursPart = hours.sort((a, b) => a - b).join(",");
  const daysPart =
    daysOfWeek.length === 0 || daysOfWeek.length === 7
      ? "*"
      : daysOfWeek.sort((a, b) => a - b).join(",");

  return `0 ${hoursPart} * * ${daysPart}`;
}

function parseCronToConfig(cron: string | null): ScheduleConfig {
  if (!cron) {
    return { mode: "preset", preset: "manual" };
  }

  const presetMatch = PRESET_OPTIONS.find((p) => p.cron === cron);
  if (presetMatch) {
    return { mode: "preset", preset: presetMatch.value };
  }

  // Parse custom cron: "0 hour1,hour2 * * day1,day2"
  const parts = cron.split(" ");
  if (parts.length !== 5) {
    return { mode: "preset", preset: "manual" };
  }

  const [, hoursPart, , , daysPart] = parts;

  const hours = hoursPart === "*" ? [] : hoursPart.split(",").map(Number);
  const daysOfWeek =
    daysPart === "*" ? [0, 1, 2, 3, 4, 5, 6] : daysPart.split(",").map(Number);

  return {
    mode: "custom",
    custom: { hours, daysOfWeek },
  };
}

function formatDaysOfWeek(daysOfWeek: number[]): string {
  const isWeekdays =
    daysOfWeek.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => daysOfWeek.includes(d));
  const isWeekends =
    daysOfWeek.length === 2 && [0, 6].every((d) => daysOfWeek.includes(d));
  const isEveryDay = daysOfWeek.length === 0 || daysOfWeek.length === 7;

  if (isEveryDay) return "every day";
  if (isWeekdays) return "weekdays";
  if (isWeekends) return "weekends";

  return daysOfWeek
    .sort((a, b) => a - b)
    .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
    .join(", ");
}

function getSchedulePreview(config: ScheduleConfig): string {
  if (config.mode === "preset") {
    const preset = PRESET_OPTIONS.find((p) => p.value === config.preset);
    return preset?.description ?? "";
  }

  if (!config.custom) return "";

  const { hours, daysOfWeek } = config.custom;
  if (hours.length === 0) return "No schedule configured";

  const hoursStr =
    hours.length === 1
      ? formatHour(hours[0])
      : hours.map(formatHour).join(", ");
  const daysStr = formatDaysOfWeek(daysOfWeek);

  return `Runs at ${hoursStr} on ${daysStr}`;
}

interface AdvancedSchedulerProps {
  value: string | null;
  onChange: (cron: string | null) => void;
  disabled?: boolean;
}

export function AdvancedScheduler({
  value,
  onChange,
  disabled,
}: AdvancedSchedulerProps) {
  const [config, setConfig] = useState<ScheduleConfig>(() =>
    parseCronToConfig(value),
  );

  function updateConfig(newConfig: ScheduleConfig): void {
    setConfig(newConfig);
    onChange(configToCron(newConfig));
  }

  function updateCustom(
    fields: Partial<NonNullable<ScheduleConfig["custom"]>>,
  ): void {
    if (!config.custom) return;
    updateConfig({
      ...config,
      custom: { ...config.custom, ...fields },
    });
  }

  function handlePresetChange(preset: string): void {
    if (preset === "custom") {
      updateConfig({
        mode: "custom",
        custom: { hours: [9], daysOfWeek: [1, 2, 3, 4, 5] },
      });
    } else {
      updateConfig({ mode: "preset", preset: preset as PresetType });
    }
  }

  function handleAddHour(hour: string): void {
    if (!config.custom) return;
    const hourNum = parseInt(hour, 10);
    if (config.custom.hours.includes(hourNum)) return;
    updateCustom({
      hours: [...config.custom.hours, hourNum].sort((a, b) => a - b),
    });
  }

  function handleRemoveHour(hour: number): void {
    updateCustom({
      hours: config.custom?.hours.filter((h) => h !== hour) ?? [],
    });
  }

  function handleToggleDay(day: number): void {
    if (!config.custom) return;
    const { daysOfWeek } = config.custom;
    updateCustom({
      daysOfWeek: daysOfWeek.includes(day)
        ? daysOfWeek.filter((d) => d !== day)
        : [...daysOfWeek, day],
    });
  }

  function handleSetAllDays(): void {
    if (!config.custom) return;
    const allSelected = config.custom.daysOfWeek.length === 7;
    updateCustom({ daysOfWeek: allSelected ? [] : [0, 1, 2, 3, 4, 5, 6] });
  }

  function handleSetWeekdays(): void {
    updateCustom({ daysOfWeek: [1, 2, 3, 4, 5] });
  }

  const currentValue =
    config.mode === "preset" ? (config.preset ?? "manual") : "custom";
  const availableHours = HOURS.filter((h) => !config.custom?.hours.includes(h));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Schedule</Label>
        <Select
          value={currentValue}
          onValueChange={handlePresetChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select schedule" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
            <SelectItem value="custom">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <div>
                  <div className="font-medium">Custom</div>
                  <div className="text-xs text-muted-foreground">
                    Set specific hours and days
                  </div>
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.mode === "custom" && config.custom && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Run at hours</Label>
            <div className="flex items-center gap-2">
              <Select
                value=""
                onValueChange={handleAddHour}
                disabled={disabled || availableHours.length === 0}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Add hour" />
                </SelectTrigger>
                <SelectContent>
                  {availableHours.map((hour) => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {formatHour(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config.custom.hours.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {config.custom.hours.map((hour) => (
                  <Badge key={hour} variant="secondary" className="gap-1 pr-1">
                    {formatHour(hour)}
                    <button
                      onClick={() => handleRemoveHour(hour)}
                      disabled={disabled}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">On days</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSetWeekdays}
                  disabled={disabled}
                  className="text-xs h-6 px-2"
                >
                  Weekdays
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSetAllDays}
                  disabled={disabled}
                  className="text-xs h-6 px-2"
                >
                  {config.custom.daysOfWeek.length === 7
                    ? "Clear all"
                    : "Every day"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = config.custom!.daysOfWeek.includes(
                  day.value,
                );
                return (
                  <Button
                    key={day.value}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleDay(day.value)}
                    disabled={disabled}
                    className="w-10 h-8 text-xs"
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {getSchedulePreview(config)}
      </p>
    </div>
  );
}

export { configToCron, parseCronToConfig };
