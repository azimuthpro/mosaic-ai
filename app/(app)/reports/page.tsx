import { Bot, FileText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllReports } from "@/lib/actions/reports";
import { formatDateTime } from "@/lib/utils";

export default async function ReportsPage() {
  const reports = await getAllReports();

  return (
    <div className="space-y-6">
      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No reports yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Run your agents to generate analysis reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">
                          {(report.agent as { name: string } | null)?.name ||
                            "Unknown Agent"}
                        </CardTitle>
                        <CardDescription>
                          {formatDateTime(report.created_at)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline">{report.format}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.source_urls?.length || 0} sources analyzed
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
