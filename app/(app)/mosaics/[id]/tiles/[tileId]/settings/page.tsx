"use client";

import { ArrowLeft, Loader2, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MemberList } from "@/components/mosaic/member-list";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getCurrentUserId,
  getMosaicMembers,
  getMosaicOwner,
  getUserMosaicRole,
} from "@/lib/actions/mosaics";
import {
  deleteTile,
  getTile,
  type TileWithConnections,
  toggleTileActive,
  updateTile,
} from "@/lib/actions/tiles";
import type { MemberRole, MosaicMember } from "@/types/database";

interface MemberWithUser extends MosaicMember {
  user: { email: string; full_name: string | null };
}

interface OwnerInfo {
  id: string;
  email: string;
  full_name: string | null;
}

const SCHEDULE_OPTIONS = [
  { value: "none", label: "No schedule (manual only)" },
  { value: "0 9 * * *", label: "Daily at 9 AM" },
  { value: "0 9 * * 1", label: "Weekly on Monday at 9 AM" },
  { value: "0 9 1 * *", label: "Monthly on the 1st at 9 AM" },
];

export default function TileSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const mosaicId = params.id as string;
  const tileId = params.tileId as string;

  const [tile, setTile] = useState<TileWithConnections | null>(null);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [userRole, setUserRole] = useState<MemberRole | "owner" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canManageMembers = userRole === "owner" || userRole === "admin";

  async function loadData() {
    const [tileData, ownerData, userId, membersData, role] =
      await Promise.all([
        getTile(tileId),
        getMosaicOwner(mosaicId),
        getCurrentUserId(),
        getMosaicMembers(mosaicId),
        getUserMosaicRole(mosaicId),
      ]);
    setTile(tileData);
    setOwner(ownerData);
    setCurrentUserId(userId);
    setMembers(membersData);
    setUserRole(role);
    setIsLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileId, mosaicId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const systemPrompt = formData.get("systemPrompt") as string;
    const scheduleCronRaw = formData.get("scheduleCron") as string;
    const scheduleCron = scheduleCronRaw === "none" ? null : scheduleCronRaw;
    const isActive = formData.get("isActive") === "true";

    const result = await updateTile(tileId, {
      name,
      description: description || undefined,
      systemPrompt: systemPrompt || undefined,
      scheduleCron: scheduleCron || undefined,
    });

    if (result.error) {
      setError(result.error);
      setIsSaving(false);
      return;
    }

    // Update is_active separately if needed
    if (tile && tile.is_active !== isActive) {
      await toggleTileActive(tileId);
    }

    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setIsSaving(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this tile? All data will be permanently lost.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    const result = await deleteTile(tileId);
    if (result.error) {
      setError(result.error);
      setIsDeleting(false);
    } else {
      router.push(`/mosaics/${mosaicId}`);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tile) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Tile not found</p>
        <Link href={`/mosaics/${mosaicId}`}>
          <Button variant="link" className="mt-4">
            Back to Mosaic
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 p-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href={`/mosaics/${mosaicId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Tile Settings</h1>
          <p className="text-muted-foreground">Configure your tile</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic tile configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                Settings saved successfully
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={tile.name}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={tile.description || ""}
                rows={2}
                disabled={isSaving}
                placeholder="Optional description for this tile"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">Instructions</Label>
              <Textarea
                id="systemPrompt"
                name="systemPrompt"
                defaultValue={tile.system_prompt || ""}
                rows={4}
                disabled={isSaving}
                placeholder="Tell the AI how to analyze and process the content..."
              />
              <p className="text-xs text-muted-foreground">
                These instructions guide the AI when processing data from this
                tile&apos;s sources.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduleCron">Schedule</Label>
              <Select
                name="scheduleCron"
                defaultValue={tile.schedule_cron || "none"}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a schedule" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Disable to pause scheduled executions
                </p>
              </div>
              <Switch
                id="isActive"
                name="isActive"
                defaultChecked={tile.is_active}
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

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members
            </CardTitle>
            <CardDescription>
              People who have access to this mosaic
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <MemberList
            owner={owner}
            currentUserId={currentUserId}
            members={members}
            canManageMembers={canManageMembers}
            onMemberChange={loadData}
          />
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently delete this tile</CardDescription>
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
            Delete Tile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
