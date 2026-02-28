const SLACK_API_BASE = "https://slack.com/api";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members?: number;
}

interface SlackChannelInfo {
  id: string;
  name: string;
  purpose?: { value: string };
  topic?: { value: string };
  num_members?: number;
}

interface SlackUser {
  id: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string };
}

interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  replies?: SlackMessage[];
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
  channels?: SlackChannel[];
  messages?: SlackMessage[];
  channel?: SlackChannelInfo;
  members?: string[];
  user?: SlackUser;
}

export interface SlackChannelMetadata {
  name: string;
  purpose: string;
  topic: string;
  memberNames: string[];
  totalMembers: number;
}

async function slackFetch(
  token: string,
  method: string,
  options: {
    params?: Record<string, string | number | boolean>;
    body?: Record<string, unknown>;
  } = {},
): Promise<SlackApiResponse> {
  const url = new URL(`${SLACK_API_BASE}/${method}`);

  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as SlackApiResponse;

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error ?? "Unknown error"}`);
  }

  return data;
}

/**
 * Lists all channels the bot has access to (public + private it has joined).
 */
export async function listChannels(
  token: string,
): Promise<{ id: string; name: string }[]> {
  const channels: { id: string; name: string }[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string | number | boolean> = {
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
    };
    if (cursor) params.cursor = cursor;

    const data = await slackFetch(token, "conversations.list", { params });

    for (const ch of data.channels ?? []) {
      channels.push({ id: ch.id, name: ch.name });
    }

    cursor = data.response_metadata?.next_cursor;
  } while (cursor);

  return channels;
}

/** Converts a Date to a Unix timestamp string (seconds). */
function toUnixSeconds(date: Date): string {
  return String(Math.floor(date.getTime() / 1000));
}

/**
 * Computes calendar-based time ranges relative to a given IANA timezone.
 * - "last_day"  → yesterday 00:00:00 → 23:59:59
 * - "last_week" → previous Monday 00:00:00 → previous Sunday 23:59:59
 */
export function getCalendarRange(
  timeframe: "last_day" | "last_week",
  timezone: string,
): { oldest: string; latest: string; label: string } {
  // "now" expressed in the mosaic timezone
  const nowInTz = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone }),
  );

  if (timeframe === "last_day") {
    const start = new Date(nowInTz);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return {
      oldest: toUnixSeconds(start),
      latest: toUnixSeconds(end),
      label: "yesterday",
    };
  }

  // last_week: previous Monday 00:00 → previous Sunday 23:59:59
  const dayOfWeek = nowInTz.getDay(); // 0=Sun..6=Sat
  const daysSinceLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const prevMonday = new Date(nowInTz);
  prevMonday.setDate(prevMonday.getDate() - daysSinceLastMonday - 7);
  prevMonday.setHours(0, 0, 0, 0);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevSunday.getDate() + 6);
  prevSunday.setHours(23, 59, 59, 999);
  return {
    oldest: toUnixSeconds(prevMonday),
    latest: toUnixSeconds(prevSunday),
    label: "last week",
  };
}

/**
 * Fetches recent messages from a channel, optionally with thread replies.
 * Returns a formatted markdown string for LLM consumption.
 *
 * Accepts explicit `oldest`/`latest` Unix timestamp strings for the time range,
 * or a legacy `hoursBack` rolling window.
 */
export async function fetchChannelMessages(
  token: string,
  channelId: string,
  options: {
    oldest?: string;
    latest?: string;
    rangeLabel?: string;
    hoursBack?: number;
    maxMessages?: number;
    includeThreads?: boolean;
  } = {},
): Promise<string> {
  const maxMessages = options.maxMessages ?? 50;
  const includeThreads = options.includeThreads ?? true;

  // Use explicit range when provided, otherwise fall back to hoursBack
  let oldest: string;
  let rangeLabel: string;
  const params: Record<string, string | number | boolean> = {
    channel: channelId,
    limit: Math.min(maxMessages, 200),
  };

  if (options.oldest) {
    oldest = options.oldest;
    rangeLabel = options.rangeLabel ?? "specified range";
    params.oldest = oldest;
    if (options.latest) {
      params.latest = options.latest;
    }
  } else {
    const hoursBack = options.hoursBack ?? 24;
    oldest = String(
      Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000),
    );
    rangeLabel = `last ${hoursBack}h`;
    params.oldest = oldest;
  }

  const data = await slackFetch(token, "conversations.history", {
    params,
  });

  const messages = (data.messages ?? []).slice(0, maxMessages);

  // Fetch all thread replies in parallel
  const threadReplies = new Map<string, SlackMessage[]>();
  if (includeThreads) {
    const threadsWithReplies = messages.filter(
      (msg) => msg.thread_ts && (msg.reply_count ?? 0) > 0,
    );
    const results = await Promise.allSettled(
      threadsWithReplies.map(async (msg) => {
        const threadData = await slackFetch(token, "conversations.replies", {
          params: { channel: channelId, ts: msg.thread_ts!, limit: 20 },
        });
        return { ts: msg.ts, replies: (threadData.messages ?? []).slice(1) };
      }),
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.replies.length > 0) {
        threadReplies.set(result.value.ts, result.value.replies);
      }
    }
  }

  // Collect all unique user IDs from messages and thread replies
  const allMessages = messages.concat(
    Array.from(threadReplies.values()).flat(),
  );
  const userIds = new Set(
    allMessages.map((msg) => msg.user).filter(Boolean) as string[],
  );

  // Batch-resolve all user IDs to display names
  const entries = await Promise.all(
    Array.from(userIds).map(async (id) =>
      [id, await resolveUserName(token, id)] as const,
    ),
  );
  const userNames = new Map(entries);

  function authorName(userId: string | undefined): string {
    if (!userId) return "Unknown";
    return userNames.get(userId) ?? userId;
  }

  function formatLine(msg: SlackMessage, indent = ""): string {
    const time = new Date(parseFloat(msg.ts) * 1000).toISOString();
    return `${indent}[${time}] **${authorName(msg.user)}**: ${msg.text ?? ""}`;
  }

  // Format messages with author names and inline thread replies
  const formatted = messages.map((msg) => {
    const line = formatLine(msg);
    const replies = threadReplies.get(msg.ts);
    if (!replies) return line;
    return [line, ...replies.map((r) => formatLine(r, "  > "))].join("\n");
  });

  if (formatted.length === 0) {
    return `No messages found (${rangeLabel}).`;
  }

  return `## Slack Channel Messages (${rangeLabel})\n\n${formatted.join("\n\n")}`;
}

