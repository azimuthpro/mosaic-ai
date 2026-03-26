"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { createMosaic } from "@/lib/actions/mosaics";

interface CreateMosaicDialogProps {
  trigger?: React.ReactNode;
  variant?: "default" | "compact";
}

export function CreateMosaicDialog({
  trigger,
  variant = "default",
}: CreateMosaicDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createMosaic(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    } else if (result?.mosaicId) {
      setOpen(false);
      router.push(`/mosaics/${result.mosaicId}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ||
          (variant === "compact" ? (
            <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus className="h-4 w-4" />
              New
            </button>
          ) : (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Mosaic
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Mosaic</DialogTitle>
          <DialogDescription>
            A mosaic is a workspace that contains your tiles. You can share
            mosaics with your team.
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
                placeholder="My Intelligence Mosaic"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Mosaic
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
