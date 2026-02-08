"use client";

import { Globe } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONE_GROUPS = {
  "North America": [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time" },
    { value: "Pacific/Honolulu", label: "Hawaii Time" },
    { value: "America/Toronto", label: "Toronto" },
    { value: "America/Vancouver", label: "Vancouver" },
    { value: "America/Mexico_City", label: "Mexico City" },
  ],
  Europe: [
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
    { value: "Europe/Madrid", label: "Madrid (CET)" },
    { value: "Europe/Rome", label: "Rome (CET)" },
    { value: "Europe/Zurich", label: "Zurich (CET)" },
    { value: "Europe/Stockholm", label: "Stockholm (CET)" },
    { value: "Europe/Warsaw", label: "Warsaw (CET)" },
    { value: "Europe/Moscow", label: "Moscow (MSK)" },
  ],
  "Asia Pacific": [
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Asia/Seoul", label: "Seoul (KST)" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
    { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
    { value: "Pacific/Auckland", label: "Auckland (NZST)" },
  ],
  "South America": [
    { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
    { value: "America/Santiago", label: "Santiago (CLT)" },
    { value: "America/Lima", label: "Lima (PET)" },
    { value: "America/Bogota", label: "Bogotá (COT)" },
  ],
  Africa: [
    { value: "Africa/Cairo", label: "Cairo (EET)" },
    { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
    { value: "Africa/Lagos", label: "Lagos (WAT)" },
    { value: "Africa/Nairobi", label: "Nairobi (EAT)" },
  ],
};

const ALL_TIMEZONES = Object.entries(TIMEZONE_GROUPS).flatMap(
  ([region, zones]) => zones.map((z) => ({ ...z, region })),
);

function getCurrentOffset(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

function getCurrentTime(timezone: string): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function TimezoneItem({
  tz,
}: {
  tz: { value: string; label: string };
}): React.ReactNode {
  return (
    <SelectItem key={tz.value} value={tz.value}>
      <div className="flex items-center justify-between w-full gap-4">
        <span>{tz.label}</span>
        <span className="text-xs text-muted-foreground">
          {getCurrentOffset(tz.value)}
        </span>
      </div>
    </SelectItem>
  );
}

function TimezoneList({
  filteredTimezones,
}: {
  filteredTimezones: typeof ALL_TIMEZONES | null;
}): React.ReactNode {
  if (filteredTimezones && filteredTimezones.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No timezones found
      </div>
    );
  }

  if (filteredTimezones) {
    return filteredTimezones.map((tz) => (
      <TimezoneItem key={tz.value} tz={tz} />
    ));
  }

  return Object.entries(TIMEZONE_GROUPS).map(([region, zones]) => (
    <div key={region}>
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground sticky top-12 bg-popover">
        {region}
      </div>
      {zones.map((tz) => (
        <TimezoneItem key={tz.value} tz={tz} />
      ))}
    </div>
  ));
}

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
}

export function TimezoneSelector({
  value,
  onChange,
  disabled,
}: TimezoneSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredTimezones = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase();
    return ALL_TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(query) ||
        tz.value.toLowerCase().includes(query) ||
        tz.region.toLowerCase().includes(query),
    );
  }, [search]);

  const selectedTimezone = ALL_TIMEZONES.find((tz) => tz.value === value);
  const currentOffset = value ? getCurrentOffset(value) : "";
  const currentTime = value ? getCurrentTime(value) : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="timezone" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Timezone
        </Label>
        {value && currentTime && (
          <span className="text-xs text-muted-foreground">
            Current time: {currentTime} ({currentOffset})
          </span>
        )}
      </div>

      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="timezone">
          <SelectValue placeholder="Select timezone">
            {selectedTimezone ? (
              <span>{selectedTimezone.label}</span>
            ) : (
              <span className="text-muted-foreground">Select timezone</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <div className="sticky top-0 bg-popover p-2 border-b">
            <Input
              placeholder="Search timezones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>

          <TimezoneList filteredTimezones={filteredTimezones} />
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const userTimezone =
              Intl.DateTimeFormat().resolvedOptions().timeZone;
            onChange(userTimezone);
          }}
          disabled={disabled}
          className="text-xs"
        >
          Use my timezone
        </Button>
        <span className="text-xs text-muted-foreground">
          ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Tile schedules will run according to this timezone.
      </p>
    </div>
  );
}

export function getDefaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
