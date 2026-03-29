import { google } from "@ai-sdk/google";
import { stepCountIs, streamText } from "ai";
import { type Chat, type Message, type Thread, toAiMessages } from "chat";

import { resolveSlackUser } from "./data";
import { type getBotAndAdapter } from "./index";
import { createBotTools } from "./tools";

type SlackAdapterType = Awaited<
  ReturnType<typeof getBotAndAdapter>
>["slackAdapter"];

const SYSTEM_PROMPT = `You are Mosaic AI's Slack assistant. You help users understand their mosaics, tiles, and execution results. You can also run tiles on demand.

Key concepts:
- **Mosaics** are workspaces that contain tiles
- **Tiles** are intelligence gathering units (url_reader, web_search, analyzer, slack_reader, catalog, github_issue)
- Tiles execute on schedules and produce results

When the user asks what you can do or asks for help, explain your capabilities:
- List their mosaics and tiles
- Show tile details (type, schedule, active status)
- Check tile execution status and recent job history
- Retrieve and discuss the latest results from any tile
- Search mosaics and tiles by name
- **Run any tile on demand** — trigger executions, create GitHub issues, run analyses
- Answer follow-up questions about any of the above in the same thread

Rules:
- When a user asks a question about their data, use the find_tile tool FIRST — it uses semantic search to instantly find the most relevant tile and its latest results
- When a user asks to create a GitHub issue, run a tile, or trigger an execution, use find_tile or search to locate the tile, then use run_tile to execute it
- When running a tile with custom input (e.g., "create an issue about X"), pass the user's description as the input parameter to run_tile
- For github_issue tiles with multiple repos: call get_channel_info first, then match the channel name/topic/purpose against the tile's configured repos to pick the right target_repo. Also look for GitHub repo links or repo names in the user's message. If you can't determine the repo, ask the user which one
- Always use the provided tools to look up real data — never guess or make up IDs
- When a user mentions a mosaic or tile by name, use the search tool to find the ID
- Keep responses concise and formatted for Slack (use *bold*, bullet points)
- If the user doesn't have access to something, say so politely
- When showing results, summarize key points rather than dumping raw data`;

interface ResolvedUser {
  userId: string;
  botToken: string;
}

/**
 * Resolves the Mosaic user ID and bot token for the Slack message author.
 * Returns null if the user can't be matched.
 */
async function resolveUser(
  thread: Thread,
  message: Message,
  slackAdapter: SlackAdapterType,
): Promise<ResolvedUser | null> {
  const raw = message.raw as { team?: string; team_id?: string } | undefined;
  const teamId = raw?.team ?? raw?.team_id ?? "";
  console.log(
    "[bot] resolveUser for team",
    teamId,
    "slack user",
    message.author.userId,
  );
  const installation = await slackAdapter.getInstallation(teamId);
  if (!installation?.botToken) {
    console.error("[bot] no installation for team", teamId);
    return null;
  }

  const userId = await resolveSlackUser(
    installation.botToken,
    message.author.userId,
  );
  if (!userId) {
    await thread.post(
      "I couldn't match your Slack account to a Mosaic AI user. Make sure you're using the same email address for both.",
    );
    return null;
  }

  return { userId, botToken: installation.botToken };
}

/**
 * Streams an AI answer to the thread using Gemini with tool-calling.
 * Uses fullStream for native Slack streaming with proper step boundaries.
 */
async function answerQuestion(
  thread: Thread,
  userId: string,
  context?: { slackToken?: string; channelId?: string },
): Promise<void> {
  console.log("[bot] answerQuestion for user", userId, "thread", thread.id);
  const tools = createBotTools(userId, context);

  await thread.refresh();
  const history = await toAiMessages(thread.recentMessages, {
    includeNames: true,
  });

  const result = streamText({
    model: google("gemini-flash-latest"),
    system: SYSTEM_PROMPT,
    messages: history,
    tools,
    stopWhen: stepCountIs(12),
    onStepFinish: (event) => {
      console.log("[bot] step", event.stepNumber, {
        text: event.text.length,
        toolCalls: event.toolCalls.map((tc) => tc.toolName),
        finishReason: event.finishReason,
      });
    },
  });

  await thread.post(result.fullStream);
}

/**
 * Shared handler logic: adds reactions, resolves user, runs callback, cleans up.
 */
async function handleMessage(
  event: string,
  thread: Thread,
  message: Message,
  slackAdapter: SlackAdapterType,
  action: (
    userId: string,
    context: { slackToken?: string; channelId?: string },
  ) => Promise<void>,
): Promise<void> {
  console.log(`[bot] ${event} fired`, {
    threadId: thread.id,
    text: message.text.slice(0, 50),
  });
  await slackAdapter.addReaction(thread.id, message.id, "eyes").catch(() => {});
  await slackAdapter
    .addReaction(thread.id, message.id, "loading")
    .catch(() => {});
  try {
    const resolved = await resolveUser(thread, message, slackAdapter);
    if (!resolved) return;

    const raw = message.raw as { channel?: string } | undefined;
    const channelId = raw?.channel ?? "";

    await action(resolved.userId, {
      slackToken: resolved.botToken,
      channelId,
    });
  } catch (err) {
    console.error(`[bot] ${event} error:`, err);
  } finally {
    await slackAdapter
      .removeReaction(thread.id, message.id, "loading")
      .catch(() => {});
  }
}

/**
 * Registers all event handlers on the bot instance.
 */
export function registerHandlers(
  bot: Chat,
  slackAdapter: SlackAdapterType,
): void {
  bot.onNewMention(async (thread, message) => {
    await handleMessage(
      "onNewMention",
      thread,
      message,
      slackAdapter,
      async (userId, context) => {
        await thread.subscribe();
        await answerQuestion(thread, userId, context);
      },
    );
  });

  bot.onSubscribedMessage(async (thread, message) => {
    if (message.author.isMe) return;
    await handleMessage(
      "onSubscribedMessage",
      thread,
      message,
      slackAdapter,
      (userId, context) => answerQuestion(thread, userId, context),
    );
  });
}
