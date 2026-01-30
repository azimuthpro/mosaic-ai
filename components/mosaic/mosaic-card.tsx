"use client";

import { Grid3X3, MoreHorizontal, Settings, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteMosaic } from "@/lib/actions/mosaics";
import type { MosaicWithStats } from "@/types/database";

interface MosaicCardProps {
  mosaic: MosaicWithStats;
}

export function MosaicCard({ mosaic }: MosaicCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this mosaic? All tiles and data will be lost.")) {
      return;
    }
    setIsDeleting(true);
    await deleteMosaic(mosaic.id);
  };

  return (
    <Card className="group relative hover:shadow-md transition-shadow">
      <Link href={`/mosaics/${mosaic.id}`} className="absolute inset-0 z-0" />

      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
            {mosaic.name}
          </CardTitle>
          {mosaic.description && (
            <CardDescription className="line-clamp-2">
              {mosaic.description}
            </CardDescription>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/mosaics/${mosaic.id}/settings`} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive cursor-pointer"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Grid3X3 className="h-4 w-4" />
            <span>{mosaic.tile_count} tiles</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{mosaic.member_count} members</span>
          </div>
        </div>

        {/* Tile preview - show first few tile colors */}
        {mosaic.tiles && mosaic.tiles.length > 0 && (
          <div className="flex gap-1 mt-3">
            {mosaic.tiles.slice(0, 6).map((tile) => (
              <div
                key={tile.id}
                className="h-6 w-6 rounded"
                style={{ backgroundColor: tile.color }}
                title={tile.name}
              />
            ))}
            {mosaic.tiles.length > 6 && (
              <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{mosaic.tiles.length - 6}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
