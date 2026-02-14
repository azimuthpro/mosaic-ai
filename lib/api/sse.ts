/**
 * SSE (Server-Sent Events) streaming helpers for tile execution API
 */

export type SSEEventType =
  | "started"
  | "progress"
  | "context"
  | "connection"
  | "result"
  | "done"
  | "error";

export interface SSEStartedEvent {
  job_id: string;
  tile_id: string;
  status: "processing";
}

export interface SSEProgressEvent {
  job_id: string;
  source_id?: string;
  source_type?: string;
  status: "fetching" | "completed" | "failed";
  content_length?: number;
  error?: string;
}

export interface SSEContextEvent {
  job_id: string;
  available_tiles: {
    tile_id: string;
    name: string;
    has_report: boolean;
  }[];
}

export interface SSEConnectionEvent {
  job_id: string;
  input_tile_id: string;
  status: "fetching_report" | "completed" | "failed";
  error?: string;
}

export interface SSEResultEvent {
  job_id: string;
  status: "completed";
  report: {
    id: string;
    content: unknown;
    format: string;
    source_urls: string[];
    created_at: string;
  };
}

export interface SSEDoneEvent {
  job_id: string;
}

export interface SSEErrorEvent {
  error: string;
  code: string;
}

export type SSEEventData =
  | SSEStartedEvent
  | SSEProgressEvent
  | SSEContextEvent
  | SSEConnectionEvent
  | SSEResultEvent
  | SSEDoneEvent
  | SSEErrorEvent;

/**
 * Format a single SSE message
 */
export function formatSSEMessage(
  event: SSEEventType,
  data: SSEEventData,
): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create an SSE Response with proper headers
 */
export function createSSEResponse(): {
  response: Response;
  stream: ReadableStream<Uint8Array>;
  controller: ReadableStreamDefaultController<Uint8Array> | null;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      // Stream was cancelled by client
    },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });

  return { response, stream, controller };
}

/**
 * SSE Writer class for easier event streaming
 */
export class SSEWriter {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array>;
  private closed = false;

  constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
    this.controller = controller;
  }

  /**
   * Send an SSE event
   */
  send(event: SSEEventType, data: SSEEventData): void {
    if (this.closed) return;

    try {
      const message = formatSSEMessage(event, data);
      this.controller.enqueue(this.encoder.encode(message));
    } catch {
      // Controller may be closed
      this.closed = true;
    }
  }

  /**
   * Send a started event
   */
  sendStarted(jobId: string, tileId: string): void {
    this.send("started", {
      job_id: jobId,
      tile_id: tileId,
      status: "processing",
    });
  }

  /**
   * Send a progress event for source fetching
   */
  sendProgress(
    jobId: string,
    sourceId: string,
    sourceType: string,
    status: "fetching" | "completed" | "failed",
    options?: { contentLength?: number; error?: string },
  ): void {
    this.send("progress", {
      job_id: jobId,
      source_id: sourceId,
      source_type: sourceType,
      status,
      ...options,
    });
  }

  /**
   * Send context event with available tiles
   */
  sendContext(
    jobId: string,
    availableTiles: { tile_id: string; name: string; has_report: boolean }[],
  ): void {
    this.send("context", {
      job_id: jobId,
      available_tiles: availableTiles,
    });
  }

  /**
   * Send connection event for tile input processing
   */
  sendConnection(
    jobId: string,
    inputTileId: string,
    status: "fetching_report" | "completed" | "failed",
    error?: string,
  ): void {
    this.send("connection", {
      job_id: jobId,
      input_tile_id: inputTileId,
      status,
      ...(error ? { error } : {}),
    });
  }

  /**
   * Send result event with the completed report
   */
  sendResult(
    jobId: string,
    report: {
      id: string;
      content: unknown;
      format: string;
      source_urls: string[];
      created_at: string;
    },
  ): void {
    this.send("result", {
      job_id: jobId,
      status: "completed",
      report,
    });
  }

  /**
   * Send done event
   */
  sendDone(jobId: string): void {
    this.send("done", { job_id: jobId });
  }

  /**
   * Send error event
   */
  sendError(error: string, code: string): void {
    this.send("error", { error, code });
  }

  /**
   * Close the stream
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;

    try {
      this.controller.close();
    } catch {
      // Controller may already be closed
    }
  }
}

/**
 * Error codes for SSE error events
 */
export const SSE_ERROR_CODES = {
  INVALID_API_KEY: "INVALID_API_KEY",
  EXPIRED_API_KEY: "EXPIRED_API_KEY",
  TILE_NOT_FOUND: "TILE_NOT_FOUND",
  ACCESS_DENIED: "ACCESS_DENIED",
  NO_SOURCES: "NO_SOURCES",
  FETCH_FAILED: "FETCH_FAILED",
  AI_ANALYSIS_FAILED: "AI_ANALYSIS_FAILED",
  REPORT_SAVE_FAILED: "REPORT_SAVE_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  TOO_MANY_URLS: "TOO_MANY_URLS",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
