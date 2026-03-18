"use client";

import { Bug, Loader2, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RunConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tileName: string;
  isRunning: boolean;
  onConfirm: (debug: boolean) => void;
}

export function RunConfirmDialog({
  open,
  onOpenChange,
  tileName,
  isRunning,
  onConfirm,
}: RunConfirmDialogProps) {
  const [runMode, setRunMode] = useState<"normal" | "debug">("normal");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Run tile</DialogTitle>
          <DialogDescription>
            Are you sure you want to run &ldquo;{tileName}&rdquo;? This will
            execute the tile and consume API credits.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setRunMode("normal")}
            className={cn(
              "flex-1",
              runMode === "normal" &&
                "border-amber-500 bg-amber-500/10 text-amber-400",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            Normal
          </Button>
          <Button
            variant="outline"
            onClick={() => setRunMode("debug")}
            className={cn(
              "flex-1",
              runMode === "debug" &&
                "border-purple-500 bg-purple-500/10 text-purple-400",
            )}
          >
            <Bug className="h-3.5 w-3.5" />
            Debug
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isRunning}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onConfirm(runMode === "debug");
            }}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
