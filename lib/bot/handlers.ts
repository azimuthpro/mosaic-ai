import { stepCountIs, streamText } from "ai";
import { type Chat, type Message, type Thread, toAiMessages } from "chat";

import { flashModel } from "@/lib/ai/models";
import { resolveBotTokenForTeam } from "@/lib/slack/integration";
import { createAdminClient } from "@/lib/supabase/admin";

import { resolveSlackIdentity, type SlackIdentityFailure } from "./data";
import { type createBot } from "./index";
import { type BotToolContext, createBotTools } from "./tools";

type SlackAdapterType = ReturnType<typeof createBot>["slackAdapter"];

/** Emoji must be Slack built-ins: a custom one (`:loading:`) only exists in
 * workspaces that uploaded it, and the reaction call fails everywhere else. */
const SEEN_EMOJI = "eyes";
const WORKING_EMOJI = "hourglass_flowing_sand";

const IDENTITY_MESSAGES: Record<SlackIdentityFailure, string> = {
  // Nothing the user can do about a missing scope — point at the fix.
  no_email:
    "I can't read your Slack email, so I can't tell who you are. Ask a workspace admin to reconnect Slack in Mosaic AI so the app gets email permission.",
  no_matching_user:
    "I couldn't match your Slack account to a Mosaic AI user. Make sure you're using the same email address for both.",
  slack_api_error:
    "I couldn't reach Slack to check who you are. Try again in a minute.",
};

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
- When users ask about current events, external topics, industry news, or anything outside their Mosaic data, use the web_search tool to find information and synthesize the results into a comprehensive answer
- For deep research, use web_search with 'advanced' depth
- For questions about the user's own mosaics and tiles, always prefer the Mosaic tools (find_tile, search, etc.) over web search
- Think through complex questions carefully before answering
- Keep responses concise and formatted for Slack (use *bold*, bullet points)
- If the user doesn't have access to something, say so politely
- When showing results, summarize key points rather than dumping raw data

Tool-use discipline:
- Call run_tile AT MOST ONCE per user request. If it returns success, reply with a one-line confirmation in text — do not call run_tile or any other tool again.
- If run_tile returns success: false, explain the problem to the user in text. Do not retry with different parameters.
- After every tool call, you MUST either produce a text response OR call exactly one more tool. Never chain more than 4 tool calls before producing text.`;

interface SlackOrigin {
  teamId: string;
  channelId: string;
  threadTs?: string;
}

/**
 * Reads workspace, channel and thread out of a raw Slack message event.
 * Returns null when team or channel is missing: an empty ID fails later, inside
 * a token lookup or a Slack call, far from the cause.
 */
function extractOrigin(message: Message): SlackOrigin | null {
  const raw = message.raw as
    | {
        channel?: string;
        team?: string;
        team_id?: string;
        thread_ts?: string;
        ts?: string;
      }
    | undefined;

  const teamId = raw?.team ?? raw?.team_id;
  const channelId = raw?.channel;
  if (!teamId || !channelId) return null;

  // A reply carries thread_ts; a top-level message is itself the thread root.
  return { teamId, channelId, threadTs: raw?.thread_ts ?? raw?.ts };
}

/**
 * Streams an AI answer to the thread using Gemini with tool-calling.
 * Uses fullStream for native Slack streaming with proper step boundaries.
 */
async function answerQuestion(
  thread: Thread,
  userId: string,
  context?: BotToolContext,
): Promise<void> {
  console.log("[bot] answerQuestion thread", thread.id);
  const tools = createBotTools(userId, context);

  await thread.refresh();
  const history = await toAiMessages(thread.recentMessages, {
    includeNames: true,
  });

  const result = streamText({
    model: flashModel,
    system: SYSTEM_PROMPT,
    messages: history,
    tools,
    // Forwarded verbatim to Google by the AI Gateway.
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 4096,
          includeThoughts: false,
        },
      },
    },
    stopWhen: stepCountIs(6),
    onStepFinish: (event) => {
      console.log("[bot] step", event.stepNumber, {
        text: event.text.length,
        toolCalls: event.toolCalls.map((tc) => tc.toolName),
        finishReason: event.finishReason,
      });
    },
  });

  try {
    await thread.post(result.fullStream);
  } catch (err) {
    console.error("[bot] streamed post failed, falling back:", err);
    const finalText = await result.text;
    await thread.post(
      finalText?.trim() ||
        "I ran into a problem completing that. Check the tile in Mosaic AI to see if the action went through.",
    );
  }
}

type Trigger = "onNewMention" | "onDirectMessage" | "onSubscribedMessage";

/**
 * Shared handler logic: identifies the author, adds reactions, answers, cleans up.
 */
async function handleMessage(
  trigger: Trigger,
  thread: Thread,
  message: Message,
  slackAdapter: SlackAdapterType,
): Promise<void> {
  // Skip our own messages and every other bot. Bots have no email, so without
  // this each one gets an "I can't identify you" reply — and two bots in a
  // followed thread can answer each other indefinitely.
  if (message.author.isMe || message.author.isBot === true) return;

  console.log(`[bot] ${trigger} fired`, { threadId: thread.id });

  const origin = extractOrigin(message);
  if (!origin) {
    console.error("[bot] message without team or channel", {
      threadId: thread.id,
    });
    return;
  }

  const installation = await resolveBotTokenForTeam(
    createAdminClient(),
    origin.teamId,
  );
  if (!installation) {
    console.error("[bot] no Slack integration for team", origin.teamId);
    return;
  }

  const identity = await resolveSlackIdentity(
    installation.botToken,
    origin.teamId,
    message.author.userId,
  );
  if (!identity.ok) {
    console.warn("[bot] identity failed:", identity.reason);
    // In a followed thread the bot sees every reply, including colleagues
    // talking to each other. Only answer people who addressed it directly.
    if (trigger !== "onSubscribedMessage") {
      await thread.post(IDENTITY_MESSAGES[identity.reason]);
    }
    return;
  }

  // React only once the author is known, so the bot never marks a message it
  // then ignores.
  await slackAdapter
    .addReaction(thread.id, message.id, SEEN_EMOJI)
    .catch(() => {});
  await slackAdapter
    .addReaction(thread.id, message.id, WORKING_EMOJI)
    .catch(() => {});

  try {
    // Subscribing is a state write; the thread is already followed on a
    // follow-up message.
    if (trigger !== "onSubscribedMessage") await thread.subscribe();

    await answerQuestion(thread, identity.userId, {
      slackToken: installation.botToken,
      channelId: origin.channelId,
      teamId: origin.teamId,
      threadTs: origin.threadTs,
    });
  } catch (err) {
    console.error(`[bot] ${trigger} error:`, err);
    // Silence after the 👀 reaction reads as "still working" forever. Say so.
    await thread
      .post(
        "Something went wrong while I was working on that. Nothing was changed — try again.",
      )
      .catch(() => {});
  } finally {
    await slackAdapter
      .removeReaction(thread.id, message.id, WORKING_EMOJI)
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
  bot.onNewMention((thread, message) =>
    handleMessage("onNewMention", thread, message, slackAdapter),
  );

  bot.onDirectMessage((thread, message) =>
    handleMessage("onDirectMessage", thread, message, slackAdapter),
  );

  bot.onSubscribedMessage((thread, message) =>
    handleMessage("onSubscribedMessage", thread, message, slackAdapter),
  );
}
