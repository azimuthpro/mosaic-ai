"use client";

import { Crown, Loader2, Shield, Trash2, User, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AgentMemberWithUser,
  inviteUserToAgent,
  removeAgentMember,
  updateMemberRole,
} from "@/lib/actions/members";
import type { MemberRole } from "@/types/database";

interface AgentMembersProps {
  agentId: string;
  members: AgentMemberWithUser[];
  ownerEmail: string;
  userRole: MemberRole;
}

export function AgentMembers({
  agentId,
  members,
  ownerEmail,
  userRole,
}: AgentMembersProps) {
  const router = useRouter();
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isOwner = userRole === "owner";

  async function handleInvite() {
    if (!inviteEmail.trim()) return;

    setIsLoading(true);
    setError(null);

    const result = await inviteUserToAgent(
      agentId,
      inviteEmail.trim(),
      inviteRole,
    );

    if (result.error) {
      setError(result.error);
    } else {
      setInviteEmail("");
      setInviteRole("member");
      setIsInviting(false);
      router.refresh();
    }

    setIsLoading(false);
  }

  async function handleRemove(memberId: string) {
    setRemovingId(memberId);
    await removeAgentMember(agentId, memberId);
    router.refresh();
    setRemovingId(null);
  }

  async function handleRoleChange(
    memberId: string,
    newRole: "admin" | "member",
  ) {
    setUpdatingId(memberId);
    await updateMemberRole(agentId, memberId, newRole);
    router.refresh();
    setUpdatingId(null);
  }

  function getRoleBadge(role: MemberRole) {
    switch (role) {
      case "owner":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Crown className="h-3 w-3" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Member
          </Badge>
        );
    }
  }

  function getInitials(name: string | null, email: string): string {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            People who have access to this agent
          </CardDescription>
        </div>
        {isOwner && !isInviting && (
          <Button size="sm" onClick={() => setIsInviting(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isInviting && (
          <div className="mb-4 space-y-3 rounded-lg border p-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <div className="flex gap-2">
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as "admin" | "member")}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleInvite}
                disabled={isLoading || !inviteEmail.trim()}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsInviting(false);
                  setError(null);
                  setInviteEmail("");
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Member:</strong> Can view agent and reports.{" "}
              <strong>Admin:</strong> Can also edit settings and run the agent.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {/* Owner */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>
                  {ownerEmail.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{ownerEmail}</p>
                <p className="text-xs text-muted-foreground">Agent owner</p>
              </div>
            </div>
            {getRoleBadge("owner")}
          </div>

          {/* Members */}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={member.user.avatar_url || undefined} />
                  <AvatarFallback>
                    {getInitials(member.user.full_name, member.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {member.user.full_name || member.user.email}
                  </p>
                  {member.user.full_name && (
                    <p className="text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        handleRoleChange(member.id, v as "admin" | "member")
                      }
                      disabled={updatingId === member.id}
                    >
                      <SelectTrigger className="w-28">
                        {updatingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(member.id)}
                      disabled={removingId === member.id}
                    >
                      {removingId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </>
                ) : (
                  getRoleBadge(member.role)
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No team members yet. {isOwner && "Invite someone to collaborate!"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
