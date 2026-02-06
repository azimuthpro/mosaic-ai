"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Globe,
  Loader2,
  Plus,
  Send,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatRelativeTime } from "@/lib/utils/format";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

// Webhook types
type WebhookEvent = "job.started" | "job.completed" | "job.failed";
type AuthType = "none" | "bearer" | "basic" | "header";

interface TileWebhook {
  id: string;
  tile_id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  auth_type: AuthType;
  auth_config: Record<string, string>;
  retry_count: number;
  timeout_ms: number;
  is_active: boolean;
  last_triggered_at: string | null;
  last_status: string | null;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  job_id: string | null;
  event_type: string;
  status: "pending" | "success" | "failed";
  response_status: number | null;
  attempts: number;
  created_at: string;
  delivered_at: string | null;
}

interface WebhooksPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

const EVENT_OPTIONS: { value: WebhookEvent; label: string }[] = [
  { value: "job.started", label: "Job Started" },
  { value: "job.completed", label: "Job Completed" },
  { value: "job.failed", label: "Job Failed" },
];

const AUTH_OPTIONS: { value: AuthType; label: string; description: string }[] =
  [
    { value: "none", label: "None", description: "No authentication" },
    {
      value: "bearer",
      label: "Bearer Token",
      description: "Authorization: Bearer <token>",
    },
    {
      value: "basic",
      label: "Basic Auth",
      description: "Username and password",
    },
    {
      value: "header",
      label: "Custom Header",
      description: "Custom header name and value",
    },
  ];

