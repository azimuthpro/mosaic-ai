"use client";

import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
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
import { transferMosaicOwnership } from "@/lib/actions/mosaics";
import type { MosaicMember } from "@/types/database";

interface AdminWithUser extends MosaicMember {
  user: { id: string; email: string; full_name: string | null };
}

interface TransferOwnershipDialogProps {
  mosaicId: string;
  mosaicName: string;
  admins: AdminWithUser[];
  onTransferred?: () => void;
}

export function TransferOwnershipDialog({
  mosaicId,
  mosaicName,
  admins,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAdmin = admins.find((a) => a.user.id === selectedAdminId);
  const confirmationPhrase = "transfer ownership";
  const isConfirmed = confirmText.toLowerCase() === confirmationPhrase;

  async function handleTransfer() {
    if (!selectedAdminId || !isConfirmed) return;

    setIsLoading(true);
    setError(null);

    const result = await transferMosaicOwnership(mosaicId, selectedAdminId);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setOpen(false);
    onTransferred?.();
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (!newOpen) {
      setSelectedAdminId("");
      setConfirmText("");
      setError(null);
    }
  }

  if (admins.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Transfer Ownership
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Transfer Ownership
          </DialogTitle>
          <DialogDescription>
            Transfer ownership of &quot;{mosaicName}&quot; to an admin. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-amber-50 p-4 dark:bg-amber-900/20">
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              What happens when you transfer ownership:
            </h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
              <li>The new owner will have full control of this mosaic</li>
              <li>You will become an admin of the mosaic</li>
              <li>You will no longer be able to delete the mosaic</li>
              <li>This action cannot be undone by you</li>
            </ul>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-owner">New Owner</Label>
            <Select
              value={selectedAdminId}
              onValueChange={setSelectedAdminId}
              disabled={isLoading}
            >
              <SelectTrigger id="new-owner">
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.map((admin) => (
                  <SelectItem key={admin.user.id} value={admin.user.id}>
                    {admin.user.full_name || admin.user.email}
                    {admin.user.full_name && (
                      <span className="ml-2 text-muted-foreground">
                        ({admin.user.email})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAdmin && (
            <div className="space-y-2">
              <Label htmlFor="confirm">
                Type &quot;{confirmationPhrase}&quot; to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirmationPhrase}
                disabled={isLoading}
              />
            </div>
          )}
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
          <Button
            type="button"
            variant="destructive"
            onClick={handleTransfer}
            disabled={isLoading || !selectedAdminId || !isConfirmed}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer Ownership"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
