"use client";

import { Loader2, Mail, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteToMosaic } from "@/lib/actions/mosaics";
import type { MemberRole } from "@/types/database";

interface InviteMemberDialogProps {
  mosaicId: string;
  onInviteSent?: () => void;
}

export function InviteMemberDialog({
  mosaicId,
  onInviteSent,
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<MemberRole, "owner">>("member");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    invited: boolean;
    email: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const result = await inviteToMosaic(mosaicId, email, role);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setSuccess({ invited: result.invited ?? false, email });
    setEmail("");
    setRole("member");
    setIsLoading(false);
    onInviteSent?.();

    // Close dialog after showing success message briefly
    setTimeout(() => {
      setOpen(false);
      setSuccess(null);
    }, 2000);
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (!newOpen) {
      setEmail("");
      setRole("member");
      setError(null);
      setSuccess(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Invite someone to collaborate on this mosaic. They will receive an
            email invitation.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Mail className="h-5 w-5" />
              <p className="font-medium">
                {success.invited
                  ? `Invitation sent to ${success.email}`
                  : `${success.email} has been added to the mosaic`}
              </p>
            </div>
            {success.invited && (
              <p className="mt-1 text-sm text-green-600 dark:text-green-300">
                They will receive an email with a link to join.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) =>
                    setRole(value as Exclude<MemberRole, "owner">)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">
                      <div className="flex flex-col">
                        <span>Member</span>
                        <span className="text-xs text-muted-foreground">
                          Can view tiles and reports
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col">
                        <span>Admin</span>
                        <span className="text-xs text-muted-foreground">
                          Can manage tiles and settings
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
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
              <Button type="submit" disabled={isLoading || !email}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
