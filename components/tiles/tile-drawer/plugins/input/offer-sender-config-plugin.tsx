"use client";

import { Loader2, Mail, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateTile } from "@/lib/actions/tiles";
import type {
  Json,
  OfferSenderConfig,
  TileWithSources,
} from "@/types/database";

import { PluginCard } from "../plugin-card";

interface OfferSenderConfigPluginProps {
  tile: TileWithSources;
  disabled?: boolean;
}

interface FormState {
  html_template: string;
  from_email: string;
  from_name: string;
  reply_to_email: string;
  reply_to_name: string;
  bcc_email: string;
}

function readConfig(tile: TileWithSources): FormState {
  const cfg = (tile.config as OfferSenderConfig | null) ?? null;
  return {
    html_template: cfg?.html_template ?? "",
    from_email: cfg?.from_email ?? "",
    from_name: cfg?.from_name ?? "",
    reply_to_email: cfg?.reply_to_email ?? "",
    reply_to_name: cfg?.reply_to_name ?? "",
    bcc_email: cfg?.bcc_email ?? "",
  };
}

export function OfferSenderConfigPlugin({
  tile,
  disabled,
}: OfferSenderConfigPluginProps) {
  const saved = useMemo(() => readConfig(tile), [tile]);
  const [htmlTemplate, setHtmlTemplate] = useState(saved.html_template);
  const [fromEmail, setFromEmail] = useState(saved.from_email);
  const [fromName, setFromName] = useState(saved.from_name);
  const [replyToEmail, setReplyToEmail] = useState(saved.reply_to_email);
  const [replyToName, setReplyToName] = useState(saved.reply_to_name);
  const [bccEmail, setBccEmail] = useState(saved.bcc_email);
  const [isSaving, setIsSaving] = useState(false);

  const dirty =
    htmlTemplate !== saved.html_template ||
    fromEmail !== saved.from_email ||
    fromName !== saved.from_name ||
    replyToEmail !== saved.reply_to_email ||
    replyToName !== saved.reply_to_name ||
    bccEmail !== saved.bcc_email;

  async function handleSave() {
    setIsSaving(true);
    const next: OfferSenderConfig = {
      html_template: htmlTemplate,
      ...(fromEmail.trim() ? { from_email: fromEmail.trim() } : {}),
      ...(fromName.trim() ? { from_name: fromName.trim() } : {}),
      ...(replyToEmail.trim() ? { reply_to_email: replyToEmail.trim() } : {}),
      ...(replyToName.trim() ? { reply_to_name: replyToName.trim() } : {}),
      ...(bccEmail.trim() ? { bcc_email: bccEmail.trim() } : {}),
    };
    const result = await updateTile(tile.id, {
      config: next as unknown as Json,
    });
    setIsSaving(false);
    if (result.error) {
      alert(result.error);
    }
  }

  return (
    <PluginCard
      id="offer-sender-config"
      title="Offer Template & Sender"
      description="HTML template + sender identity. AI personalizes this at runtime."
      icon={<Mail className="h-4 w-4 text-cyan-400" />}
      section="input"
      badge={
        htmlTemplate.trim().length > 0
          ? { text: `${htmlTemplate.trim().length} chars` }
          : { text: "no template", variant: "destructive" }
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="offer-html-template">HTML Template</Label>
          <Textarea
            id="offer-html-template"
            rows={10}
            className="font-mono text-xs"
            value={htmlTemplate}
            onChange={(e) => setHtmlTemplate(e.target.value)}
            disabled={disabled || isSaving}
            placeholder="<html>…your branded offer template…</html>"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="offer-from-email">From email</Label>
            <Input
              id="offer-from-email"
              placeholder="(defaults to env)"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              disabled={disabled || isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-from-name">From name</Label>
            <Input
              id="offer-from-name"
              placeholder="e.g. Mateusz @ Mosaic"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              disabled={disabled || isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-reply-to-email">Reply-to email</Label>
            <Input
              id="offer-reply-to-email"
              placeholder="(optional)"
              value={replyToEmail}
              onChange={(e) => setReplyToEmail(e.target.value)}
              disabled={disabled || isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-reply-to-name">Reply-to name</Label>
            <Input
              id="offer-reply-to-name"
              placeholder="(optional)"
              value={replyToName}
              onChange={(e) => setReplyToName(e.target.value)}
              disabled={disabled || isSaving}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="offer-bcc-email">BCC email (hidden copy)</Label>
            <Input
              id="offer-bcc-email"
              type="email"
              placeholder="(optional) — recipient won't see this"
              value={bccEmail}
              onChange={(e) => setBccEmail(e.target.value)}
              disabled={disabled || isSaving}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={disabled || isSaving || !dirty}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </PluginCard>
  );
}
