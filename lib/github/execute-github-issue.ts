import type { SupabaseClient } from "@supabase/supabase-js";

import { analyzeContent } from "@/lib/ai/gemini";
import { getMosaicTimezone } from "@/lib/mosaics/timezone";
import type {
  Database,
  GitHubIssueConfig,
  Json,
  LanguageCode,
} from "@/types/database";

import {
  createGitHubIssues,
  type GitHubIssueInput,
  type GitHubIssueResult,
} from "./create-issue";
import { resolveGitHubToken } from "./integration";

export interface GitHubIssueExecutionResult {
  jobResultContent: Json;
  slackSummary: string;
  createdIssues: GitHubIssueResult[];
}

/**
 * Normalizes legacy single-repo config to multi-repo format.
 */
export function normalizeGitHubConfig(
  config: GitHubIssueConfig,
): GitHubIssueConfig {
  if (config.repos?.length) return config;
  // Legacy format: { owner, repo }
  if (config.owner && config.repo) {
    return {
      ...config,
      repos: [{ owner: config.owner, repo: config.repo }],
    };
  }
  return { ...config, repos: [] };
}

/**
 * Executes a github_issue tile: sends input content to AI with the tile's prompt,
 * extracts structured issue data from the response, and creates issues on GitHub.
 */
export async function executeGitHubIssue(
  tileId: string,
  fetchedContent: string[],
  systemPrompt: string | null,
  adminClient: SupabaseClient<Database>,
  githubConfig: GitHubIssueConfig,
  language: LanguageCode,
  targetRepo?: string,
): Promise<GitHubIssueExecutionResult> {
  const config = normalizeGitHubConfig(githubConfig);

  if (config.repos.length === 0) {
    throw new Error("No repositories configured for this GitHub issue tile");
  }

  // Resolve target repo
  let target: { owner: string; repo: string };
  if (targetRepo) {
    const found = config.repos.find(
      (r) => `${r.owner}/${r.repo}` === targetRepo,
    );
    if (!found) {
      throw new Error(
        `Repository "${targetRepo}" is not configured on this tile. Available: ${config.repos.map((r) => `${r.owner}/${r.repo}`).join(", ")}`,
      );
    }
    target = found;
  } else {
    target = config.repos[0];
  }

  const tokenResult = await resolveGitHubToken(adminClient, tileId);
  if (!tokenResult.ok) {
    throw new Error(tokenResult.reason);
  }

  const issuePrompt = buildIssuePrompt(systemPrompt);
  const timezone = await getMosaicTimezone(adminClient, tileId);

  const analysis = await analyzeContent(
    fetchedContent,
    issuePrompt,
    "json",
    language,
    null,
    timezone,
  );

  if (!analysis.success) {
    throw new Error(
      analysis.error || "AI analysis failed for issue generation",
    );
  }

  const issues = parseIssuesFromResponse(
    analysis.content,
    config.default_labels,
  );

  if (issues.length === 0) {
    return {
      jobResultContent: {
        issues: [],
        message: "No issues were generated from the analysis.",
      },
      slackSummary: "No issues generated.",
      createdIssues: [],
    };
  }

  const createdIssues = await createGitHubIssues(
    tokenResult.token,
    target.owner,
    target.repo,
    issues,
  );

  const repoFullName = `${target.owner}/${target.repo}`;
  const summary = createdIssues
    .map((issue) => `#${issue.number}: ${issue.title}`)
    .join("\n");

  return {
    jobResultContent: {
      repo: repoFullName,
      issues_created: createdIssues.length,
      issues: createdIssues.map(({ number, title, url }) => ({
        number,
        title,
        url,
      })),
    },
    slackSummary: `Created ${createdIssues.length} issue(s) on ${repoFullName}:\n${summary}`,
    createdIssues,
  };
}

function buildIssuePrompt(userPrompt: string | null): string {
  const structuredOutputInstruction = `You MUST return a JSON object with an "issues" array. Each issue must have "title" (string), "body" (string, markdown), and optionally "labels" (string array).

Example response format:
{
  "issues": [
    {
      "title": "Issue title here",
      "body": "## Description\\nDetailed description...",
      "labels": ["bug"]
    }
  ]
}`;

  if (!userPrompt) return structuredOutputInstruction;

  return `${userPrompt}\n\n---\n\n${structuredOutputInstruction}`;
}

function parseIssuesFromResponse(
  content: Json,
  defaultLabels?: string[],
): GitHubIssueInput[] {
  if (!content || typeof content !== "object") return [];

  const obj = content as Record<string, Json>;

  // Handle { issues: [...] } format
  let rawIssues: Json[];
  if (Array.isArray(obj.issues)) {
    rawIssues = obj.issues;
  } else if (obj.title && obj.body) {
    // Single issue returned directly
    rawIssues = [obj];
  } else {
    // Try to find an array property
    const arrayProp = Object.values(obj).find(Array.isArray);
    rawIssues = arrayProp ? (arrayProp as Json[]) : [];
  }

  return rawIssues
    .filter(
      (item): item is Record<string, Json> =>
        item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .filter(
      (item) => typeof item.title === "string" && typeof item.body === "string",
    )
    .map((item) => {
      const labels = Array.isArray(item.labels)
        ? (item.labels as string[])
        : [];

      return {
        title: item.title as string,
        body: item.body as string,
        labels: [...new Set([...labels, ...(defaultLabels ?? [])])],
      };
    });
}
