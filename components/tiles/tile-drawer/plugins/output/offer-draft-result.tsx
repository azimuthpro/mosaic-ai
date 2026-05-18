"use client";

import { CheckCircle2, Loader2, Mail, Send, XCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TileJobResultSummary } from "@/lib/actions/tile-execution";
import type { OfferDraftResult, OfferDraftStatus } from "@/types/database";

interface OfferDraftResultProps {
  tileId: string;
  result: TileJobResultSummary;
}

function toDraft(content: unknown): OfferDraftResult | null {
  if (!content || typeof content !== "object") return null;
  const obj = content as Record<string, unknown>;
  if (
    typeof obj.status !== "string" ||
    typeof obj.recipient_email !== "string"
  ) {
    return null;
  }
  return content as OfferDraftResult;
}

const STATUS_BADGE: Record<
  OfferDraftStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  cancelled: { label: "Cancelled", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

export function OfferDraftResultCard({
  tileId,
  result,
}: OfferDraftResultProps) {
  const initial = toDraft(result.content);
  const [draft, setDraft] = useState<OfferDraftResult | null>(initial);
  const [busy, setBusy] = useState<"send" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    return (
      <pre className="whitespace-pre-wrap break-words text-sm font-mono">
        <code>{JSON.stringify(result.content, null, 2)}</code>
      </pre>
    );
  }

  async function call(action: "send" | "cancel") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/tiles/${tileId}/jobs/${result.job_id}/send-offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        draft?: OfferDraftResult;
      };
      if (!json.ok) {
        setError(json.error ?? "Action failed");
      } else if (json.draft) {
        setDraft(json.draft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  const badge = STATUS_BADGE[draft.status];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold">{draft.subject}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            To: <span className="text-foreground">{draft.recipient_email}</span>
            {draft.recipient_name ? ` (${draft.recipient_name})` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            From: {draft.from_name} &lt;{draft.from_email}&gt;
            {draft.reply_to_email ? ` · reply-to ${draft.reply_to_email}` : ""}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <iframe
        title="Offer preview"
        srcDoc={draft.html}
        sandbox=""
        className="w-full h-[400px] rounded border border-border bg-white"
      />

      {draft.ai_notes && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">What the AI changed</summary>
          <p className="mt-1 whitespace-pre-wrap">{draft.ai_notes}</p>
        </details>
      )}

      {draft.status === "draft" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => call("send")}
            disabled={busy !== null}
          >
            {busy === "send" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Send Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => call("cancel")}
            disabled={busy !== null}
          >
            {busy === "cancel" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Cancel
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      <StatusFooter draft={draft} />
    </div>
  );
}

function StatusFooter({ draft }: { draft: OfferDraftResult }) {
  switch (draft.status) {
    case "sent":
      return (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sent
          {draft.sent_at
            ? ` at ${new Date(draft.sent_at).toLocaleString()}`
            : ""}
        </div>
      );
    case "cancelled":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" />
          Cancelled
        </div>
      );
    case "failed":
      return (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Send failed: {draft.sendgrid_error ?? "unknown error"}
        </div>
      );
    default:
      return null;
  }
}