export function WebhooksPlugin({
  tile,
  mosaicId,
  disabled,
  state,
}: WebhooksPluginProps) {
  const { pluginState, updatePluginState } = state;

  // Local state for webhooks
  const [webhooks, setWebhooks] = useState<TileWebhook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(
    null,
  );
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(
    null,
  );
  const [deliveries, setDeliveries] = useState<
    Record<string, WebhookDelivery[]>
  >({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    events: ["job.completed"] as WebhookEvent[],
    authType: "none" as AuthType,
    authToken: "",
    authUsername: "",
    authPassword: "",
    authHeaderName: "",
    authHeaderValue: "",
  });

  const isWebhooksCollapsed = pluginState["webhooks"] ?? true;

  const loadWebhooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/tiles/${tile.id}/webhooks`);
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (error) {
      console.error("Failed to load webhooks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tile.id]);

  // Load webhooks when plugin opens
  useEffect(() => {
    if (!isWebhooksCollapsed) {
      loadWebhooks();
    }
  }, [isWebhooksCollapsed, loadWebhooks]);

  const loadDeliveries = async (webhookId: string) => {
    setLoadingDeliveries(webhookId);
    try {
      const response = await fetch(
        `/api/v1/tiles/${tile.id}/webhooks/${webhookId}/deliveries`,
      );
      if (response.ok) {
        const data = await response.json();
        setDeliveries((prev) => ({
          ...prev,
          [webhookId]: data.deliveries || [],
        }));
      }
    } catch (error) {
      console.error("Failed to load deliveries:", error);
    } finally {
      setLoadingDeliveries(null);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      alert("Please enter a name and URL");
      return;
    }

    setIsCreating(true);
    try {
      // Build auth config based on type
      let authConfig: Record<string, string> = {};
      switch (formData.authType) {
        case "bearer":
          authConfig = { token: formData.authToken };
          break;
        case "basic":
          authConfig = {
            username: formData.authUsername,
            password: formData.authPassword,
          };
          break;
        case "header":
          authConfig = {
            name: formData.authHeaderName,
            value: formData.authHeaderValue,
          };
          break;
      }

      const response = await fetch(`/api/v1/tiles/${tile.id}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          url: formData.url,
          events: formData.events,
          auth_type: formData.authType,
          auth_config: authConfig,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWebhooks((prev) => [data.webhook, ...prev]);
        setShowForm(false);
        setFormData({
          name: "",
          url: "",
          events: ["job.completed"],
          authType: "none",
          authToken: "",
          authUsername: "",
          authPassword: "",
          authHeaderName: "",
          authHeaderValue: "",
        });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create webhook");
      }
    } catch (error) {
      console.error("Failed to create webhook:", error);
      alert("Failed to create webhook");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    setDeletingWebhookId(webhookId);
    try {
      const response = await fetch(
        `/api/v1/tiles/${tile.id}/webhooks/${webhookId}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
      } else {
        alert("Failed to delete webhook");
      }
    } catch (error) {
      console.error("Failed to delete webhook:", error);
      alert("Failed to delete webhook");
    } finally {
      setDeletingWebhookId(null);
    }
  };

  const handleToggleActive = async (webhookId: string, isActive: boolean) => {
    try {
      const response = await fetch(
        `/api/v1/tiles/${tile.id}/webhooks/${webhookId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: isActive }),
        },
      );

      if (response.ok) {
        setWebhooks((prev) =>
          prev.map((w) =>
            w.id === webhookId ? { ...w, is_active: isActive } : w,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to toggle webhook:", error);
    }
  };

  const handleTest = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    try {
      const response = await fetch(
        `/api/v1/tiles/${tile.id}/webhooks/${webhookId}/test`,
        { method: "POST" },
      );

      if (response.ok) {
        const data = await response.json();
        alert(data.success ? "Test successful!" : `Test failed: ${data.error}`);
        // Reload deliveries
        loadDeliveries(webhookId);
      } else {
        alert("Failed to send test");
      }
    } catch (error) {
      console.error("Failed to test webhook:", error);
      alert("Failed to send test");
    } finally {
      setTestingWebhookId(null);
    }
  };

  const toggleEventSelection = (event: WebhookEvent) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const activeWebhookCount = webhooks.filter((w) => w.is_active).length;

  return (
    <PluginCard
      id="webhooks"
      title="Webhooks"
      description="Notify external services"
      icon={<Webhook className="h-4 w-4 text-green-400" />}
      section="output"
      collapsed={isWebhooksCollapsed}
      onCollapsedChange={(collapsed) => {
        updatePluginState("webhooks", collapsed);
      }}
      badge={{
        text: activeWebhookCount > 0 ? `${activeWebhookCount} active` : "None",
        variant: activeWebhookCount > 0 ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      <div className="space-y-4">
        {/* Add webhook button */}
        {!showForm && (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add Webhook
          </Button>
        )}

        {/* Create form */}
        {showForm && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Webhook
            </h4>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="My Webhook"
                />
              </div>

              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={formData.url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div className="space-y-2">
                <Label>Events</Label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((event) => (
                    <Button
                      key={event.value}
                      type="button"
                      variant={
                        formData.events.includes(event.value)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => toggleEventSelection(event.value)}
                    >
                      {event.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Authentication</Label>
                <Select
                  value={formData.authType}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      authType: v as AuthType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_OPTIONS.map((auth) => (
                      <SelectItem key={auth.value} value={auth.value}>
                        <div>
                          <div className="font-medium">{auth.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {auth.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.authType === "bearer" && (
                <div className="space-y-2">
                  <Label>Bearer Token</Label>
                  <Input
                    type="password"
                    value={formData.authToken}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        authToken: e.target.value,
                      }))
                    }
                    placeholder="Your bearer token"
                  />
                </div>
              )}

              {formData.authType === "basic" && (
                <>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={formData.authUsername}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          authUsername: e.target.value,
                        }))
                      }
                      placeholder="Username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={formData.authPassword}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          authPassword: e.target.value,
                        }))
                      }
                      placeholder="Password"
                    />
                  </div>
                </>
              )}

              {formData.authType === "header" && (
                <>
                  <div className="space-y-2">
                    <Label>Header Name</Label>
                    <Input
                      value={formData.authHeaderName}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          authHeaderName: e.target.value,
                        }))
                      }
                      placeholder="X-Custom-Header"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Header Value</Label>
                    <Input
                      type="password"
                      value={formData.authHeaderValue}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          authHeaderValue: e.target.value,
                        }))
                      }
                      placeholder="Header value"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Webhooks list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : webhooks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No webhooks configured yet
          </p>
        ) : (
          <div className="space-y-2">
            {webhooks.map((webhook) => {
              const isExpanded = expandedWebhookId === webhook.id;
              const webhookDeliveries = deliveries[webhook.id] || [];

              return (
                <div
                  key={webhook.id}
                  className="rounded-lg border border-border bg-muted/20 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      onClick={() => {
                        setExpandedWebhookId(isExpanded ? null : webhook.id);
                        if (!isExpanded && !deliveries[webhook.id]) {
                          loadDeliveries(webhook.id);
                        }
                      }}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {webhook.name}
                          </span>
                          {webhook.last_status && (
                            <Badge
                              variant={
                                webhook.last_status === "success"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {webhook.last_status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {webhook.url}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(webhook.id, checked)
                        }
                        className="data-[state=checked]:bg-green-500"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTest(webhook.id)}
                        disabled={testingWebhookId === webhook.id}
                      >
                        {testingWebhookId === webhook.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDelete(webhook.id)}
                        disabled={deletingWebhookId === webhook.id}
                      >
                        {deletingWebhookId === webhook.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {webhook.events.map((event) => (
                          <Badge
                            key={event}
                            variant="outline"
                            className="text-xs"
                          >
                            {event}
                          </Badge>
                        ))}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Auth:{" "}
                        {
                          AUTH_OPTIONS.find(
                            (a) => a.value === webhook.auth_type,
                          )?.label
                        }
                        {webhook.last_triggered_at && (
                          <span className="ml-2">
                            · Last triggered:{" "}
                            {formatRelativeTime(webhook.last_triggered_at)}
                          </span>
                        )}
                      </div>

                      {/* Recent deliveries */}
                      <div className="space-y-2">
                        <Label className="text-xs">Recent Deliveries</Label>
                        {loadingDeliveries === webhook.id ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : webhookDeliveries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No deliveries yet
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {webhookDeliveries.slice(0, 5).map((delivery) => (
                              <div
                                key={delivery.id}
                                className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  {delivery.status === "success" ? (
                                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                                  ) : delivery.status === "failed" ? (
                                    <XCircle className="h-3 w-3 text-red-400" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 text-yellow-400" />
                                  )}
                                  <span>{delivery.event_type}</span>
                                  {delivery.response_status && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1"
                                    >
                                      {delivery.response_status}
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-muted-foreground">
                                  {formatRelativeTime(delivery.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PluginCard>
  );
}
