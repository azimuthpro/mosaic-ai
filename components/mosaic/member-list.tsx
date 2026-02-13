"use client";

import { Crown, MoreHorizontal, Shield, User, UserMinus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  removeMosaicMember,
  updateMosaicMemberRole,
} from "@/lib/actions/mosaics";
import type { MemberRole, MosaicMember } from "@/types/database";

interface MemberWithUser extends MosaicMember {
  user: { email: string; full_name: string | null };
}

interface OwnerInfo {
  id: string;
  email: string;
  full_name: string | null;
}

interface MemberListProps {
  owner?: OwnerInfo | null;
  currentUserId?: string | null;
  members: MemberWithUser[];
  canManageMembers: boolean;
  onMemberChange?: () => void;
}

export function MemberList({
  owner,
  currentUserId,
  members,
  canManageMembers,
  onMemberChange,
}: MemberListProps) {
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);

  async function handleRoleChange(
    memberId: string,
    newRole: Exclude<MemberRole, "owner">,
  ) {
    setLoadingMemberId(memberId);
    await updateMosaicMemberRole(memberId, newRole);
    setLoadingMemberId(null);
    onMemberChange?.();
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this member?")) {
      return;
    }
    setLoadingMemberId(memberId);
    await removeMosaicMember(memberId);
    setLoadingMemberId(null);
    onMemberChange?.();
  }

  function getRoleBadge(role: MemberRole | "owner") {
    switch (role) {
      case "owner":
        return (
          <Badge variant="default" className="gap-1">
            <Crown className="h-3 w-3" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge variant="secondary" className="gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      case "member":
        return (
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" />
            Member
          </Badge>
        );
    }
  }

  return (
    <div className="space-y-2">
      {/* Owner */}
      {owner && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Crown className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">
                {owner.full_name || owner.email}
                {currentUserId === owner.id && (
                  <span className="ml-1 text-muted-foreground">(you)</span>
                )}
              </p>
              {owner.full_name && (
                <p className="text-sm text-muted-foreground">{owner.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">{getRoleBadge("owner")}</div>
        </div>
      )}

      {/* Members */}
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {member.role === "admin" ? (
                <Shield className="h-5 w-5 text-muted-foreground" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {member.user.full_name || member.user.email}
                {currentUserId === member.user_id && (
                  <span className="ml-1 text-muted-foreground">(you)</span>
                )}
              </p>
              {member.user.full_name && (
                <p className="text-sm text-muted-foreground">
                  {member.user.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getRoleBadge(member.role)}
            {canManageMembers && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={loadingMemberId === member.id}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {member.role === "member" ? (
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, "admin")}
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Make Admin
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => handleRoleChange(member.id, "member")}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Make Member
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      ))}

      {members.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No members yet. Invite someone to collaborate!
        </p>
      )}
    </div>
  );
}
