"use client";

import { Clock, Mail, Shield, User, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelMosaicInvitation } from "@/lib/actions/mosaics";
import type { MosaicInvitation } from "@/types/database";

interface PendingInvitationsProps {
  invitations: MosaicInvitation[];
  onInvitationCancelled?: () => void;
}

export function PendingInvitations({
  invitations,
  onInvitationCancelled,
}: PendingInvitationsProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleCancel(invitationId: string) {
    if (!confirm("Are you sure you want to cancel this invitation?")) {
      return;
    }

    setCancellingId(invitationId);
    await cancelMosaicInvitation(invitationId);
    setCancellingId(null);
    onInvitationCancelled?.();
  }

  function formatExpiryDate(expiresAt: string): string {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "Expired";
    } else if (diffDays === 1) {
      return "Expires tomorrow";
    } else {
      return `Expires in ${diffDays} days`;
    }
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Pending Invitations
      </h4>
      <div className="space-y-2">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between rounded-lg border border-dashed p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{invitation.email}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatExpiryDate(invitation.expires_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                {invitation.role === "admin" ? (
                  <>
                    <Shield className="h-3 w-3" />
                    Admin
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    Member
                  </>
                )}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleCancel(invitation.id)}
                disabled={cancellingId === invitation.id}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cancel invitation</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
