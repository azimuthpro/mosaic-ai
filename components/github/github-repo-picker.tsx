"use client";

import { Loader2, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GitHubRepoItem {
  owner: string;
  repo: string;
  full_name: string;
  private?: boolean;
}

interface GitHubRepoPickerProps {
  repos: GitHubRepoItem[];
  onChange: (repos: GitHubRepoItem[]) => void;
  maxRepos: number;
  disabled?: boolean;
}

export function GitHubRepoPicker({
  repos: selectedRepos,
  onChange,
  maxRepos,
  disabled,
}: GitHubRepoPickerProps) {
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/repos")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Failed to load repositories");
          return;
        }
        const body = await res.json();
        const repos = (body.repos ?? []) as {
          owner: string;
          name: string;
          full_name: string;
          private: boolean;
        }[];
        setAvailableRepos(
          repos.map((r) => ({
            owner: r.owner,
            repo: r.name,
            full_name: r.full_name,
            private: r.private,
          })),
        );
      })
      .catch(() => setError("Failed to load repositories"))
      .finally(() => setLoading(false));
  }, []);

  const selectedNames = new Set(selectedRepos.map((r) => r.full_name));
  const unselectedRepos = availableRepos.filter(
    (r) => !selectedNames.has(r.full_name),
  );
  const isLimitReached = selectedRepos.length >= maxRepos;

  function handleAdd(fullName: string) {
    const repo = availableRepos.find((r) => r.full_name === fullName);
    if (repo && !selectedNames.has(fullName)) {
      onChange([...selectedRepos, repo]);
    }
  }

  function handleRemove(fullName: string) {
    onChange(selectedRepos.filter((r) => r.full_name !== fullName));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading repositories...
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  if (availableRepos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No repositories found. Connect your GitHub account first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {selectedRepos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedRepos.map((r) => (
            <Badge
              key={r.full_name}
              variant="secondary"
              className="flex items-center gap-1.5 pr-1"
            >
              <span>{r.full_name}</span>
              {r.private && <Lock className="h-3 w-3 text-muted-foreground" />}
              <button
                type="button"
                onClick={() => handleRemove(r.full_name)}
                disabled={disabled}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {!isLimitReached && unselectedRepos.length > 0 && (
        <Select value="" onValueChange={handleAdd} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Add a repository..." />
          </SelectTrigger>
          <SelectContent>
            {unselectedRepos.map((r) => (
              <SelectItem key={r.full_name} value={r.full_name}>
                {r.full_name}
                {r.private && " (private)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedRepos.length}/{maxRepos} repositories selected
      </p>
    </div>
  );
}
