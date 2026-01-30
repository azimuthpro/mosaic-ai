"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { TileTypePicker } from "@/components/tiles/tile-type-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTile } from "@/lib/actions/tiles";
import { TILE_TYPE_CONFIGS, type TileType } from "@/types/database";

interface CreateTileDialogProps {
  mosaicId: string;
}

type Step = "type" | "details";

export function CreateTileDialog({ mosaicId }: CreateTileDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<TileType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep("type");
    setSelectedType(null);
    setError(null);
  };

  const handleTypeSelect = (type: TileType) => {
    setSelectedType(type);
    setStep("details");
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedType) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const systemPrompt = formData.get("systemPrompt") as string;

    const config = TILE_TYPE_CONFIGS[selectedType];

    const result = await createTile({
      mosaicId,
      name,
      description,
      tileType: selectedType,
      color: config.color,
      pattern: config.pattern,
      systemPrompt,
    });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setOpen(false);
      resetState();
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Tile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {step === "type" ? (
          <>
            <DialogHeader>
              <DialogTitle>Choose Tile Type</DialogTitle>
              <DialogDescription>
                Select what kind of intelligence gathering this tile will perform.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <TileTypePicker onSelect={handleTypeSelect} />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Configure {selectedType && TILE_TYPE_CONFIGS[selectedType].label}
              </DialogTitle>
              <DialogDescription>
                Set up your tile with a name and instructions.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Market News Tracker"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Monitors financial news sources"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">Instructions</Label>
                  <Textarea
                    id="systemPrompt"
                    name="systemPrompt"
                    placeholder="Analyze the content and extract key market insights..."
                    rows={4}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tell the AI how to process the data from your sources.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("type")}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Tile
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
