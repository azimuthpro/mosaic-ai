import { google } from "@ai-sdk/google";
import { stepCountIs, streamText } from "ai";
import { type Message, type Thread, toAiMessages } from "chat";

import { resolveSlackUser } from "./data";
import { bot, slackAdapter } from "./index";
import { createBotTools } from "./tools";

const SYSTEM_PROMPT = `You are Mosaic AI's Slack assistant. You help users understand their mosaics, tiles, and execution results.

Key concepts:
- **Mosaics** are workspaces that contain tiles
- **Tiles** are intelligence gathering units (url_reader, web_search, analyzer, slack_reader, catalog)
- Tiles execute on schedules and produce results

When the user asks what you can do or asks for help, explain your capabilities:
- List their mosaics and tiles
- Show tile details (type, schedule, active status)
- Check tile execution status and recent job history
- Retrieve and discuss the latest results from any tile
- Search mosaics and tiles by name
- Answer follow-up questions about any of the above in the same thread

Rules:
- Always use the provided tools to look up real data — never guess or make up IDs
- When a user mentions a mosaic or tile by name, use the search tool first to find the ID
- Keep responses concise and formatted for Slack (use *bold*, bullet points)
- If the user doesn't have access to something, say so politely
- When showing results, summarize key points rather than dumping raw data`;

/**
 * Resolves the Mosaic user ID for the Slack message author.
 * Returns null if the user can't be matched.
 */
async function resolveUser(
  thread: Thread,
  message: Message,
): Promise<string | null> {
  const teamId = thread.id.split(":")[0] ?? "";
  const installation = await slackAdapter.getInstallation(teamId);
  if (!installation?.botToken) {
    console.error("[bot] no installation for team", teamId);
    return null;
  }

  const slackUserId = message.author.userId;
  const userId = await resolveSlackUser(installation.botToken, slackUserId);
  if (!userId) {
    await thread.post(
      "I couldn't match your Slack account to a Mosaic AI user. Make sure you're using the same email address for both.",
    );
    return null;
  }

  return userId;
}

/**
 * Streams an AI answer to the thread using Gemini with tool-calling.
 */
async function answerQuestion(thread: Thread, userId: string): Promise<void> {
  const tools = createBotTools(userId);

  await thread.refresh();
  const history = await toAiMessages(thread.recentMessages, {
    includeNames: true,
  });

  const result = streamText({
    model: google("gemini-flash-latest"),
    system: SYSTEM_PROMPT,
    messages: history,
    tools,
    stopWhen: stepCountIs(5),
  });

  await thread.post(result.textStream);
}

/**
 * Registers all event handlers on the bot instance.
 */
export function registerHandlers(): void {
  bot.onNewMention(async (thread, message) => {
    const userId = await resolveUser(thread, message);
    if (!userId) return;

    await thread.subscribe();
    await answerQuestion(thread, userId);
  });

  bot.onSubscribedMessage(async (thread, message) => {
    // Skip messages from the bot itself
    if (message.author.isMe) return;

    const userId = await resolveUser(thread, message);
    if (!userId) return;

    await answerQuestion(thread, userId);
  });
}
