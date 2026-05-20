"use client";

import {
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  disableCatalogSheetSync,
  enableCatalogSheetSync,
  syncCatalogSheet,
} from "@/lib/actions/catalog";
import { formatRelativeTime } from "@/lib/utils/format";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface SheetsOutputPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

interface GoogleStatus {
  connected: boolean;
  email: string | null;
}

export function SheetsOutputPlugin({
  tile,
  mosaicId,
  disabled,
  state,
}: SheetsOutputPluginProps) {
  const { pluginState, updatePluginState } = state;
  const isCollapsed = pluginState["sheets_output"] ?? true;

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [enabled, setEnabled] = useState(tile.sheets_sync_enabled ?? false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(
    tile.sheets_spreadsheet_url ?? null,
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    tile.sheets_last_synced_at ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then((data) =>
        setGoogleStatus({
          connected: !!data.connected,
          email: data.email ?? null,
        }),
      )
      .catch(() => setGoogleStatus({ connected: false, email: null }))
      .finally(() => setCheckingStatus(false));
  }, []);

  async function handleToggleEnabled(value: boolean) {
    setError(null);
    if (!value) {
      setBusy(true);
      const result = await disableCatalogSheetSync(tile.id);
      setBusy(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEnabled(false);
      setSpreadsheetUrl(null);
      setLastSyncedAt(null);
      setLastSummary(null);
      return;
    }

    setBusy(true);
    const result = await enableCatalogSheetSync(tile.id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setEnabled(true);
    setSpreadsheetUrl(result.url);
    setLastSyncedAt(new Date().toISOString());
    setLastSummary("Initial export complete.");
  }

  async function handleSyncNow() {
    setError(null);
    setBusy(true);
    const result = await syncCatalogSheet(tile.id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setLastSyncedAt(new Date().toISOString());
    setLastSummary(
      `+${result.added} added · ~${result.updated} updated · −${result.deleted} removed`,
    );
  }

  const returnTo = `/mosaics/${mosaicId}`;
  const connectUrl = `/api/auth/google/connect?return_to=${encodeURIComponent(returnTo)}`;

  const badgeText = enabled ? "On" : "Off";

  return (
    <PluginCard
      id="sheets_output"
      title="Google Sheets"
      description="Push catalog entries and events to a Google Sheet"
      icon={<FileSpreadsheet className="h-4 w-4 text-green-600" />}
      section="output"
      collapsed={isCollapsed}
      onCollapsedChange={(collapsed) =>
        updatePluginState("sheets_output", collapsed)
      }
      badge={{
        text: badgeText,
        variant: enabled ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      <div className="space-y-4">
        {checkingStatus ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking Google connection…
          </div>
        ) : !googleStatus?.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to sync catalog data to a spreadsheet.
            </p>
            <Button asChild size="sm" variant="outline">
              <a href={connectUrl}>Connect Google Sheets</a>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Sync to Google Sheets</Label>
              <div className="flex items-center gap-2">
                {busy && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                <Switch
                  checked={enabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={disabled || busy}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Connected as {googleStatus.email ?? "Google user"}. One-way sync —
              manual edits to the sheet will be overwritten on the next catalog
              run.
            </p>

            {enabled && spreadsheetUrl && (
              <div className="space-y-3 rounded-md border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-cyan-400 hover:underline"
                  >
                    Open spreadsheet
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncNow}
                    disabled={disabled || busy}
                  >
                    {busy ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                    )}
                    Sync now
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  {lastSyncedAt ? (
                    <>Last synced {formatRelativeTime(lastSyncedAt)}</>
                  ) : (
                    <>Not yet synced</>
                  )}
                  {lastSummary && <span> · {lastSummary}</span>}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 break-words">{error}</p>
            )}
          </>
        )}
      </div>
    </PluginCard>
  );
}
