import {
  Bot,
  Clock,
  FileText,
  Globe,
  Layers,
  Share2,
  Shield,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { InviteForm } from "@/components/marketing/invite-form";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container flex flex-col items-center gap-4 pb-8 pt-6 md:py-10">
        <div className="flex max-w-[980px] flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
            Automate your web research
            <br className="hidden sm:inline" />
            with Intelligent Agents
          </h1>
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Create custom agents that automatically read web pages, analyze
            content with AI, and deliver structured insights directly to your
            Google Sheets.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <InviteForm />
          <div className="flex gap-4 items-center">
            <span className="text-sm text-muted-foreground">
              Already have access?
            </span>
            <Button variant="link" size="sm" asChild className="px-0">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite only. Request access to join.
        </p>
      </section>

      {/* Features Section */}
      <section className="container py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
            Features
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Everything you need to build intelligent data gathering workflows.
          </p>
        </div>
        <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3 lg:gap-6 mt-8">
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Intelligent Agents</h3>
              <p className="text-sm text-muted-foreground">
                Define custom instructions for agents to gather and extract
                precisely the data you need.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Web Reader</h3>
              <p className="text-sm text-muted-foreground">
                Automatically read and parse any public web page, from news
                sites to complex directories.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">AI Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Process gathered content with advanced LLMs to extract
                structured facts and deep insights.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Automated Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Set up recurring schedules (daily, weekly) to keep your datasets
                constantly updated.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Google Sheets Integration</h3>
              <p className="text-sm text-muted-foreground">
                Automatically append every new report as a structured row in
                your Google Drive spreadsheets.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Invite team members and manage permissions to work together on
                intelligence workflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container py-8 md:py-12 lg:py-24 bg-muted/50">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
            How It Works
          </h2>
        </div>
        <div className="mx-auto grid max-w-5xl gap-8 py-12 lg:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              1
            </div>
            <h3 className="mt-4 text-xl font-bold">Define Instructions</h3>
            <p className="mt-2 text-muted-foreground">
              Add your sources (URLs or other agents) and provide clear
              instructions for what to extract.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              2
            </div>
            <h3 className="mt-4 text-xl font-bold">Set a Schedule</h3>
            <p className="mt-2 text-muted-foreground">
              Choose your frequency—daily or weekly—and let the platform handle
              the heavy lifting.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              3
            </div>
            <h3 className="mt-4 text-xl font-bold">Automate Results</h3>
            <p className="mt-2 text-muted-foreground">
              Watch as your Google Sheets are automatically updated with fresh,
              structured intelligence.
            </p>
          </div>
        </div>
      </section>

      {/* Intelligence Chaining Section */}
      <section className="container py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
            Go Deeper with Chaining
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Mosaic AI allows you to build complex research workflows by
            connecting agents together.
          </p>
        </div>
        <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] mt-8">
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Recursive Research</h3>
              <p className="text-sm text-muted-foreground">
                Use the output of one agent as the source for another. Build a
                hierarchy of intelligence where broad discovery feeds into deep,
                specialized analysis.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Share2 className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Fact Triangulation</h3>
              <p className="text-sm text-muted-foreground">
                Cross-verify critical facts across multiple sources. Our
                chaining engine ensures high-confidence data by triangulating
                information from diverse origins.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-8 md:py-12 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-5xl">
            Ready to get started?
          </h2>
          <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
            Join our invite-only platform and start building your intelligence
            gathering workflows today.
          </p>
          <div className="mt-4 w-full flex justify-center">
            <InviteForm />
          </div>
        </div>
      </section>
    </div>
  );
}
