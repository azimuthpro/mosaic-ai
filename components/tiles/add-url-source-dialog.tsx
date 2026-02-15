"use client";

import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTileSource, updateTileSource } from "@/lib/actions/tiles";
import { MAX_URLS_PER_TILE } from "@/lib/constants/tiles";
import type { TileSource, TileWithSources } from "@/types/database";

type ExtractDepth = "basic" | "advanced";

interface AddUrlSourceDialogProps {
  tile: TileWithSources;
  mode: "add" | "edit";
  existingSource?: TileSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  isAccessible: boolean | null;
  error: string | null;
  pageTitle: string | null;
}

const INITIAL_VALIDATION: ValidationState = {
  isValidating: false,
  isValid: null,
  isAccessible: null,
  error: null,
  pageTitle: null,
};

function formatUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function AddUrlSourceDialog({
  tile,
  mode,
  existingSource,
  open,
  onOpenChange,
  onSuccess,
}: AddUrlSourceDialogProps): React.JSX.Element {
  const isEditing = mode === "edit" && existingSource != null;

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [extractDepth, setExtractDepth] = useState<ExtractDepth>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasManuallyEditedName, setHasManuallyEditedName] = useState(false);
  const [validationState, setValidationState] =
    useState<ValidationState>(INITIAL_VALIDATION);
  const [isManuallyValidating, setIsManuallyValidating] = useState(false);

  // Reset form when dialog opens or mode/source changes
  useEffect(() => {
    if (!open) return;

    if (isEditing) {
      setUrl(existingSource.url || "");
      setName(existingSource.name || "");
      const config = existingSource.config as { extract_depth?: string } | null;
      setExtractDepth((config?.extract_depth as ExtractDepth) || "basic");
    } else {
      setUrl("");
      setName("");
      setExtractDepth("basic");
    }

    setSubmitError(null);
    setHasManuallyEditedName(false);
    setValidationState(INITIAL_VALIDATION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, existingSource?.id]);

  // Debounced URL validation
  useEffect(() => {
    const formattedUrl = formatUrl(url);
    if (!formattedUrl) {
      setValidationState(INITIAL_VALIDATION);
      return;
    }

    setValidationState((prev) => ({
      ...prev,
      isValidating: true,
      error: null,
    }));

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch("/api/v1/sources/validate-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: formattedUrl }),
        });

        const result = await response.json();

        setValidationState({
          isValidating: false,
          isValid: result.isValid,
          isAccessible: result.isAccessible ?? null,
          error: result.error || null,
          pageTitle: result.pageTitle || null,
        });

        if (result.pageTitle && !hasManuallyEditedName) {
          setName(result.pageTitle);
        }
      } catch {
        setValidationState({
          isValidating: false,
          isValid: false,
          isAccessible: null,
          error: "Failed to validate URL",
          pageTitle: null,
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [url, hasManuallyEditedName]);

  // Manual validation retry
  async function handleManualValidation(): Promise<void> {
    const formattedUrl = formatUrl(url);
    if (!formattedUrl) return;

    setIsManuallyValidating(true);
    setValidationState((prev) => ({
      ...prev,
      isValidating: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/v1/sources/validate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formattedUrl }),
      });

      const result = await response.json();

      setValidationState({
        isValidating: false,
        isValid: result.isValid,
        isAccessible: result.isAccessible ?? null,
        error: result.error || null,
        pageTitle: result.pageTitle || null,
      });

      if (result.pageTitle && !hasManuallyEditedName) {
        setName(result.pageTitle);
      }
    } catch {
      setValidationState({
        isValidating: false,
        isValid: false,
        isAccessible: null,
        error: "Failed to validate URL",
        pageTitle: null,
      });
    } finally {
      setIsManuallyValidating(false);
    }
  }

  async function handleSubmit(
    e: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const formattedUrl = formatUrl(url);
    const trimmedName = name.trim() || undefined;

    const result = isEditing
      ? await updateTileSource(existingSource.id, {
          url: formattedUrl,
          name: trimmedName,
          config: { extract_depth: extractDepth },
        })
      : await addTileSource({
          tileId: tile.id,
          type: "url",
          url: formattedUrl,
          name: trimmedName,
          urlConfig: { extract_depth: extractDepth },
        });

    if (result.error) {
      setSubmitError(result.error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSuccess?.();
    onOpenChange(false);
  }

  function handleOpenChange(newOpen: boolean): void {
    if (!isSubmitting) {
      onOpenChange(newOpen);
    }
  }

  const urlSourceCount =
    tile.sources?.filter((s) => s.type === "url").length || 0;
  const isAtLimit = mode === "add" && urlSourceCount >= MAX_URLS_PER_TILE;

  const canSubmit =
    !isSubmitting &&
    url.trim() !== "" &&
    validationState.isValid === true &&
    !validationState.isValidating &&
    !isAtLimit;

  function getSubmitLabel(): string {
    if (isSubmitting) {
      return mode === "add" ? "Adding..." : "Saving...";
    }
    return mode === "add" ? "Add Source" : "Save Changes";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add URL Source" : "Edit URL Source"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Add a web page to monitor. The URL will be validated and checked for accessibility."
              : "Update the URL source configuration."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {submitError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={isSubmitting}
              />
              {url.trim() !== "" && (
                <div className="pt-1">
                  <ValidationStatus
                    state={validationState}
                    onRecheck={handleManualValidation}
                    isRechecking={isManuallyValidating}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Page Title</Label>
              <Input
                id="name"
                type="text"
                placeholder="Page title (auto-fetched from URL)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasManuallyEditedName(true);
                }}
                disabled={isSubmitting}
              />
              {validationState.pageTitle && !hasManuallyEditedName && (
                <p className="text-xs text-muted-foreground">
                  Auto-fetched from page. You can edit if needed.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="extractDepth">Extract Depth</Label>
              <Select
                value={extractDepth}
                onValueChange={(value) =>
                  setExtractDepth(value as ExtractDepth)
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="extractDepth">
                  <SelectValue
                    placeholder="Select extract depth"
                    className="text-left"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex flex-col items-start">
                      <span>Basic</span>
                      <span className="text-xs text-muted-foreground">
                        Fast extraction of main content
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="advanced">
                    <div className="flex flex-col items-start">
                      <span>Advanced</span>
                      <span className="text-xs text-muted-foreground">
                        Detailed extraction including metadata
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "add" && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 mb-6 px-3 py-1 text-xs">
              <span className="text-muted-foreground">URL sources</span>
              <span
                className={
                  isAtLimit ? "font-medium text-amber-600" : "text-foreground"
                }
              >
                {urlSourceCount} / {MAX_URLS_PER_TILE}
              </span>
            </div>
          )}

          {isAtLimit && (
            <p className="text-sm text-amber-600">
              You&apos;ve reached the maximum limit of {MAX_URLS_PER_TILE} URL
              sources per tile. Remove an existing source to add a new one.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {getSubmitLabel()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ValidationStatusProps {
  state: ValidationState;
  onRecheck?: () => void;
  isRechecking?: boolean;
}

function ValidationStatus({
  state,
  onRecheck,
  isRechecking,
}: ValidationStatusProps): React.JSX.Element | null {
  if (state.isValidating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Validating URL...
      </div>
    );
  }

  if (state.isValid === true) {
    if (state.isAccessible === true) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          URL is valid and accessible
        </div>
      );
    }
    if (state.isAccessible === false) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            URL is valid but may be inaccessible (will try anyway)
          </div>
          {onRecheck && (
            <button
              type="button"
              onClick={onRecheck}
              disabled={isRechecking}
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRechecking ? "animate-spin" : ""}`}
              />
              {isRechecking ? "Re-checking..." : "Re-check accessibility"}
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  if (state.isValid === false) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <XCircle className="h-4 w-4" />
        {state.error || "Invalid URL"}
      </div>
    );
  }

  return null;
}
