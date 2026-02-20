const SLACK_API_BASE = "https://slack.com/api";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members?: number;
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
 * Posts a message to a Slack channel with a tile name header.
 */
export async function postMessage(
  token: string,
  channelId: string,
  text: string,
  tileName: string,
): Promise<void> {
  const truncatedText = text.length > 3000 ? text.slice(0, 2997) + "..." : text;

  await slackFetch(token, "chat.postMessage", {
    body: {
      channel: channelId,
      text: `Mosaic result from ${tileName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Mosaic: ${tileName}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: truncatedText,
          },
        },
      ],
    },
  });
}
