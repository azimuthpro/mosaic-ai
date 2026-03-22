import { Octokit } from "octokit";

export interface GitHubIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

export interface GitHubIssueResult {
  number: number;
  url: string;
  title: string;
}

export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  issue: GitHubIssueInput,
): Promise<GitHubIssueResult> {
  const octokit = new Octokit({ auth: token });
  return createIssueWithClient(octokit, owner, repo, issue);
}

export async function createGitHubIssues(
  token: string,
  owner: string,
  repo: string,
  issues: GitHubIssueInput[],
): Promise<GitHubIssueResult[]> {
  const octokit = new Octokit({ auth: token });
  const results: GitHubIssueResult[] = [];

  for (const issue of issues) {
    results.push(await createIssueWithClient(octokit, owner, repo, issue));
  }

  return results;
}

async function createIssueWithClient(
  octokit: Octokit,
  owner: string,
  repo: string,
  issue: GitHubIssueInput,
): Promise<GitHubIssueResult> {
  const response = await octokit.rest.issues.create({
    owner,
    repo,
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
  });

  return {
    number: response.data.number,
    url: response.data.html_url,
    title: response.data.title,
  };
}
