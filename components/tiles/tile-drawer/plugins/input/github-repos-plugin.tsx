"use client";

import { GitBranch, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import {
  type GitHubRepoItem,
  GitHubRepoPicker,
} from "@/components/github/github-repo-picker";
import { Button } from "@/components/ui/button";
import { updateTile } from "@/lib/actions/tiles";
import { normalizeGitHubConfig } from "@/lib/github/execute-github-issue";
import type { GitHubIssueConfig, TileWithSources } from "@/types/database";

import { PluginCard } from "../plugin-card";

interface GitHubReposPluginProps {
  tile: TileWithSources;
  disabled?: boolean;
}

function configToRepoItems(config: GitHubIssueConfig): GitHubRepoItem[] {
  const normalized = normalizeGitHubConfig(config);
  return normalized.repos.map((r) => ({
    owner: r.owner,
    repo: r.repo,
    full_name: `${r.owner}/${r.repo}`,
  }));
}

export function GitHubReposPlugin({ tile, disabled }: GitHubReposPluginProps) {
  const config = (tile.config as GitHubIssueConfig | null) ?? { repos: [] };
  const savedRepos = configToRepoItems(config);
  const savedKey = JSON.stringify(savedRepos.map((r) => r.full_name).sort());

  const [repos, setRepos] = useState<GitHubRepoItem[]>(savedRepos);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setRepos(savedRepos);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  function handleChange(newRepos: GitHubRepoItem[]) {
    setRepos(newRepos);
    const newKey = JSON.stringify(newRepos.map((r) => r.full_name).sort());
    setIsDirty(newKey !== savedKey);
  }

  async function handleSave() {
    setIsSaving(true);
    const mergedConfig = {
      ...config,
      repos: repos.map((r) => ({ owner: r.owner, repo: r.repo })),
    };
    const result = await updateTile(tile.id, { config: mergedConfig });
    setIsSaving(false);
    if (result.error) {
      alert(result.error);
    } else {
      setIsDirty(false);
    }
  }

  return (
    <PluginCard
      id="github-repos"
      title="Repositories"
      description="GitHub repositories for issue creation"
      icon={<GitBranch className="h-4 w-4 text-cyan-400" />}
      section="input"
      badge={
        repos.length > 0
          ? { text: `${repos.length} repo${repos.length !== 1 ? "s" : ""}` }
          : undefined
      }
    >
      <div className="space-y-3">
        <GitHubRepoPicker
          repos={repos}
          onChange={handleChange}
          maxRepos={10}
          disabled={disabled || isSaving}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={disabled || isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isSaving ? "Saving..." : "Save Repos"}
          </Button>
        </div>
      </div>
    </PluginCard>
  );
}
