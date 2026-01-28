import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Globe,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentSettings } from "@/components/agents/agent-settings";
import { RunAgentButton } from "@/components/agents/run-agent-button";
import { SourceList } from "@/components/agents/source-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAgent } from "@/lib/actions/agents";
import { getJobsForAgent } from "@/lib/actions/jobs";
import { getReportsForAgent } from "@/lib/actions/reports";
import {
  cronToSchedule,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/utils";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(id);

  if (!agent) {
    notFound();
  }

  const jobs = await getJobsForAgent(id);
  const reports = await getReportsForAgent(id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
            <Badge variant={agent.is_active ? "success" : "secondary"}>
              {agent.is_active ? "Active" : "Paused"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground pl-10">
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              {agent.sources?.length || 0} sources
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {cronToSchedule(agent.schedule_cron)}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              {agent.output_format} format
            </span>
          </div>
        </div>
        <RunAgentButton agentId={agent.id} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>History of agent runs</CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No jobs yet. Run the agent to see results.
                </p>
              ) : (
                <div className="space-y-3">
                  {jobs.slice(0, 10).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {job.status === "completed" && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {job.status === "failed" && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {job.status === "processing" && (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        )}
                        {job.status === "pending" && (
                          <Clock className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {job.status}
                          </p>
                          {job.error_message && (
                            <p className="text-xs text-destructive">
                              {job.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(job.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <SourceList agentId={agent.id} sources={agent.sources || []} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                Analysis results from agent runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No reports yet. Run the agent to generate reports.
                </p>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <Link
                      key={report.id}
                      href={`/reports/${report.id}`}
                      className="block"
                    >
                      <div className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              Report from {formatDateTime(report.created_at)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Format: {report.format}
                            </p>
                          </div>
                          <Badge variant="outline">{report.format}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <AgentSettings agent={agent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
