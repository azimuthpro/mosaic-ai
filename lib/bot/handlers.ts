import { google } from "@ai-sdk/google";
import { stepCountIs, streamText } from "ai";
import { type Chat, type Message, type Thread, toAiMessages } from "chat";

import { resolveSlackUser } from "./data";
import { type getBotAndAdapter } from "./index";
import { createBotTools } from "./tools";

type SlackAdapterType = Awaited<
  ReturnType<typeof getBotAndAdapter>
>["slackAdapter"];

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
  slackAdapter: SlackAdapterType,
): Promise<string | null> {
  const raw = message.raw as { team?: string; team_id?: string } | undefined;
  const teamId = raw?.team || raw?.team_id || "";
  console.log("[bot] resolveUser for team", teamId, "slack user", message.author.userId);
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
 * Summarize tool results from steps into a plain-text block for the fallback call.
 * We avoid replaying tool-call/tool-result messages because Gemini requires
 * provider-specific thought_signature metadata on those parts.
 */
function summarizeToolResults(
  steps: { toolCalls: readonly { toolName: string; input: unknown }[]; toolResults: readonly { toolName: string; output: unknown }[] }[],
): string {
  const parts: string[] = [];
  for (const step of steps) {
    for (let i = 0; i < step.toolCalls.length; i++) {
      const call = step.toolCalls[i];
      const result = step.toolResults[i];
      parts.push(
        `Tool: ${call.toolName}\nInput: ${JSON.stringify(call.input)}\nResult: ${JSON.stringify(result?.output ?? null)}`,
      );
    }
  }
  return parts.join("\n\n");
}

/**
 * Streams an AI answer to the thread using Gemini with tool-calling.
 */
async function answerQuestion(thread: Thread, userId: string): Promise<void> {
  console.log("[bot] answerQuestion for user", userId, "thread", thread.id);
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
    stopWhen: stepCountIs(8),
    onStepFinish: (event) => {
      console.log("[bot] step", event.stepNumber, {
        text: event.text.length,
        toolCalls: event.toolCalls.map((tc) => tc.toolName),
        finishReason: event.finishReason,
      });
    },
  });

  // Await the full result server-side — do NOT stream to Slack,
  // because tool-call-only steps produce no text and would post an empty message.
  const text = await result.text;

  if (text.trim()) {
    await thread.post(text);
    return;
  }

  // Model exhausted steps on tool calls without producing text.
  const steps = await result.steps;
  const summary = summarizeToolResults(steps);
  if (!summary) return;

  console.log("[bot] empty response after", steps.length, "tool steps — forcing text synthesis");

  const fallback = streamText({
    model: google("gemini-flash-latest"),
    system: SYSTEM_PROMPT,
    messages: [
      ...history,
      {
        role: "user" as const,
        content: `Based on the following tool results, provide a helpful response to the user's question:\n\n${summary}`,
      },
    ],
  });

  await thread.post(fallback.textStream);
}

/**
 * Registers all event handlers on the bot instance.
 */
export function registerHandlers(
  bot: Chat,
  slackAdapter: SlackAdapterType,
): void {
  bot.onNewMention(async (thread, message) => {
    console.log("[bot] onNewMention fired", {
      threadId: thread.id,
      text: message.text.slice(0, 50),
    });
    try {
      await slackAdapter.addReaction(thread.id, message.id, "eyes");
      const userId = await resolveUser(thread, message, slackAdapter);
      if (!userId) {
        await slackAdapter.removeReaction(thread.id, message.id, "eyes").catch(() => {});
        return;
      }

      await thread.subscribe();
      await answerQuestion(thread, userId);
      await slackAdapter.removeReaction(thread.id, message.id, "eyes").catch(() => {});
    } catch (err) {
      console.error("[bot] onNewMention error:", err);
      await slackAdapter.removeReaction(thread.id, message.id, "eyes").catch(() => {});
    }
  });

  bot.onSubscribedMessage(async (thread, message) => {
    // Skip messages from the bot itself
    if (message.author.isMe) return;

    console.log("[bot] onSubscribedMessage fired", {
      threadId: thread.id,
      text: message.text.slice(0, 50),
    });
    try {
      await slackAdapter.addReaction(thread.id, message.id, "eyes");
      const userId = await resolveUser(thread, message, slackAdapter);
      if (!userId) {
        await slackAdapter.removeReaction(thread.id, message.id, "eyes").catch(() => {});
        return;
      }

      await answerQuestion(thread, userId);
      await slackAdapter.removeReaction(thread.id, message.id, "eyes").catch(() => {});
    } catch (err) {
      console.error("[bot] onSubscribedMessage error:", err);
      await slackAdapter.removeReaction(thread.id, message.id, "eyes").catch(() => {});
    }
  });
}
