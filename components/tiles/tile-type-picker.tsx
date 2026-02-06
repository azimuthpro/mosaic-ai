"use client";

import { Brain, Globe, Search } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TILE_TYPE_CONFIGS, type TileType } from "@/types/database";

interface TileTypePickerProps {
  onSelect: (type: TileType) => void;
  disabled?: boolean;
}

const TILE_ICONS = {
  url_reader: Globe,
  web_search: Search,
  analyzer: Brain,
};

export function TileTypePicker({ onSelect, disabled }: TileTypePickerProps) {
  const tileTypes = Object.values(TILE_TYPE_CONFIGS);

  return (
    <div className="grid grid-cols-3 gap-4">
      {tileTypes.map((config) => {
        const Icon = TILE_ICONS[config.type];
        return (
          <Card
            key={config.type}
            className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${
              disabled ? "opacity-50 pointer-events-none" : ""
            }`}
            onClick={() => onSelect(config.type)}
          >
            <CardHeader className="space-y-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <Icon className="h-5 w-5" style={{ color: config.color }} />
              </div>
              <CardTitle className="text-base">{config.label}</CardTitle>
              <CardDescription className="text-sm">
                {config.description}
              </CardDescription>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
