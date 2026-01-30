"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteMosaic, getMosaic, updateMosaic } from "@/lib/actions/mosaics";
import type { MosaicWithTiles } from "@/types/database";

export default function MosaicSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const mosaicId = params.id as string;

  const [mosaic, setMosaic] = useState<MosaicWithTiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMosaic() {
      const data = await getMosaic(mosaicId);
      setMosaic(data);
      setIsLoading(false);
    }
    loadMosaic();
  }, [mosaicId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateMosaic(mosaicId, formData);

    if (result.error) {
      setError(result.error);
    }
    setIsSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this mosaic? All tiles and data will be permanently lost.")) {
      return;
    }
    setIsDeleting(true);
    await deleteMosaic(mosaicId);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!mosaic) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Mosaic not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Mosaic Settings</h1>
        <p className="text-muted-foreground">Manage your mosaic configuration</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic mosaic information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                defaultValue={mosaic.name}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={mosaic.description || ""}
                rows={3}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Disable to pause all tile executions
                </p>
              </div>
              <Switch
                id="isActive"
                name="isActive"
                defaultChecked={mosaic.is_active}
                value="true"
                disabled={isSaving}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Separator />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this mosaic and all its tiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete Mosaic
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
