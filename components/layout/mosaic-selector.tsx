"use client";

import { ChevronDown, Grid3X3 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Mosaic {
  id: string;
  name: string;
}

interface MosaicSelectorProps {
  mosaics: Mosaic[];
}

export function MosaicSelector({ mosaics }: MosaicSelectorProps) {
  const params = useParams();
  const currentMosaicId = params?.id as string | undefined;

  const currentMosaic = currentMosaicId
    ? mosaics.find((m) => m.id === currentMosaicId)
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <Grid3X3 className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {currentMosaic?.name || "Select Mosaic"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Your Mosaics</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mosaics.length === 0 ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">No mosaics yet</span>
          </DropdownMenuItem>
        ) : (
          mosaics.map((mosaic) => (
            <DropdownMenuItem
              key={mosaic.id}
              asChild
              className={currentMosaicId === mosaic.id ? "bg-accent" : ""}
            >
              <Link href={`/mosaics/${mosaic.id}`}>
                <Grid3X3 className="mr-2 h-4 w-4" />
                <span className="truncate">{mosaic.name}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/mosaics" className="cursor-pointer">
            View all mosaics
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
