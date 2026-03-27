/** Strip markdown code fences from LLM output and return trimmed content */
export function stripCodeFences(text: string): string {
  return text
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();
}
