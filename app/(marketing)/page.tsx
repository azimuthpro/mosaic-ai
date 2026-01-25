import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Bot, Globe, Sparkles, Clock, FileText, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container flex flex-col items-center gap-4 pb-8 pt-6 md:py-10">
        <div className="flex max-w-[980px] flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
            Automated Intelligence Gathering
            <br className="hidden sm:inline" />
            Powered by AI
          </h1>
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Create agents that automatically scrape web pages, analyze content with AI,
            and deliver structured insights on your schedule.
          </p>
        </div>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
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
                Create custom agents with specific instructions to gather and analyze the data you need.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Web Scraping</h3>
              <p className="text-sm text-muted-foreground">
                Automatically scrape any public web page and extract the content you care about.
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
                Process scraped content with Google Gemini to extract structured insights.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Scheduled Runs</h3>
              <p className="text-sm text-muted-foreground">
                Set up daily or weekly schedules to automatically run your agents.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Structured Reports</h3>
              <p className="text-sm text-muted-foreground">
                Get results as text, lists, tables, or JSON - whatever format works best for you.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border bg-background p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">
                Your data is protected with enterprise-grade security and never shared.
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
            <h3 className="mt-4 text-xl font-bold">Create an Agent</h3>
            <p className="mt-2 text-muted-foreground">
              Define your agent with source URLs and instructions for what data to extract.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              2
            </div>
            <h3 className="mt-4 text-xl font-bold">Set a Schedule</h3>
            <p className="mt-2 text-muted-foreground">
              Choose when your agent should run - daily, weekly, or on-demand.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              3
            </div>
            <h3 className="mt-4 text-xl font-bold">Get Reports</h3>
            <p className="mt-2 text-muted-foreground">
              Receive structured analysis results automatically delivered to your dashboard.
            </p>
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
            Join our invite-only platform and start building your intelligence gathering workflows today.
          </p>
          <Button asChild size="lg" className="mt-4">
            <Link href="/signup">Request Access</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
