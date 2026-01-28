import { ArrowLeft, Bot, Clock, Globe } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportViewer } from "@/components/reports/report-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getReport } from "@/lib/actions/reports";
import { formatDateTime } from "@/lib/utils";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    notFound();
  }

  const agent = report.agent as { id: string; name: string } | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/reports">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Report</h1>
            <Badge variant="outline">{report.format}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground pl-10">
            <span className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              {agent?.name || "Unknown Agent"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDateTime(report.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              {report.source_urls?.length || 0} sources
            </span>
          </div>
        </div>
        {agent && (
          <Button variant="outline" asChild>
            <Link href={`/agents/${agent.id}`}>View Agent</Link>
          </Button>
        )}
      </div>

      {/* Source URLs */}
      {report.source_urls && report.source_urls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sources</CardTitle>
            <CardDescription>URLs analyzed in this report</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {report.source_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {new URL(url).hostname}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportViewer content={report.content} format={report.format} />
        </CardContent>
      </Card>
    </div>
  );
}
