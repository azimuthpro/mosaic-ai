"use client";

import { ChevronDown, Power } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { PluginBadgeInfo, SectionType } from "../types";
import { SECTION_COLORS } from "../types";

interface PluginCardProps {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  section: SectionType;
  children: ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  badge?: PluginBadgeInfo;
  toggleEnabled?: boolean;
  isEnabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  disabled?: boolean;
}

const ACCENT_COLORS: Record<SectionType, string> = {
  input: "bg-cyan-500",
  processing: "bg-purple-500",
  output: "bg-green-500",
  status: "bg-amber-500",
};

const ACCENT_HOVER_COLORS: Record<SectionType, string> = {
  input: "group-hover:bg-cyan-400",
  processing: "group-hover:bg-purple-400",
  output: "group-hover:bg-green-400",
  status: "group-hover:bg-amber-400",
};

export function PluginCard({
  id,
  title,
  description,
  icon,
  section,
  children,
  collapsed = false,
  onCollapsedChange,
  badge,
  toggleEnabled,
  isEnabled = true,
  onToggleEnabled,
  disabled = false,
}: PluginCardProps) {
  const accentColor = ACCENT_COLORS[section];
  const accentHover = ACCENT_HOVER_COLORS[section];

  return (
    <Collapsible
      open={!collapsed}
      onOpenChange={(open) => onCollapsedChange?.(!open)}
    >
      <div
        className={cn(
          "group relative rounded-lg border border-border bg-muted/20 overflow-hidden transition-colors",
          !collapsed && "bg-muted/30",
        )}
      >
        {/* Left accent bar */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 transition-colors",
            accentColor,
            accentHover,
          )}
        />

        {/* Header */}
        <div
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
            !disabled && "hover:bg-muted/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <CollapsibleTrigger asChild disabled={disabled}>
            <button className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{title}</span>
                  {badge && (
                    <Badge
                      variant={badge.variant || "secondary"}
                      className="text-xs shrink-0"
                    >
                      {badge.text}
                    </Badge>
                  )}
                </div>
                {description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {description}
                  </p>
                )}
              </div>
            </button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-2 shrink-0">
            {toggleEnabled && (
              <div className="flex items-center gap-1">
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                <Switch
                  checked={isEnabled}
                  onCheckedChange={onToggleEnabled}
                  disabled={disabled}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            )}
            <CollapsibleTrigger asChild disabled={disabled}>
              <button className="p-1 -m-1">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    !collapsed && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="border-t border-border px-4 py-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
