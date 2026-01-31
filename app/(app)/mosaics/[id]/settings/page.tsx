"use client";

import { Loader2, Trash2, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InviteMemberDialog } from "@/components/mosaic/invite-member-dialog";
import { MemberList } from "@/components/mosaic/member-list";
import { PendingInvitations } from "@/components/mosaic/pending-invitations";
import {
  getDefaultTimezone,
  TimezoneSelector,
} from "@/components/mosaic/timezone-selector";
import { TransferOwnershipDialog } from "@/components/mosaic/transfer-ownership-dialog";
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
import {
  deleteMosaic,
  getMosaic,
  getMosaicAdmins,
  getMosaicInvitations,
  getMosaicMembers,
  getMosaicOwner,
  getUserMosaicRole,
  updateMosaic,
} from "@/lib/actions/mosaics";
import type {
  MemberRole,
  MosaicInvitation,
  MosaicMember,
  MosaicSettings,
  MosaicWithTiles,
} from "@/types/database";

interface MemberWithUser extends MosaicMember {
  user: { email: string; full_name: string | null };
}

interface AdminWithUser extends MosaicMember {
  user: { id: string; email: string; full_name: string | null };
}

interface OwnerInfo {
  id: string;
  email: string;
  full_name: string | null;
}

export default function MosaicSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const mosaicId = params.id as string;

  const [mosaic, setMosaic] = useState<MosaicWithTiles | null>(null);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [invitations, setInvitations] = useState<MosaicInvitation[]>([]);
  const [admins, setAdmins] = useState<AdminWithUser[]>([]);
  const [userRole, setUserRole] = useState<MemberRole | "owner" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>(getDefaultTimezone());

  const isOwner = userRole === "owner";

  async function loadData() {
    const [
      mosaicData,
      ownerData,
      membersData,
      invitationsData,
      adminsData,
      role,
    ] = await Promise.all([
      getMosaic(mosaicId),
      getMosaicOwner(mosaicId),
      getMosaicMembers(mosaicId),
      getMosaicInvitations(mosaicId),
      getMosaicAdmins(mosaicId),
      getUserMosaicRole(mosaicId),
    ]);

    setMosaic(mosaicData);
    setOwner(ownerData);
    setMembers(membersData);
    setInvitations(invitationsData);
    setAdmins(adminsData);
    setUserRole(role);
    // Set timezone from mosaic settings
    if (mosaicData) {
      const settings = mosaicData.settings as MosaicSettings | null;
      setTimezone(settings?.timezone || getDefaultTimezone());
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosaicId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("timezone", timezone);
    const result = await updateMosaic(mosaicId, formData);

    if (result.error) {
      setError(result.error);
    }
    setIsSaving(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this mosaic? All tiles and data will be permanently lost.",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    await deleteMosaic(mosaicId);
  }

  function handleMemberChange() {
    loadData();
  }

  function handleOwnershipTransferred() {
    router.push("/mosaics");
    router.refresh();
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
        <p className="text-muted-foreground">
          Manage your mosaic configuration
        </p>
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
                disabled={isSaving || !isOwner}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={mosaic.description || ""}
                rows={3}
                disabled={isSaving || !isOwner}
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
                disabled={isSaving || !isOwner}
              />
            </div>

            <Separator />

            <TimezoneSelector
              value={timezone}
              onChange={setTimezone}
              disabled={isSaving || !isOwner}
            />

            {isOwner && (
              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      <Separator />

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
              <CardDescription>
                People who have access to this mosaic
              </CardDescription>
            </div>
            {isOwner && (
              <InviteMemberDialog
                mosaicId={mosaicId}
                onInviteSent={handleMemberChange}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {owner && (
            <MemberList
              owner={owner}
              members={members}
              isOwner={isOwner}
              onMemberChange={handleMemberChange}
            />
          )}

          {isOwner && invitations.length > 0 && (
            <>
              <Separator />
              <PendingInvitations
                invitations={invitations}
                onInvitationCancelled={handleMemberChange}
              />
            </>
          )}

          {isOwner && admins.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Transfer Ownership</h4>
                  <p className="text-sm text-muted-foreground">
                    Transfer this mosaic to an admin
                  </p>
                </div>
                <TransferOwnershipDialog
                  mosaicId={mosaicId}
                  mosaicName={mosaic.name}
                  admins={admins}
                  onTransferred={handleOwnershipTransferred}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <>
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
        </>
      )}
    </div>
  );
}
