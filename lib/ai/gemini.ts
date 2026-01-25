import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

import type { OutputFormat, Json } from '@/types/database'

const model = google('gemini-2.0-flash')

interface AnalysisResult {
  success: boolean
  content: Json
  rawText?: string
  error?: string
}

function getFormatInstructions(format: OutputFormat): string {
  switch (format) {
    case 'text':
      return 'Provide your response as a clear, well-structured paragraph or paragraphs of text.'
    case 'list':
      return 'Provide your response as a JSON array of strings, where each string is a bullet point. Example: ["Point 1", "Point 2", "Point 3"]'
    case 'table':
      return 'Provide your response as a JSON object with "headers" (array of column names) and "rows" (array of arrays with values). Example: {"headers": ["Name", "Value"], "rows": [["Item 1", "100"], ["Item 2", "200"]]}'
    case 'json':
      return 'Provide your response as a valid JSON object with structured data.'
    default:
      return 'Provide your response as clear text.'
  }
}

export async function analyzeContent(
  scrapedContent: string[],
  systemPrompt: string,
  outputFormat: OutputFormat
): Promise<AnalysisResult> {
  try {
    const formatInstructions = getFormatInstructions(outputFormat)

    const combinedContent = scrapedContent.join('\n\n---\n\n')

    const fullPrompt = `${systemPrompt}

${formatInstructions}

Here is the content to analyze:

${combinedContent}`

    const { text } = await generateText({
      model,
      prompt: fullPrompt,
    })

    // Parse the response based on format
    let content: Json

    if (outputFormat === 'text') {
      content = { text }
    } else {
      // Try to parse JSON from the response
      try {
        // Find JSON in the response (might be wrapped in markdown code blocks)
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text]
        const jsonStr = jsonMatch[1] || text

        const parsed = JSON.parse(jsonStr.trim())
        content = Array.isArray(parsed) ? { items: parsed } : parsed
      } catch {
        // If parsing fails, wrap in text format
        content = { text, parseError: true }
      }
    }

    return {
      success: true,
      content,
      rawText: text,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      content: null,
      error: message,
    }
  }
}
