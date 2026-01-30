"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UrlListInputProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function UrlListInput({ urls, onChange, disabled }: UrlListInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addUrl = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Basic URL validation
    let url = trimmed;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    try {
      new URL(url);
      if (!urls.includes(url)) {
        onChange([...urls, url]);
      }
      setInputValue("");
    } catch {
      // Invalid URL, don't add
    }
  };

  const removeUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addUrl();
    }
  };

  return (
    <div className="space-y-3">
      <Label>URLs to Monitor</Label>
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com/page"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addUrl}
          disabled={disabled || !inputValue.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {urls.length > 0 && (
        <div className="space-y-2">
          {urls.map((url, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2"
            >
              <span className="flex-1 truncate text-sm">{url}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => removeUrl(index)}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {urls.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add at least one URL to monitor. Press Enter or click + to add.
        </p>
      )}
    </div>
  );
}
