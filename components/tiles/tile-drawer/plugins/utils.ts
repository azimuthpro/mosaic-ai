import type { TileJobResultSummary } from "@/lib/actions/tile-execution";

/**
 * Extract a displayable string from a job result's content field.
 */
export function getContentString(result: TileJobResultSummary): string {
  if (result.format === "text") {
    const contentObj = result.content as { text?: string } | null;
    if (contentObj?.text) return contentObj.text;
  }
  if (typeof result.content === "string") return result.content;
  return JSON.stringify(result.content, null, 2);
}

/**
 * Convert a cron expression to a human-readable schedule label.
 */
export function getScheduleLabel(cron: string | null): string {
  if (!cron) return "Manual";

  // Parse common presets
  if (cron === "0 * * * *") return "Hourly";
  if (cron === "0 9 * * *") return "Daily";
  if (cron === "0 9 * * 1") return "Weekly";

  return "Custom";
}
