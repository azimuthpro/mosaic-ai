import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { formatDateGrounding } from "@/lib/ai/date-grounding";
import { getLanguageInstruction } from "@/lib/constants/languages";
import type { Json, LanguageCode, OutputFormat } from "@/types/database";

const model = google("gemini-pro-latest");
const summaryModel = google("gemini-flash-latest");

const SUMMARY_INPUT_MAX_CHARS = 20_000;

export interface DebugInfo {
  fullPrompt: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
}

interface AnalysisResult {
  success: boolean;
  content: Json;
  rawText?: string;
  error?: string;
  debugInfo?: DebugInfo;
}

function stripCodeFences(text: string): string {
  // Remove markdown code fences (```markdown, ```json, ``` etc.)
  const match = text.match(/^```\w*\n?([\s\S]*?)```$/);
  return match?.[1]?.trim() ?? text.trim();
}

function parseResponseContent(text: string, format: OutputFormat): Json {
  if (format === "text") {
    // Strip any code fences the AI might have added
    return { text: stripCodeFences(text) };
  }

  try {
    const jsonStr = stripCodeFences(text);
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? { items: parsed } : parsed;
  } catch {
    return { text, parseError: true };
  }
}

function getFormatInstructions(
  format: OutputFormat,
  outputSchema?: string | null,
): string {
  if (format === "text") {
    return "Provide your response as clear, well-structured markdown text. Do NOT wrap your response in code fences.";
  }

  // JSON format
  if (outputSchema) {
    return `You MUST respond with a valid JSON object that conforms to this Zod schema:

\`\`\`typescript
${outputSchema}
\`\`\`

Output ONLY the JSON object, no markdown code blocks.`;
  }

  return "Provide your response as a valid JSON object. Output ONLY the JSON object, no markdown code blocks.";
}

export async function analyzeContent(
  scrapedContent: string[],
  systemPrompt: string,
  outputFormat: OutputFormat,
  language: LanguageCode = "en",
  outputSchema?: string | null,
  timezone?: string,
): Promise<AnalysisResult> {
  try {
    const formatInstructions = getFormatInstructions(
      outputFormat,
      outputSchema,
    );
    const languageInstruction = getLanguageInstruction(language);
    const dateGrounding = formatDateGrounding(timezone);

    const combinedContent = scrapedContent.join("\n\n---\n\n");

    const fullPrompt = `${dateGrounding}

${systemPrompt}

${formatInstructions}
${languageInstruction ? `\n${languageInstruction}` : ""}

Here is the content to analyze:

${combinedContent}`;

    const { text, usage, finishReason } = await generateText({
      model,
      prompt: fullPrompt,
    });

    const content = parseResponseContent(text, outputFormat);
    const promptTokens = usage.inputTokens ?? 0;
    const completionTokens = usage.outputTokens ?? 0;

    return {
      success: true,
      content,
      rawText: text,
      debugInfo: {
        fullPrompt,
        modelId: "gemini-flash-latest",
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: finishReason ?? "unknown",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      content: null,
      error: message,
    };
  }
}

/**
 * Produces a 1–2 sentence plain-text summary of content using gemini-flash-latest.
 * Returns null on error so callers can fall back to posting the full content.
 */
export async function summarizeContent(
  content: string,
): Promise<string | null> {
  const input = content.trim().slice(0, SUMMARY_INPUT_MAX_CHARS);
  if (!input) return null;

  const prompt = `Summarize the following report in 1-2 short sentences. Write the summary in the SAME LANGUAGE as the report itself (if the report is in Polish, reply in Polish; if in English, reply in English; etc.). Plain text only: no markdown, no bullet points, no code fences, no headings. Focus on the most important takeaway a reader should know at a glance.

Report:
${input}`;

  try {
    const { text } = await generateText({ model: summaryModel, prompt });
    return stripCodeFences(text).trim() || null;
  } catch {
    return null;
  }
}
