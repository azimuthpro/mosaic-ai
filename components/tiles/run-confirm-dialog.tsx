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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RunConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tileName: string;
  isRunning: boolean;
  onConfirm: (debug: boolean, options?: { comment?: string }) => void;
  /** When set, shows a comment textarea (used by offer_sender tiles). */
  commentMode?: "offer";
}

export function RunConfirmDialog({
  open,
  onOpenChange,
  tileName,
  isRunning,
  onConfirm,
  commentMode,
}: RunConfirmDialogProps) {
  const [runMode, setRunMode] = useState<"normal" | "debug">("normal");
  const [comment, setComment] = useState("");

  const isOffer = commentMode === "offer";
  const canSubmit = !isOffer || comment.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Run tile</DialogTitle>
          <DialogDescription>
            {isOffer
              ? `Tell the AI who to send the offer to and any tweaks to the template. The result will be a draft you can review before sending.`
              : `Are you sure you want to run "${tileName}"? This will execute the tile and consume API credits.`}
          </DialogDescription>
        </DialogHeader>
        {isOffer && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="offer-run-comment">Instruction</Label>
            <Textarea
              id="offer-run-comment"
              rows={4}
              placeholder="e.g. Send to anna@example.com — mention 20% Black Friday discount, sign as Mateusz"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isRunning}
            />
          </div>
        )}
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
              onConfirm(runMode === "debug", isOffer ? { comment } : undefined);
              setComment("");
            }}
            disabled={isRunning || !canSubmit}
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
