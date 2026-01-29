import {
  Bot,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAgents, getSharedAgents } from "@/lib/actions/agents";
import { getRecentJobs } from "@/lib/actions/jobs";
import { cronToSchedule, formatRelativeTime } from "@/lib/utils";

export default async function DashboardPage() {
  const [agents, sharedAgents, recentJobs] = await Promise.all([
    getAgents(),
    getSharedAgents(),
    getRecentJobs(5),
  ]);

  const activeAgents = agents.filter((a) => a.is_active).length;
  const totalSources = agents.reduce(
    (acc, a) => acc + (a.sources?.length || 0),
    0,
  );

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeAgents} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSources}</div>
            <p className="text-xs text-muted-foreground">
              URLs being monitored
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Jobs</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentJobs.length}</div>
            <p className="text-xs text-muted-foreground">In the last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Agents</CardTitle>
          <CardDescription>
            Manage your intelligence gathering agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bot className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No agents yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first agent to start gathering intelligence.
              </p>
              <Button asChild className="mt-4">
                <Link href="/agents/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Agent
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{agent.name}</h3>
                        <Badge
                          variant={agent.is_active ? "success" : "secondary"}
                        >
                          {agent.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{agent.sources?.length || 0} sources</span>
                        <span>{cronToSchedule(agent.schedule_cron)}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {formatRelativeTime(agent.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shared with me */}
      {sharedAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Shared with Me
            </CardTitle>
            <CardDescription>
              Agents that others have shared with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sharedAgents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{agent.name}</h3>
                        <Badge
                          variant={agent.is_active ? "success" : "secondary"}
                        >
                          {agent.is_active ? "Active" : "Paused"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <Users className="h-3 w-3" />
                          Shared
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{agent.sources?.length || 0} sources</span>
                        <span>{cronToSchedule(agent.schedule_cron)}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {formatRelativeTime(agent.created_at)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Latest agent execution history.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
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
                      <p className="font-medium">
                        {job.agent?.name || "Unknown Agent"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {job.status === "failed"
                          ? job.error_message
                          : `Status: ${job.status}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatRelativeTime(job.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
