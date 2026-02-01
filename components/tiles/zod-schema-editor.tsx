"use client";

import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ZodSchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SCHEMA_TEMPLATES = {
  simple: {
    name: "Simple Object",
    description: "Basic key-value pairs",
    schema: `z.object({
  title: z.string(),
  summary: z.string(),
  key_points: z.array(z.string()),
})`,
  },
  news: {
    name: "News Articles",
    description: "List of news items with metadata",
    schema: `z.object({
  articles: z.array(z.object({
    title: z.string(),
    source: z.string(),
    date: z.string(),
    summary: z.string(),
    url: z.string().optional(),
  })),
  overall_sentiment: z.enum(["positive", "negative", "neutral"]),
})`,
  },
  table: {
    name: "Data Table",
    description: "Structured tabular data",
    schema: `z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  metadata: z.object({
    total_rows: z.number(),
    generated_at: z.string(),
  }).optional(),
})`,
  },
  analysis: {
    name: "Analysis Report",
    description: "Detailed analysis with insights",
    schema: `z.object({
  topic: z.string(),
  findings: z.array(z.object({
    insight: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    sources: z.array(z.string()),
  })),
  recommendations: z.array(z.string()),
})`,
  },
};

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const VALID_ZOD_METHODS = new Set([
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "enum",
  "optional",
  "nullable",
  "union",
  "literal",
  "any",
  "unknown",
  "date",
]);

const BRACKET_PAIRS: Record<string, number> = {
  "(": 1,
  ")": -1,
  "{": 1,
  "}": -1,
  "[": 1,
  "]": -1,
};

function checkBalancedBrackets(text: string): string | null {
  const counts = { paren: 0, brace: 0, bracket: 0 };
  const typeMap: Record<string, keyof typeof counts> = {
    "(": "paren",
    ")": "paren",
    "{": "brace",
    "}": "brace",
    "[": "bracket",
    "]": "bracket",
  };

  for (const char of text) {
    const delta = BRACKET_PAIRS[char];
    if (delta !== undefined) {
      counts[typeMap[char]] += delta;
      if (counts[typeMap[char]] < 0) {
        return "Unbalanced brackets or parentheses";
      }
    }
  }

  if (counts.paren !== 0) return "Unbalanced parentheses";
  if (counts.brace !== 0) return "Unbalanced curly braces";
  if (counts.bracket !== 0) return "Unbalanced square brackets";
  return null;
}

function validateZodSchema(schema: string): ValidationResult {
  const trimmed = schema.trim();
  if (!trimmed) {
    return { valid: true };
  }

  if (!trimmed.startsWith("z.object") && !trimmed.startsWith("z.array")) {
    return {
      valid: false,
      error: "Schema must start with z.object() or z.array()",
    };
  }

  const bracketError = checkBalancedBrackets(trimmed);
  if (bracketError) {
    return { valid: false, error: bracketError };
  }

  const zPatterns = trimmed.match(/z\.(\w+)\(/g) || [];
  for (const pattern of zPatterns) {
    const methodName = pattern.match(/z\.(\w+)\(/)?.[1];
    if (methodName && !VALID_ZOD_METHODS.has(methodName)) {
      return { valid: false, error: `Unknown Zod method: z.${methodName}()` };
    }
  }

  return { valid: true };
}

export function ZodSchemaEditor({
  value,
  onChange,
  disabled,
}: ZodSchemaEditorProps) {
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  const validation = useMemo(() => validateZodSchema(value), [value]);

  const handleTemplateSelect = useCallback(
    (templateKey: keyof typeof SCHEMA_TEMPLATES) => {
      onChange(SCHEMA_TEMPLATES[templateKey].schema);
      setIsTemplatesOpen(false);
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Output Schema (Zod)</Label>
        {value.trim() && (
          <div className="flex items-center gap-1.5 text-xs">
            {validation.valid ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Valid</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-400">{validation.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`z.object({
  title: z.string(),
  items: z.array(z.string()),
})`}
        rows={6}
        className="font-mono text-sm"
        disabled={disabled}
      />

      <Collapsible open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-muted-foreground hover:text-foreground"
          >
            <span>Use a template</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isTemplatesOpen ? "rotate-180" : ""}`}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid gap-2">
            {Object.entries(SCHEMA_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() =>
                  handleTemplateSelect(key as keyof typeof SCHEMA_TEMPLATES)
                }
                className="rounded-lg border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                disabled={disabled}
              >
                <p className="text-sm font-medium">{template.name}</p>
                <p className="text-xs text-muted-foreground">
                  {template.description}
                </p>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className="text-xs text-muted-foreground">
        Define a Zod schema to structure the AI output. The schema guides the
        LLM to produce valid JSON matching your specification.
      </p>
    </div>
  );
}
