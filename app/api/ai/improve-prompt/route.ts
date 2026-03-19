import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/server";

const model = google("gemini-flash-latest");

interface ImprovePromptRequest {
  currentPrompt: string;
  improvementInstructions: string;
}

const SYSTEM_PROMPT = `You are an expert prompt engineer helping users improve their AI prompts. Your goal is to enhance prompts while maintaining the user's original intent.

Key principles:
- Maintain the user's original intent and core purpose
- Apply only the requested improvements
- Make prompts more specific and actionable
- Remove ambiguity and add clarity
- Don't change the fundamental purpose or scope
- Keep the same output format requirements
- Preserve any existing structure (JSON schemas, markdown formats, etc.)

When asked to improve a prompt:
1. Carefully read the original prompt
2. Apply the requested improvements
3. Return ONLY the improved prompt text, no explanation or meta-commentary
4. Do not wrap the result in code fences or quotes`;

export async function POST(request: Request): Promise<Response> {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = (await request.json()) as Partial<ImprovePromptRequest>;

    const currentPrompt = body.currentPrompt?.trim();
    const improvementInstructions = body.improvementInstructions?.trim();

    if (!currentPrompt || !improvementInstructions) {
      return NextResponse.json(
        { error: "Current prompt and improvement instructions are required" },
        { status: 400 },
      );
    }

    // Generate improved prompt using AI
    const userPrompt = `Current prompt:
${currentPrompt}

Improvement request:
${improvementInstructions}

Please provide an improved version of the prompt that applies the requested improvements while maintaining the original intent.`;

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    // Return improved prompt
    return NextResponse.json({
      improvedPrompt: text.trim(),
    });
  } catch (error) {
    console.error("Error improving prompt:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to improve prompt: ${message}` },
      { status: 500 },
    );
  }
}
