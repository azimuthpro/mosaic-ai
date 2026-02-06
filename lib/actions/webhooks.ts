"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  Json,
  TileWebhook,
  TileWebhookDelivery,
  TileWebhookInsert,
  TileWebhookUpdate,
  WebhookAuthConfig,
  WebhookEventType,
  WebhookPayload,
} from "@/types/database";

// Get all webhooks for a tile
export async function getTileWebhooks(tileId: string): Promise<TileWebhook[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tile_webhooks")
    .select("*")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch webhooks:", error);
    return [];
  }

  return data as TileWebhook[];
}

// Get a single webhook
export async function getTileWebhook(
  webhookId: string,
): Promise<TileWebhook | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tile_webhooks")
    .select("*")
    .eq("id", webhookId)
    .single();

  if (error) {
    console.error("Failed to fetch webhook:", error);
    return null;
  }

  return data as TileWebhook;
}

// Create a new webhook
export async function createTileWebhook(params: {
  tileId: string;
  name: string;
  url: string;
  events?: WebhookEventType[];
  authType?: string;
  authConfig?: WebhookAuthConfig;
}): Promise<{ webhook?: TileWebhook; error?: string }> {
  const supabase = await createClient();

  const insert: TileWebhookInsert = {
    tile_id: params.tileId,
    name: params.name,
    url: params.url,
    events: params.events || ["job.completed"],
    auth_type: params.authType || "none",
    auth_config: (params.authConfig || {}) as Json,
  };

  const { data, error } = await supabase
    .from("tile_webhooks")
    .insert(insert as never)
    .select()
    .single();

  if (error) {
    console.error("Failed to create webhook:", error);
    return { error: error.message };
  }

  return { webhook: data as TileWebhook };
}

// Update a webhook
export async function updateTileWebhook(
  webhookId: string,
  params: {
    name?: string;
    url?: string;
    events?: WebhookEventType[];
    authType?: string;
    authConfig?: WebhookAuthConfig;
    isActive?: boolean;
  },
): Promise<{ webhook?: TileWebhook; error?: string }> {
  const supabase = await createClient();

  const update: TileWebhookUpdate = {};
  if (params.name !== undefined) update.name = params.name;
  if (params.url !== undefined) update.url = params.url;
  if (params.events !== undefined) update.events = params.events;
  if (params.authType !== undefined) update.auth_type = params.authType;
  if (params.authConfig !== undefined)
    update.auth_config = params.authConfig as Json;
  if (params.isActive !== undefined) update.is_active = params.isActive;

  const { data, error } = await supabase
    .from("tile_webhooks")
    .update(update as never)
    .eq("id", webhookId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update webhook:", error);
    return { error: error.message };
  }

  return { webhook: data as TileWebhook };
}

// Delete a webhook
export async function deleteTileWebhook(
  webhookId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tile_webhooks")
    .delete()
    .eq("id", webhookId);

  if (error) {
    console.error("Failed to delete webhook:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Get webhook deliveries
export async function getWebhookDeliveries(
  webhookId: string,
  limit: number = 20,
): Promise<TileWebhookDelivery[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tile_webhook_deliveries")
    .select("*")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch deliveries:", error);
    return [];
  }

  return data as TileWebhookDelivery[];
}

// Deliver webhook (called from tile execution)
export async function deliverWebhook(
  webhook: TileWebhook,
  payload: WebhookPayload,
  jobId?: string,
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient();

  // Create delivery record
  const { data: delivery, error: insertError } = await adminClient
    .from("tile_webhook_deliveries")
    .insert({
      webhook_id: webhook.id,
      job_id: jobId,
      event_type: payload.event,
      payload: payload as unknown as Json,
      status: "pending",
      attempts: 0,
    } as never)
    .select()
    .single();

  if (insertError || !delivery) {
    console.error("Failed to create delivery record:", insertError);
    return { success: false, error: "Failed to create delivery record" };
  }

  const deliveryId = (delivery as { id: string }).id;

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "MosaicAI-Webhook/1.0",
  };

  // Add auth headers based on type
  const authConfig = webhook.auth_config as Record<string, string>;
  switch (webhook.auth_type) {
    case "bearer":
      if (authConfig.token) {
        headers["Authorization"] = `Bearer ${authConfig.token}`;
      }
      break;
    case "basic":
      if (authConfig.username && authConfig.password) {
        const credentials = Buffer.from(
          `${authConfig.username}:${authConfig.password}`,
        ).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }
      break;
    case "header":
      if (authConfig.name && authConfig.value) {
        headers[authConfig.name] = authConfig.value;
      }
      break;
  }

  // Attempt delivery with retries
  let lastError: string | null = null;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let attempts = 0;
  const maxAttempts = webhook.retry_count + 1;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeout_ms);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      responseStatus = response.status;
      responseBody = await response.text().catch(() => null);

      if (response.ok) {
        // Success - update delivery record
        await adminClient
          .from("tile_webhook_deliveries")
          .update({
            status: "success",
            response_status: responseStatus,
            response_body: responseBody?.substring(0, 1000),
            attempts,
            delivered_at: new Date().toISOString(),
          } as never)
          .eq("id", deliveryId);

        // Update webhook last triggered
        await adminClient
          .from("tile_webhooks")
          .update({
            last_triggered_at: new Date().toISOString(),
            last_status: "success",
          } as never)
          .eq("id", webhook.id);

        return { success: true };
      }

      lastError = `HTTP ${responseStatus}: ${responseBody?.substring(0, 200)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }

    // Wait before retry (exponential backoff)
    if (attempts < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts - 1), 10000)),
      );
    }
  }

  // All attempts failed
  await adminClient
    .from("tile_webhook_deliveries")
    .update({
      status: "failed",
      response_status: responseStatus,
      response_body: responseBody?.substring(0, 1000),
      attempts,
      error_message: lastError,
    } as never)
    .eq("id", deliveryId);

  // Update webhook last triggered
  await adminClient
    .from("tile_webhooks")
    .update({
      last_triggered_at: new Date().toISOString(),
      last_status: "failed",
    } as never)
    .eq("id", webhook.id);

  return { success: false, error: lastError || "Delivery failed" };
}

// Trigger webhooks for a tile event
export async function triggerTileWebhooks(
  tileId: string,
  event: WebhookEventType,
  payload: Omit<WebhookPayload, "event" | "timestamp">,
): Promise<void> {
  const adminClient = createAdminClient();

  // Get active webhooks for this tile that are subscribed to this event
  const { data: webhooks, error } = await adminClient
    .from("tile_webhooks")
    .select("*")
    .eq("tile_id", tileId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (error || !webhooks || webhooks.length === 0) {
    return;
  }

  const fullPayload: WebhookPayload = {
    ...payload,
    event,
    timestamp: new Date().toISOString(),
  };

  // Deliver to all webhooks in parallel
  await Promise.allSettled(
    (webhooks as TileWebhook[]).map((webhook) =>
      deliverWebhook(webhook, fullPayload, payload.job?.id),
    ),
  );
}
