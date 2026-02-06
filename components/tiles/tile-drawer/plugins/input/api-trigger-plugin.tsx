"use client";

import {
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Key,
  Loader2,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface ApiTriggerPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

export function ApiTriggerPlugin({
  tile,
  mosaicId,
  disabled,
  state,
}: ApiTriggerPluginProps) {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const {
    apiKeys,
    isLoadingKeys,
    isCreatingKey,
    newKeyName,
    setNewKeyName,
    showNewKey,
    setShowNewKey,
    handleCreateKey,
    handleRevokeKey,
    pluginState,
    updatePluginState,
  } = state;

  const apiEndpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/v1/tiles/${tile.id}/run`
      : `/api/v1/tiles/${tile.id}/run`;

  const copyToClipboard = useCallback(
    (text: string, type: "endpoint" | "key" | "curl") => {
      navigator.clipboard.writeText(text);
      const setters = {
        endpoint: setCopiedEndpoint,
        key: setCopiedKey,
        curl: setCopiedCurl,
      };
      const setter = setters[type];
      setter(true);
      setTimeout(() => setter(false), 2000);
    },
    [],
  );

  const activeKeyCount = apiKeys.filter((k) => k.is_active).length;

  return (
    <PluginCard
      id="api-trigger"
      title="API Trigger"
      description="Run this tile via REST API"
      icon={<Code2 className="h-4 w-4 text-cyan-400" />}
      section="input"
      collapsed={pluginState["api-trigger"] ?? true}
      onCollapsedChange={(collapsed) =>
        updatePluginState("api-trigger", collapsed)
      }
      badge={{
        text: activeKeyCount > 0 ? `${activeKeyCount} keys` : "No keys",
        variant: activeKeyCount > 0 ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      <div className="space-y-4">
        {/* Endpoint */}
        <div className="space-y-2">
          <Label>Endpoint</Label>
          <div className="flex items-center gap-2">
            <Input
              value={`POST ${apiEndpoint}`}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(apiEndpoint, "endpoint")}
            >
              {copiedEndpoint ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* curl Example */}
        <div className="space-y-2">
          <Label>Example Request</Label>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs font-mono">{`curl -X POST "${apiEndpoint}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"urls": ["https://example.com"]}'`}</pre>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              copyToClipboard(
                `curl -X POST "${apiEndpoint}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"urls": ["https://example.com"]}'`,
                "curl",
              )
            }
          >
            {copiedCurl ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy curl
          </Button>
        </div>

        {/* Request Schema */}
        <div className="space-y-2">
          <Label>Request Body (optional)</Label>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <pre className="text-xs font-mono">{`{
  "urls": string[]  // Optional: Override configured sources
}`}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            If urls array is provided, these take priority over configured tile
            sources.
          </p>
        </div>

        {/* Response Schema (SSE Events) */}
        <Collapsible>
          <div className="space-y-2">
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-left hover:bg-muted/30 transition-colors">
              <Label className="cursor-pointer">
                Response (Server-Sent Events)
              </Label>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  SSE Event Types:
                </p>
                <div className="space-y-1.5 text-xs font-mono">
                  <p>
                    <span className="text-cyan-400">started</span>:{" "}
                    {"{ jobId, tileId }"}
                  </p>
                  <p>
                    <span className="text-cyan-400">progress</span>:{" "}
                    {"{ jobId, sourceId, type, status }"}
                  </p>
                  <p>
                    <span className="text-cyan-400">result</span>:
                    {" { jobId, report: { id, content, format, source_urls } }"}
                  </p>
                  <p>
                    <span className="text-cyan-400">done</span>: {"{ jobId }"}
                  </p>
                  <p>
                    <span className="text-red-400">error</span>:{" "}
                    {"{ message, code }"}
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Separator />

        {/* Create New Key */}
        <div className="space-y-2">
          <Label>Create API Key</Label>
          <div className="flex items-center gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Production)"
            />
            <Button
              onClick={handleCreateKey}
              disabled={isCreatingKey || !newKeyName.trim()}
            >
              {isCreatingKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Show newly created key */}
        {showNewKey && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <p className="mb-2 text-sm font-medium text-green-400">
              API Key Created - Copy it now!
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={showNewKey}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(showNewKey, "key")}
              >
                {copiedKey ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              This key will not be shown again.
            </p>
          </div>
        )}

        {/* Existing Keys */}
        <div className="space-y-2">
          <Label>API Keys</Label>
          {isLoadingKeys ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No API keys yet
            </p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{key.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {key.key_prefix}...
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {key.is_active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeKey(key.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </Button>
                    ) : (
                      <Badge variant="secondary">Revoked</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PluginCard>
  );
}
