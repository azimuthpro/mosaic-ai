"use client";

import { Check, Clock, Shield, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acceptMosaicInvitation,
  declineMosaicInvitation,
  type PendingInvitation,
} from "@/lib/actions/mosaics";

interface UserPendingInvitationsProps {
  invitations: PendingInvitation[];
}

export function UserPendingInvitations({
  invitations,
}: UserPendingInvitationsProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState<{
    id: string;
    action: "accept" | "decline";
  } | null>(null);

  async function handleAccept(invitation: PendingInvitation): Promise<void> {
    setProcessing({ id: invitation.id, action: "accept" });

    const result = await acceptMosaicInvitation(invitation.token);

    if (result.mosaicId) {
      router.push(`/mosaics/${result.mosaicId}`);
    } else {
      router.refresh();
    }

    setProcessing(null);
  }

  async function handleDecline(invitationId: string): Promise<void> {
    setProcessing({ id: invitationId, action: "decline" });

    const result = await declineMosaicInvitation(invitationId);
    if (result.error) {
      console.error("Failed to decline invitation:", result.error);
    }

    router.refresh();
    setProcessing(null);
  }

  function formatExpiryDate(expiresAt: string): string {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Expires soon";
    if (diffDays === 1) return "Expires tomorrow";
    return `Expires in ${diffDays} days`;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Pending Invitations</h2>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white">
                  {invitation.mosaic_name}
                </p>
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
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                {invitation.invited_by_name && (
                  <span>Invited by {invitation.invited_by_name}</span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpiryDate(invitation.expires_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => handleDecline(invitation.id)}
                disabled={processing?.id === invitation.id}
              >
                {processing?.id === invitation.id &&
                processing.action === "decline" ? (
                  "Declining..."
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Decline
                  </>
                )}
              </Button>
              <Button
                size="sm"
                className="gap-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                onClick={() => handleAccept(invitation)}
                disabled={processing?.id === invitation.id}
              >
                {processing?.id === invitation.id &&
                processing.action === "accept" ? (
                  "Joining..."
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
