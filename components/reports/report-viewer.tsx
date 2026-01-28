"use client";

import type { Json, OutputFormat } from "@/types/database";

interface ReportViewerProps {
  content: Json;
  format: OutputFormat;
}

export function ReportViewer({ content, format }: ReportViewerProps) {
  if (!content) {
    return <p className="text-muted-foreground">No content available.</p>;
  }

  // Safely cast content
  const data = content as Record<string, unknown>;

  // Text format
  if (format === "text" || data.text) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <p className="whitespace-pre-wrap">{String(data.text || data)}</p>
      </div>
    );
  }

  // List format
  if (format === "list" || data.items) {
    const items = (data.items as string[]) || [];
    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Table format
  if (format === "table" || (data.headers && data.rows)) {
    const headers = (data.headers as string[]) || [];
    const rows = (data.rows as string[][]) || [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-2 text-left font-medium text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // JSON format (or fallback)
  return (
    <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
      <code>{JSON.stringify(content, null, 2)}</code>
    </pre>
  );
}
