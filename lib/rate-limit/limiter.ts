import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

// Default rate limit configuration
export const DEFAULT_MAX_EXECUTIONS_PER_HOUR = 100;
export const DEFAULT_MAX_CONCURRENT_EXECUTIONS = 3;

// Type helper for RPC calls (since functions are created dynamically via migration)
type RpcClient = {
  rpc: <T>(
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: Error | null }>;
};

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxPerHour: number;
  concurrentExecutions: number;
  maxConcurrent: number;
  resetsAt: Date;
  reason?: "max_concurrent_exceeded" | "hourly_limit_exceeded";
}

export interface RateLimitStatus {
  executionsThisHour: number;
  concurrentExecutions: number;
  hourWindowStart: Date;
  resetsAt: Date;
}

/**
 * Checks if a user can execute an agent and increments their counters if allowed.
 * This is an atomic operation using a database function.
 */
export async function checkAndIncrementRateLimit(
  adminClient: SupabaseClient<Database>,
  userId: string,
  options?: {
    maxPerHour?: number;
    maxConcurrent?: number;
  },
): Promise<RateLimitResult> {
  const maxPerHour = options?.maxPerHour ?? DEFAULT_MAX_EXECUTIONS_PER_HOUR;
  const maxConcurrent =
    options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT_EXECUTIONS;

  // Cast to RpcClient to handle dynamic RPC functions from migrations
  const rpcClient = adminClient as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc<Json>(
    "check_and_increment_execution_count",
    {
      p_user_id: userId,
      p_max_per_hour: maxPerHour,
      p_max_concurrent: maxConcurrent,
    },
  );

  if (error) {
    console.error("Rate limit check failed:", error);
    // On error, be conservative and reject to prevent abuse
    return {
      allowed: false,
      currentCount: 0,
      maxPerHour,
      concurrentExecutions: 0,
      maxConcurrent,
      resetsAt: new Date(),
      reason: "hourly_limit_exceeded",
    };
  }

  const result = data as {
    allowed: boolean;
    current_count: number;
    max_per_hour: number;
    concurrent_executions: number;
    max_concurrent: number;
    resets_at: string;
    reason: string | null;
  };

  return {
    allowed: result.allowed,
    currentCount: result.current_count,
    maxPerHour: result.max_per_hour,
    concurrentExecutions: result.concurrent_executions,
    maxConcurrent: result.max_concurrent,
    resetsAt: new Date(result.resets_at),
    reason: result.reason as RateLimitResult["reason"],
  };
}

/**
 * Decrements the concurrent execution counter for a user.
 * Should be called when an execution completes (success or failure).
 */
export async function decrementConcurrentCount(
  adminClient: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const rpcClient = adminClient as unknown as RpcClient;
  const { error } = await rpcClient.rpc<void>(
    "decrement_concurrent_execution_count",
    {
      p_user_id: userId,
    },
  );

  if (error) {
    console.error("Failed to decrement concurrent count:", error);
    // Don't throw - this is a cleanup operation
  }
}

/**
 * Gets the current rate limit status for a user without incrementing.
 */
export async function getRateLimitStatus(
  adminClient: SupabaseClient<Database>,
  userId: string,
): Promise<RateLimitStatus> {
  const rpcClient = adminClient as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc<Json>("get_rate_limit_status", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Failed to get rate limit status:", error);
    // Return default values on error
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);
    const resetsAt = new Date(hourStart.getTime() + 60 * 60 * 1000);
    return {
      executionsThisHour: 0,
      concurrentExecutions: 0,
      hourWindowStart: hourStart,
      resetsAt,
    };
  }

  const result = data as {
    executions_this_hour: number;
    concurrent_executions: number;
    hour_window_start: string;
    resets_at: string;
  };

  return {
    executionsThisHour: result.executions_this_hour,
    concurrentExecutions: result.concurrent_executions,
    hourWindowStart: new Date(result.hour_window_start),
    resetsAt: new Date(result.resets_at),
  };
}

/**
 * Error class for rate limit violations.
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly reason: "max_concurrent_exceeded" | "hourly_limit_exceeded",
    public readonly resetsAt: Date,
    public readonly currentCount: number,
    public readonly maxCount: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }

  toJSON() {
    return {
      error: this.message,
      reason: this.reason,
      resetsAt: this.resetsAt.toISOString(),
      currentCount: this.currentCount,
      maxCount: this.maxCount,
    };
  }
}

/**
 * Asserts that the rate limit check passed, throwing RateLimitError if not.
 */
export function assertRateLimitAllowed(result: RateLimitResult): void {
  if (result.allowed) return;

  const reason = result.reason || "hourly_limit_exceeded";
  const isConcurrent = reason === "max_concurrent_exceeded";

  const message = isConcurrent
    ? `Maximum concurrent executions reached (${result.concurrentExecutions}/${result.maxConcurrent})`
    : `Hourly execution limit reached (${result.currentCount}/${result.maxPerHour}). Resets at ${result.resetsAt.toISOString()}`;

  throw new RateLimitError(
    message,
    reason,
    result.resetsAt,
    isConcurrent ? result.concurrentExecutions : result.currentCount,
    isConcurrent ? result.maxConcurrent : result.maxPerHour,
  );
}

/**
 * Logs an execution event to the execution_logs table.
 */
export async function logExecutionEvent(
  adminClient: SupabaseClient<Database>,
  params: {
    executionId: string;
    agentId: string;
    jobId?: string;
    eventType:
      | "started"
      | "completed"
      | "failed"
      | "timeout"
      | "cycle_detected"
      | "depth_exceeded"
      | "rate_limited";
    metadata?: Record<string, unknown>;
  },
): Promise<string | null> {
  const rpcClient = adminClient as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc<string>("log_execution_event", {
    p_execution_id: params.executionId,
    p_agent_id: params.agentId,
    p_job_id: params.jobId || null,
    p_event_type: params.eventType,
    p_metadata: params.metadata || {},
  });

  if (error) {
    console.error("Failed to log execution event:", error);
    return null;
  }

  return data;
}
