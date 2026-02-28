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

/**
 * Fetches recent messages from a channel, optionally with thread replies.
 * Returns a formatted markdown string for LLM consumption.
 */
export async function fetchChannelMessages(
  token: string,
  channelId: string,
  options: {
    hoursBack?: number;
    maxMessages?: number;
    includeThreads?: boolean;
  } = {},
): Promise<string> {
  const hoursBack = options.hoursBack ?? 24;
  const maxMessages = options.maxMessages ?? 50;
  const includeThreads = options.includeThreads ?? true;

  const oldest = String(
    Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000),
  );

  const data = await slackFetch(token, "conversations.history", {
    params: {
      channel: channelId,
      oldest,
      limit: Math.min(maxMessages, 200),
    },
  });

  const messages = data.messages ?? [];

  const enrichedMessages: string[] = [];

  for (const msg of messages.slice(0, maxMessages)) {
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();
    let messageText = `[${timestamp}] ${msg.text ?? ""}`;

    if (includeThreads && msg.thread_ts && (msg.reply_count ?? 0) > 0) {
      try {
        const threadData = await slackFetch(token, "conversations.replies", {
          params: { channel: channelId, ts: msg.thread_ts, limit: 20 },
        });
        const replies = (threadData.messages ?? []).slice(1);
        if (replies.length > 0) {
          const replyTexts = replies.map((r) => {
            const replyTs = new Date(parseFloat(r.ts) * 1000).toISOString();
            return `  > [${replyTs}] ${r.text ?? ""}`;
          });
          messageText += "\n" + replyTexts.join("\n");
        }
      } catch {
        // Thread fetch failed, continue without replies
      }
    }

    enrichedMessages.push(messageText);
  }

  if (enrichedMessages.length === 0) {
    return `No messages found in the last ${hoursBack} hours.`;
  }

  return `## Slack Channel Messages (last ${hoursBack}h)\n\n${enrichedMessages.join("\n\n")}`;
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
    lines.push(`**Purpose**: ${meta.purpose}`);
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
