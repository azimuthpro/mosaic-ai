"use client";

import { Calendar, Clock, Hand, Timer } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TriggerOption = "manual" | "hourly" | "daily" | "weekly";

interface TriggerSelectorProps {
  value: TriggerOption;
  onChange: (value: TriggerOption) => void;
  disabled?: boolean;
}

export const TRIGGER_OPTIONS: {
  value: TriggerOption;
  label: string;
  description: string;
  cron: string | null;
  icon: typeof Clock;
}[] = [
  {
    value: "manual",
    label: "Manual",
    description: "Run only when triggered manually",
    cron: null,
    icon: Hand,
  },
  {
    value: "hourly",
    label: "Hourly",
    description: "Run every hour",
    cron: "0 * * * *",
    icon: Timer,
  },
  {
    value: "daily",
    label: "Daily",
    description: "Run daily at 9 AM",
    cron: "0 9 * * *",
    icon: Clock,
  },
  {
    value: "weekly",
    label: "Weekly",
    description: "Run every Monday at 9 AM",
    cron: "0 9 * * 1",
    icon: Calendar,
  },
];

export function getTriggerCron(trigger: TriggerOption): string | null {
  const option = TRIGGER_OPTIONS.find((t) => t.value === trigger);
  return option?.cron ?? null;
}

export function getTriggerFromCron(cron: string | null): TriggerOption {
  if (!cron) return "manual";
  const option = TRIGGER_OPTIONS.find((t) => t.cron === cron);
  return option?.value ?? "manual";
}

export function TriggerSelector({
  value,
  onChange,
  disabled,
}: TriggerSelectorProps) {
  const selectedOption = TRIGGER_OPTIONS.find((t) => t.value === value);

  return (
    <div className="space-y-2">
      <Label>Schedule</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as TriggerOption)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select schedule">
            {selectedOption && (
              <div className="flex items-center gap-2">
                <selectedOption.icon className="h-4 w-4" />
                {selectedOption.label}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TRIGGER_OPTIONS.map((option) => (
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
        </SelectContent>
      </Select>
    </div>
  );
}
