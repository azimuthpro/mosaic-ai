import {
  BarChart3,
  Bot,
  ChevronRight,
  Database,
  Globe,
  Layers,
  LineChart,
  Network,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
  ZapOff,
} from "lucide-react";
import Link from "next/link";

import { InviteForm } from "@/components/marketing/invite-form";

export default function HomePage() {
  return (
    <div className="flex flex-col selection:bg-emerald-500/30">
      {/* Hero Section */}
      <section className="container relative flex flex-col items-center gap-8 pb-16 pt-20 md:py-28 lg:py-40 overflow-hidden">
        {/* Deep Dark Background Elements */}
        <div className="absolute top-0 -z-10 h-full w-full bg-slate-950">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[800px] w-[800px] rounded-full bg-emerald-500/10 blur-[120px] opacity-50"></div>
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px] opacity-30"></div>
        </div>

        <div className="flex max-w-[980px] flex-col items-center gap-6 text-center">
          <Link
            href="#"
            className="group inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/10 hover:border-emerald-500/40"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>Mosaic v2: High-Fidelity Extraction available</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl text-white">
            Turn the web into
            <br />
            <span className="bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              your private database
            </span>
          </h1>

          <p className="max-w-[800px] text-lg text-slate-400 sm:text-xl lg:text-2xl leading-relaxed">
            Stop manual scraping. Deploy specialized AI agents that navigate
            complex sites, cross-verify claims, and deliver structured JSON or
            Google Sheet records in real-time.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 w-full max-w-sm mt-4">
          <InviteForm />
          <p className="text-sm text-slate-500 font-medium">
            The infrastructure for automated intelligence.
          </p>
        </div>

        {/* Hero Code Snippet */}
        <div className="w-full max-w-5xl mt-16 group relative">
          <div className="absolute -inset-1 rounded-3xl bg-linear-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl opacity-75 transition duration-1000 group-hover:opacity-100"></div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-900/50 px-4 py-3 font-mono text-xs">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-slate-800" />
                <div className="h-3 w-3 rounded-full bg-slate-800" />
                <div className="h-3 w-3 rounded-full bg-slate-800" />
              </div>
              <span className="text-slate-500 uppercase tracking-widest">
                Mosaic Inference Feed
              </span>
            </div>
            <div className="p-6 font-mono text-xs md:text-sm leading-relaxed text-slate-300 overflow-x-auto min-h-[320px]">
              <div className="space-y-1">
                <div className="flex gap-4 opacity-40">
                  <span className="w-4 select-none">1</span>
                  <span>
                    <span className="text-slate-500">
                      {"// Agent: FactChecker-V4 starting crawl..."}
                    </span>
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">2</span>
                  <span>{"{"}</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">3</span>
                  <span className="pl-4">
                    <span className="text-pink-400">&quot;mission&quot;</span>:{" "}
                    <span className="text-emerald-400">
                      &quot;Verify competitor pricing across 4 sources&quot;
                    </span>
                    ,
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">4</span>
                  <span className="pl-4">
                    <span className="text-pink-400">&quot;status&quot;</span>:{" "}
                    <span className="text-emerald-400">
                      &quot;Parsing raw HTML (Bypassing anti-bot)...&quot;
                    </span>
                    ,
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">5</span>
                  <span className="pl-4">
                    <span className="text-pink-400">&quot;findings&quot;</span>:
                    [
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">6</span>
                  <span className="pl-8">
                    {"{"}{" "}
                    <span className="text-pink-400">&quot;source&quot;</span>:{" "}
                    <span className="text-emerald-400">
                      &quot;Source A&quot;
                    </span>
                    , <span className="text-pink-400">&quot;price&quot;</span>:{" "}
                    <span className="text-emerald-400">&quot;$99.99&quot;</span>{" "}
                    {"}"},
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">7</span>
                  <span className="pl-8">
                    {"{"}{" "}
                    <span className="text-pink-400">&quot;source&quot;</span>:{" "}
                    <span className="text-emerald-400">
                      &quot;Source B&quot;
                    </span>
                    , <span className="text-pink-400">&quot;price&quot;</span>:{" "}
                    <span className="text-emerald-400">&quot;$97.50&quot;</span>{" "}
                    {"}"}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">8</span>
                  <span className="pl-4">],</span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">9</span>
                  <span className="pl-4">
                    <span className="text-pink-400">
                      &quot;conclusion&quot;
                    </span>
                    :{" "}
                    <span className="text-emerald-400">
                      &quot;Pricing divergence detected. Triangulating
                      truth...&quot;
                    </span>
                    ,
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">10</span>
                  <span className="pl-4">
                    <span className="text-pink-400">&quot;output&quot;</span>:{" "}
                    <span className="text-emerald-400">
                      &quot;Sent row to Sheet: &apos;Market Monitoring
                      (Global)&apos;&quot;
                    </span>
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="w-4 select-none opacity-40">11</span>
                  <span>{"}"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section - Who and For What? */}
      <section
        id="solutions"
        className="border-y border-slate-900 bg-slate-950/50 py-24 md:py-32"
      >
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl mb-4">
              Solving the{" "}
              <span className="text-emerald-400">Data Scarcity</span> Problem
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Mosaic AI is built for those who need high-fidelity data but
              refuse to waste time on brittle custom scrapers.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* For Analysts */}
            <div className="relative group p-8 rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-all">
              <Users className="h-8 w-8 text-emerald-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">
                Market Analysts
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Automate your daily monitoring. Track competitor pricing, new
                product launches, and industry news without ever leaving your
                spreadsheet.
              </p>
              <ul className="mt-6 space-y-2">
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Competitor Monitoring
                </li>
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Pricing Intelligence
                </li>
              </ul>
            </div>

            {/* For Researchers */}
            <div className="relative group p-8 rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-all">
              <Search className="h-8 w-8 text-cyan-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">
                Osint & Researchers
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Source fact-checking at scale. Use chaining agents to verify
                claims across multiple sources and build structured reports for
                investigation.
              </p>
              <ul className="mt-6 space-y-2">
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Fact Triangulation
                </li>
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Recursive Discovery
                </li>
              </ul>
            </div>

            {/* For Lead Gen */}
            <div className="relative group p-8 rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-all">
              <Target className="h-8 w-8 text-pink-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">Sales Teams</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Extract high-value leads from niche directories and news
                portals. Identify executive changes or funding alerts as they
                happen.
              </p>
              <ul className="mt-6 space-y-2">
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Lead Extraction
                </li>
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Signal Detection
                </li>
              </ul>
            </div>

            {/* For Engineers */}
            <div className="relative group p-8 rounded-3xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-all">
              <Database className="h-8 w-8 text-amber-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">
                AI Engineers
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Feed your RAG applications with high-quality, structured web
                data. Bypass the &quot;garbage-in&quot; problem with LLM-ready
                markdown.
              </p>
              <ul className="mt-6 space-y-2">
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Structured Data Feed
                </li>
                <li className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  Clean Markdown API
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases - Deep Dive */}
      <section id="research" className="container py-24 md:py-32">
        <div className="grid gap-20 lg:grid-cols-2 lg:max-w-7xl mx-auto items-center">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-linear-to-r from-emerald-500/20 to-indigo-500/20 blur-xl opacity-30"></div>
            <div className="relative rounded-3xl border border-slate-800 bg-slate-900/40 p-2 overflow-hidden shadow-2xl transition-transform hover:scale-[1.01]">
              <div className="bg-slate-950 rounded-2xl p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                      Active Scenario
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded italic">
                    Dynamic Monitoring
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <LineChart className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-bold mb-1">
                        E-commerce Price Tracking
                      </p>
                      <p className="text-xs text-slate-500">
                        Continuously monitor 100+ Shopify stores for price
                        changes on specific SKUs.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                      <Repeat className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-bold mb-1">
                        News Aggregation
                      </p>
                      <p className="text-xs text-slate-500">
                        Extract structured summary and source sentiment for all
                        news related to &quot;Green Hydrogen&quot;.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                      <BarChart3 className="h-5 w-5 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-bold mb-1">
                        Real-Estate Scraping
                      </p>
                      <p className="text-xs text-slate-500">
                        Build a private database of rental prices, including
                        amenities and agent contact info.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-mono uppercase">
                      Current Yield
                    </p>
                    <p className="text-lg font-black text-white italic">
                      25k+{" "}
                      <span className="text-xs font-normal text-slate-500 not-italic">
                        rows / week
                      </span>
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
                    85%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-white mb-6">
              How you can use
              <br />
              <span className="text-emerald-400">Mosaic AI today</span>
            </h2>
            <div className="space-y-6">
              <div>
                <h4 className="text-white font-bold flex items-center gap-2">
                  <ZapOff className="h-4 w-4 text-emerald-400" />
                  No-Code Integration
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">
                  Connect your Google Sheet. Define the column headers. Watch as
                  Mosaic agents populate them with verified facts. No coding
                  required to start receiving intelligence.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  Scheduled Triggers
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">
                  Running a weekly newsletter? Set an agent to crawl the web on
                  Friday morning. By Friday afternoon, your database is full and
                  ready for editing.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold flex items-center gap-2">
                  <Network className="h-4 w-4 text-pink-400" />
                  Programmable Pipelines
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">
                  Build complex loops. If Agent A finds a mention of a new
                  startup, Agent B is triggered to find their pricing page, and
                  Agent C extracts their features.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <InviteForm />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid - Technical Reliability */}
      <section id="features" className="container py-24 bg-slate-900/10">
        <div className="mx-auto flex max-w-[58em] flex-col items-center gap-4 text-center mb-20">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl text-white">
            Under the Hood
          </h2>
          <p className="max-w-[700px] leading-relaxed text-slate-400 sm:text-xl font-medium">
            Reliable intelligence requires robust orchestration.
          </p>
        </div>

        <div className="mx-auto grid justify-center gap-1 md:grid-cols-3 md:max-w-7xl">
          <div className="group relative bg-slate-950 border border-slate-900 p-10 hover:bg-slate-900 transition-colors">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Anti-Bot Evasion
            </h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Residential proxies, user-agent rotation, and headless browser
              spoofing come standard. We handle the wall, you get the data.
            </p>
          </div>

          <div className="group relative bg-slate-950 border border-slate-900 p-10 hover:bg-slate-900 transition-colors">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
              <Globe className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Semantic Parsing
            </h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Our agents don&apos;t just scrape—they understand. They use LLMs
              to identify facts even if the website layout changes tomorrow.
            </p>
          </div>

          <div className="group relative bg-slate-950 border border-slate-900 p-10 hover:bg-slate-900 transition-colors">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Fact Reconciliation
            </h3>
            <p className="text-slate-400 leading-relaxed text-sm">
              Conflict detection built-in. If two sources say different things,
              Mosaic flags it for review or uses truth-scoring to decide.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24 md:py-40">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-8 text-center bg-slate-900/30 border border-slate-800 p-16 rounded-[4rem] relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] pointer-events-none" />

          <h2 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-white">
            Ready to deploy?
          </h2>
          <p className="max-w-[700px] text-slate-400 text-xl leading-relaxed">
            Join the automated intelligence network. No credit card required.
            Invite-only beta.
          </p>
          <div className="mt-4 w-full flex justify-center">
            <InviteForm />
          </div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-[0.3em] font-bold">
            Limited Slots • Build with Mosaic AI
          </p>
        </div>
      </section>
    </div>
  );
}