/**
 * Resolves a Slack user ID to a display name via users.info.
 * Falls back to the raw user ID on error (e.g. missing users:read scope).
 */
async function resolveUserName(token: string, userId: string): Promise<string> {
  try {
    const data = await slackFetch(token, "users.info", {
      params: { user: userId },
    });
    return data.user?.profile?.display_name || data.user?.real_name || userId;
  } catch {
    return userId;
  }
}

const MAX_MEMBERS_TO_RESOLVE = 30;

/**
 * Resolves member names for a channel.
 * Returns an empty array on failure (e.g. missing scope).
 */
async function resolveMemberNames(
  token: string,
  channelId: string,
): Promise<string[]> {
  try {
    const data = await slackFetch(token, "conversations.members", {
      params: { channel: channelId, limit: MAX_MEMBERS_TO_RESOLVE },
    });

    const memberIds = data.members ?? [];
    return Promise.all(memberIds.map((id) => resolveUserName(token, id)));
  } catch {
    return [];
  }
}

/**
 * Fetches channel metadata: name, purpose, topic, and member names.
 * Returns null on failure (never throws).
 */
export async function fetchChannelMetadata(
  token: string,
  channelId: string,
): Promise<SlackChannelMetadata | null> {
  try {
    const info = await slackFetch(token, "conversations.info", {
      params: { channel: channelId },
    });

    const channel = info.channel;
    if (!channel) return null;

    const memberNames = await resolveMemberNames(token, channelId);

    return {
      name: channel.name || channelId,
      purpose: channel.purpose?.value || "",
      topic: channel.topic?.value || "",
      memberNames,
      totalMembers: channel.num_members ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Formats channel metadata as a markdown block for LLM context.
 */
export function formatChannelMetadata(meta: SlackChannelMetadata): string {
  const lines: string[] = [`## Channel: #${meta.name}`];

  if (meta.topic) {
    lines.push(`**Topic**: ${meta.topic}`);
  }
  if (meta.purpose) {
    lines.push(`**Description**: ${meta.purpose}`);
  }

  if (meta.memberNames.length > 0) {
    const displayNames = meta.memberNames.join(", ");
    const remaining = meta.totalMembers - meta.memberNames.length;
    const suffix = remaining > 0 ? `, ... (and ${remaining} more)` : "";
    lines.push(`**Members** (${meta.totalMembers}): ${displayNames}${suffix}`);
  } else if (meta.totalMembers > 0) {
    lines.push(`**Members**: ${meta.totalMembers}`);
  }

  return lines.join("\n");
}

const SECTION_MAX_LENGTH = 3000;
const MAX_BLOCKS = 50;

/**
 * Splits text into chunks that fit within Slack's section block limit.
 * Prefers splitting at paragraph boundaries, then line breaks, then hard split.
 */
function splitIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    const window = remaining.slice(0, maxSize);
    const splitIndex =
      findLastIndex(window, "\n\n") ??
      findLastIndex(window, "\n") ??
      maxSize;

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).replace(/^\n+/, "");
  }

  return chunks;
}

/** Returns the last index of `sep` in `str`, or null if not found (or at position 0). */
function findLastIndex(str: string, sep: string): number | null {
  const index = str.lastIndexOf(sep);
  return index > 0 ? index : null;
}

/**
 * Posts a message to a Slack channel with a tile name header.
 * Splits long content into multiple section blocks (Slack limit: 3000 chars each, 50 blocks max).
 */
export async function postMessage(
  token: string,
  channelId: string,
  text: string,
  tileName: string,
): Promise<void> {
  const chunks = splitIntoChunks(text, SECTION_MAX_LENGTH);

  // Header block always first
  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Mosaic: ${tileName}`,
        emoji: true,
      },
    },
  ];

  // 1 header + N sections + possibly 1 context = stay under MAX_BLOCKS
  const maxSections = MAX_BLOCKS - 2; // reserve header + context
  const truncated = chunks.length > maxSections;
  const visibleChunks = chunks.slice(0, maxSections);

  for (const chunk of visibleChunks) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: chunk,
      },
    });
  }

  if (truncated) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Content truncated. Full report available in Mosaic AI.",
        },
      ],
    });
  }

  await slackFetch(token, "chat.postMessage", {
    body: {
      channel: channelId,
      text: `Mosaic result from ${tileName}`,
      blocks,
    },
  });
}
