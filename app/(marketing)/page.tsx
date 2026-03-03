import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Globe,
  Layers,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { InviteForm } from "@/components/marketing/invite-form";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex flex-col selection:bg-cyan-500/30">
      {/* Hero Section */}
      <section className="container max-w-6xl relative flex flex-col items-center gap-8 pb-16 pt-12 md:pt-20 lg:pt-32 overflow-hidden">
        {/* Deep Dark Background Elements */}
        <div className="absolute top-0 -z-10 h-full w-full bg-black">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[800px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px] opacity-50"></div>
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px] opacity-30"></div>
        </div>

        <div className="flex max-w-[980px] flex-col items-center gap-6 text-center">
          <Link
            href="#"
            className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/10 hover:border-cyan-500/40 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-linear-to-r from-cyan-500/0 via-white/5 to-cyan-500/0 -translate-x-full group-hover:animate-shimmer" />
            <Zap className="h-4 w-4 fill-current" />
            <span className="flex items-center gap-1.5">
              Private Beta <span className="text-white/20">•</span>{" "}
              <span className="text-slate-300">Intelligence Automation</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="text-balance text-5xl font-extrabold leading-[1.1] tracking-tight md:text-7xl lg:text-8xl text-white">
            Turn information chaos
            <br />
            <span className="bg-linear-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent italic">
              into action.
            </span>
          </h1>

          <p className="text-pretty max-w-[750px] text-lg text-slate-400 sm:text-xl lg:text-2xl leading-relaxed">
            Mosaic connects your scattered data sources — web pages, Slack
            channels, news feeds — into automated pipelines that deliver morning
            intelligence reports and concrete recommendations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mt-4">
          <Button
            asChild
            className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black h-14 px-10 rounded-2xl text-lg group transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-95"
          >
            <Link href="/signup">
              Create your first Mosaic
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
      </section>

      {/* Aha! Moment - Comparison Section */}
      <section className="container max-w-6xl py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center bg-slate-900/40 p-8 md:p-12 rounded-[2.5rem] border border-slate-800 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] pointer-events-none" />

          <div className="space-y-8 relative z-10">
            <h2 className="text-balance text-4xl font-black text-white leading-tight">
              Stop chasing information.
              <br />
              <span className="text-cyan-400 italic">
                Start receiving answers.
              </span>
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400 shrink-0">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <p className="text-pretty text-slate-400 text-lg">
                  Tasks get lost in Slack threads. Logs pile up. The big picture
                  drowns in noise across 5+ disconnected tools.
                </p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <p className="text-pretty text-slate-400 text-lg">
                  Mosaic connects the dots automatically — scraping pages,
                  reading Slack, tracking entities — and delivers a prioritized
                  morning report to your team.
                </p>
              </div>
            </div>
          </div>

          <div className="relative group perspective-1000">
            <div className="grid grid-cols-1 gap-4 lg:gap-8 translate-z-10 transition-transform duration-700">
              {/* Scattered Info */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-1 opacity-60 scale-95 blur-[2px] hover:blur-0 transition-all group-hover:opacity-40 select-none pointer-events-none">
                <div className="flex items-center gap-1.5 p-3 border-b border-slate-800/50 px-4">
                  <div className="h-2 w-2 rounded-full bg-red-500/50" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    Scattered Information
                  </span>
                </div>
                <pre className="p-4 font-mono text-[10px] text-slate-600 overflow-hidden leading-tight">
                  {`#dev-ops: "deployment failed at 3am"
#sales: "Acme Corp wants updated pricing"
Tab 12: competitor launched new feature
Email: investor update pending
// Who's connecting all this?`}
                </pre>
              </div>

              {/* Clean Mosaic Output */}
              <div className="relative -mt-12 lg:-mt-20 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950 shadow-2xl shadow-cyan-500/10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="flex items-center justify-between p-3 border-b border-cyan-500/10 bg-cyan-500/5 px-4 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5 ">
                    <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,1)]" />
                    <span className="text-cyan-400 uppercase tracking-widest font-bold font-mono">
                      Mosaic Intelligence Output
                    </span>
                  </div>
                  <span className="text-slate-500 uppercase tracking-widest text-[9px]">
                    JSON Format
                  </span>
                </div>
                <pre className="p-6 font-mono text-xs md:text-sm leading-relaxed overflow-x-auto bg-slate-950/50 transition-colors">
                  <div className="space-y-1">
                    <div>{"{"}</div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;tile&quot;
                      </span>
                      :{" "}
                      <span className="text-cyan-400">
                        &quot;Morning Intelligence&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;type&quot;
                      </span>
                      :{" "}
                      <span className="text-cyan-400">
                        &quot;analyzer&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;sources_processed&quot;
                      </span>
                      : <span className="text-cyan-400">5</span>,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;schedule&quot;
                      </span>
                      :{" "}
                      <span className="text-cyan-400">
                        &quot;daily at 8:00 AM&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;output_to&quot;
                      </span>
                      :{" "}
                      <span className="text-cyan-400">
                        &quot;#team-intel&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;recommendations&quot;
                      </span>
                      : <span className="text-cyan-400">3</span>
                    </div>
                    <div>{"}"}</div>
                  </div>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="container max-w-6xl py-24">
        <div className="mx-auto flex flex-col items-center gap-4 text-center mb-16 px-4">
          <h2 className="text-balance text-3xl font-black tracking-tighter sm:text-6xl text-white">
            Automate{" "}
            <span className="text-cyan-400 underline decoration-cyan-500/20 underline-offset-8">
              Intelligence.
            </span>
          </h2>
          <p className="text-pretty text-slate-500 text-lg max-w-2xl">
            Five tile types, connected pipelines, and AI-powered analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
          {/* Large Card: Five Tile Types */}
          <div className="md:col-span-3 lg:col-span-7 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 lg:p-12 transition-all hover:bg-slate-900/80 group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 text-slate-700/50 group-hover:text-cyan-500/20 transition-colors">
              <Layers className="h-32 w-32 rotate-12" />
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
                <Zap className="h-6 w-6 fill-current" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">
                Five tile types for every source.
              </h3>
              <p className="text-pretty text-slate-400 leading-relaxed text-lg flex-1">
                URL Reader scrapes web pages. Web Search finds what you need.
                Analyzer processes data with AI. Slack Reader pulls from your
                channels. Catalog tracks entities over time.
              </p>
              <div className="mt-8 pt-8 border-t border-slate-800/50 flex gap-4 overflow-hidden flex-wrap">
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  URL_READER
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  WEB_SEARCH
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  ANALYZER
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  SLACK_READER
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  CATALOG
                </div>
              </div>
            </div>
          </div>

          {/* Tall Card: Tile Connections */}
          <div className="md:col-span-3 lg:col-span-5 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 lg:p-12 transition-all hover:bg-slate-900/80 overflow-hidden group">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
              <Globe className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">
              Connect tiles into pipelines.
            </h3>
            <p className="text-pretty text-slate-400 leading-relaxed text-lg mb-8">
              Any-to-any connections with automatic extraction — URLs, keywords,
              or full reports. Downstream tiles auto-trigger when sources update.
            </p>
            <div className="relative h-32 w-full bg-slate-950/50 rounded-2xl border border-slate-800 p-4">
              <div className="space-y-3">
                <div className="h-2 w-3/4 bg-cyan-500/20 rounded shadow-[0_0_10px_rgba(34,211,238,0.1)]" />
                <div className="h-2 w-1/2 bg-cyan-500/20 rounded" />
                <div className="h-2 w-2/3 bg-slate-800 rounded animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <CheckCircle2 className="h-12 w-12 text-cyan-400/20" />
              </div>
            </div>
          </div>

          {/* Square Card: AI-Powered Analysis */}
          <div className="md:col-span-3 lg:col-span-4 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              AI-Powered Analysis.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Google Gemini 3 Flash processes your data with custom instructions.
              Get text summaries or structured JSON output.
            </p>
          </div>

          {/* Square Card: Scheduled Execution */}
          <div className="md:col-span-3 lg:col-span-4 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group">
            <div className="h-12 w-12 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400 mb-8">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Scheduled Execution.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Run tiles manually, hourly, or on a custom cron schedule with
              specific hours and days. Timezone-aware per mosaic.
            </p>
          </div>

          {/* Square Card: Slack Integration */}
          <div className="md:col-span-6 lg:col-span-4 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 mb-8">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Slack Integration.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Connect via OAuth. Read messages from any channel. Deliver
              analysis results directly to your team&apos;s Slack.
            </p>
          </div>

          {/* Wide Card: AI Skills & Prompt Editor */}
          <div className="md:col-span-6 lg:col-span-8 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group relative overflow-hidden">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-6">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4">
                  AI Skills & Prompt Editor.
                </h3>
                <p className="text-pretty text-slate-400 leading-relaxed text-lg">
                  Built-in skills library with pre-built templates for news
                  monitoring, competitor analysis, price tracking, and more.
                  AI-powered prompt editor: describe what you want and get a
                  production-ready prompt. Community marketplace via skills.sh
                  coming soon.
                </p>
              </div>
              <div className="flex-1 w-full flex justify-end">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 w-full max-w-[300px]">
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-cyan-500/40 rounded shadow-[0_0_10px_rgba(34,211,238,0.2)]" />
                    <div className="h-2 w-2/3 bg-slate-800 rounded" />
                    <div className="h-2 w-5/6 bg-slate-800 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Last Square Card: API, Webhooks & Sharing */}
          <div className="md:col-span-6 lg:col-span-4 bg-cyan-500/5 rounded-[2.5rem] border border-cyan-500/20 p-8 transition-all hover:bg-cyan-500/10 group">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              API, Webhooks & Sharing.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              REST API with SSE streaming, webhook notifications, per-mosaic API
              keys, and role-based team access.
            </p>
          </div>
        </div>
      </section>

      {/* Code Section */}
      <section
        id="api"
        className="container max-w-6xl py-24 border-t border-slate-900"
      >
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-balance text-4xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              REST API.
              <br />
              <span className="text-cyan-400 italic">
                Real-time streaming.
              </span>
            </h2>
            <p className="text-pretty text-slate-400 text-lg leading-relaxed mb-8">
              Trigger any tile programmatically. Get streaming progress via
              Server-Sent Events. Manage API keys per mosaic.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                <span className="text-slate-300 font-medium">
                  Per-mosaic API keys
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                <span className="text-slate-300 font-medium">
                  Real-time Webhook Triggers
                </span>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -inset-1 rounded-3xl bg-linear-to-r from-cyan-500/20 to-teal-500/20 blur-2xl opacity-75"></div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl transition-transform group-hover:scale-[1.01] duration-500">
              <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-900/50 px-4 py-3 font-mono text-xs">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                </div>
                <span className="text-slate-500 uppercase tracking-widest text-[10px] font-bold italic">
                  Mosaic AI — Tile Execution API
                </span>
              </div>
              <div className="p-6 font-mono text-[11px] md:text-sm leading-relaxed text-slate-300 overflow-x-auto">
                <div className="space-y-1 text-slate-400">
                  <div>
                    <span className="text-slate-500 italic">
                      {"// Run a tile via API"}
                    </span>
                  </div>
                  <div>
                    <span className="text-pink-400 font-bold">curl</span>{" "}
                    <span className="text-cyan-400">-X POST</span> \
                  </div>
                  <div className="pl-4">
                    <span className="text-cyan-400">
                      https://app.mosaic.ai/api/v1/tiles/{"{tileId}"}/run
                    </span>{" "}
                    \
                  </div>
                  <div className="pl-4">
                    <span className="text-slate-500">-H</span>{" "}
                    <span className="text-cyan-400">
                      &quot;Authorization: Bearer msk_your_api_key&quot;
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-slate-500 italic">
                      {"// Server-Sent Events response"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-pink-400 font-bold">event:</span>{" "}
                    <span className="text-white">started</span>
                  </div>
                  <div>
                    <span className="text-pink-400 font-bold">data:</span>{" "}
                    <span className="text-cyan-400">
                      {
                        '{"job_id":"...","tile_id":"..."}'
                      }
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-pink-400 font-bold">event:</span>{" "}
                    <span className="text-white">result</span>
                  </div>
                  <div>
                    <span className="text-pink-400 font-bold">data:</span>{" "}
                    <span className="text-cyan-400">
                      {
                        '{"job_id":"...","report":{...}}'
                      }
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-pink-400 font-bold">event:</span>{" "}
                    <span className="text-white">done</span>
                  </div>
                  <div>
                    <span className="text-pink-400 font-bold">data:</span>{" "}
                    <span className="text-cyan-400">
                      {
                        '{"job_id":"..."}'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section
        id="use-cases"
        className="container max-w-6xl py-24 border-t border-slate-900"
      >
        <div className="mb-16">
          <h2 className="text-balance text-3xl font-black tracking-tight text-white sm:text-5xl text-left italic">
            Who builds with Mosaic?
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="relative p-10 rounded-[2.5rem] border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
            <Layers className="h-10 w-10 text-cyan-400 mb-8 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-black text-white mb-4">
              Close the Loop
            </h3>
            <p className="text-pretty text-sm text-slate-400 leading-relaxed mb-8">
              Collect streams from Slack, GitHub, and web sources. Get morning
              reports with concrete recommendations. Tasks from conversations
              get tracked and auto-resolved.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                SLACK_READER
              </span>
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                ANALYZER
              </span>
            </div>
          </div>

          <div className="relative p-10 rounded-[2.5rem] border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
            <Globe className="h-10 w-10 text-cyan-400 mb-8 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-black text-white mb-4">
              Market Monitoring
            </h3>
            <p className="text-pretty text-sm text-slate-400 leading-relaxed mb-8">
              Track competitors, news, and industry shifts. Catalog tiles build
              living databases of companies and people. Detect threats and
              opportunities before anyone else.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                CATALOG
              </span>
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                WEB_SEARCH
              </span>
            </div>
          </div>

          <div className="relative p-10 rounded-[2.5rem] border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
            <MessageSquare className="h-10 w-10 text-purple-400 mb-8 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-black text-white mb-4">
              Morning Intelligence
            </h3>
            <p className="text-pretty text-sm text-slate-400 leading-relaxed mb-8">
              Replace Slack scrolling with structured daily reports. Prioritized
              action items, flagged issues, and summarized discussions delivered
              to your channel every morning.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                SCHEDULED
              </span>
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                SLACK_OUTPUT
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="cta"
        className="container max-w-6xl pt-12 pb-24 md:pt-16 md:pb-40"
      >
        <div className="w-full flex flex-col items-center justify-center gap-12 text-center bg-slate-950/40 border border-slate-800 px-8 py-24 md:p-24 rounded-[3rem] md:rounded-[5rem] relative overflow-hidden backdrop-blur-xl transition-all hover:bg-slate-900/40 group">
          {/* Mercedes-style Horizon Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] pointer-events-none group-hover:bg-cyan-500/15 transition-colors" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-cyan-500/50 to-transparent opacity-30" />

          <h2 className="text-balance text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl text-white group-hover:scale-[1.01] transition-transform duration-700 leading-tight">
            Ready to turn chaos into action?
          </h2>
          <p className="text-pretty max-w-[600px] text-slate-400 text-xl md:text-2xl leading-relaxed font-bold">
            Start building intelligence pipelines in minutes. No credit card
            required.
          </p>
          <div className="w-full flex justify-center max-w-2xl">
            <InviteForm />
          </div>
          <div className="pt-4 flex flex-col items-center gap-4">
            <p className="text-[10px] text-cyan-500/60 font-black uppercase tracking-[0.4em]">
              Scrape . Search . Analyze . Deliver
            </p>
            <div className="flex flex-col items-center gap-2 mt-4 text-xs text-slate-600 font-mono">
              <span>You have 5+ tools whose data nobody connects</span>
              <span>
                Tasks escape from conversations and nobody closes them
              </span>
              <span>You learn about problems too late</span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-xs text-slate-500 font-monospace uppercase tracking-[0.2em] font-bold">
                Built with Mosaic AI
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
