import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
  Globe,
  LineChart,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
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
            <Zap className="h-4 w-4 fill-current text-[#CCFF00]" />
            <span className="flex items-center gap-1.5">
              Mosaic v2 <span className="text-white/20">•</span>{" "}
              <span className="text-[#CCFF00]">Race-Ready</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="text-balance text-5xl font-extrabold leading-[1.1] tracking-tight md:text-7xl lg:text-8xl text-white">
            Structure the web
            <br />
            <span className="bg-linear-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent italic">
              in 30 seconds.
            </span>
          </h1>

          <p className="text-pretty max-w-[750px] text-lg text-slate-400 sm:text-xl lg:text-2xl leading-relaxed">
            Stop scraping. Deploy autonomous agents that bypass anti-bots,
            verify claims, and deliver structured intelligence directly to your
            stack via API.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mt-4">
          <Button
            asChild
            className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black h-14 px-10 rounded-2xl text-lg group transition-all shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-95"
          >
            <Link href="/signup">
              Deploy your first Agent
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
              Stop fighting HTML.
              <br />
              <span className="text-cyan-400 italic">
                Start receiving facts.
              </span>
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-400 shrink-0">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <p className="text-pretty text-slate-400 text-lg">
                  Mosaic handles residential proxies, headless browsers, and
                  rotating UAs automatically.
                </p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <p className="text-pretty text-slate-400 text-lg">
                  Verified output against multiple sources. If the data is
                  conflicting, we flag it.
                </p>
              </div>
            </div>
          </div>

          <div className="relative group perspective-1000">
            <div className="grid grid-cols-1 gap-4 lg:gap-8 translate-z-10 transition-transform duration-700">
              {/* Dirty HTML Part */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50 p-1 opacity-60 scale-95 blur-[2px] hover:blur-0 transition-all group-hover:opacity-40 select-none pointer-events-none">
                <div className="flex items-center gap-1.5 p-3 border-b border-slate-800/50 px-4">
                  <div className="h-2 w-2 rounded-full bg-red-500/50" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    Fragile HTML Scrape
                  </span>
                </div>
                <pre className="p-4 font-mono text-[10px] text-slate-600 overflow-hidden leading-tight">
                  {`<div>
  <section class="p-4 flex-col md:hidden">
    <h1 id="price-v2" class="text-4xl">
      &nbsp;&nbsp;$199.99
    </h1>
    <!-- Layout changes break selectors -->
    <span class="discount-label">
      Save 20%
    </span>
  </section>
</div>`}
                </pre>
              </div>

              {/* Clean JSON Part */}
              <div className="relative -mt-12 lg:-mt-20 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950 shadow-2xl shadow-cyan-500/10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="flex items-center justify-between p-3 border-b border-cyan-500/10 bg-cyan-500/5 px-4 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5 ">
                    <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,1)]" />
                    <span className="text-cyan-400 uppercase tracking-widest font-bold font-mono">
                      Verified Intelligence Output
                    </span>
                  </div>
                  <span className="text-slate-500 uppercase tracking-widest text-[9px]">
                    JSON Format • Confidence: 98%
                  </span>
                </div>
                <pre className="p-6 font-mono text-xs md:text-sm leading-relaxed overflow-x-auto bg-slate-950/50 transition-colors">
                  <div className="space-y-1">
                    <div>{"{"}</div>
                    <div className="pl-4">
                      <span className="text-pink-400">&quot;product&quot;</span>
                      :{" "}
                      <span className="text-cyan-400">
                        &quot;Advanced Intelligence Engine&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">&quot;price&quot;</span>:{" "}
                      <span className="text-cyan-400">159.99</span>,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;currency&quot;
                      </span>
                      : <span className="text-cyan-400">&quot;USD&quot;</span>,
                    </div>
                    <div className="pl-4">
                      <span className="text-pink-400">
                        &quot;verified&quot;
                      </span>
                      : <span className="text-cyan-400">true</span>,
                    </div>
                    <div className="pl-4 group/item">
                      <span className="text-pink-400">
                        &quot;source_integrity&quot;
                      </span>
                      : <span className="text-cyan-400">0.98</span>,
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20 group-hover/item:bg-cyan-500/20 transition-colors">
                        FACT CHECKED
                      </span>
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
      <section id="ai-stack" className="container max-w-6xl py-24">
        <div className="mx-auto flex flex-col items-center gap-4 text-center mb-16 px-4">
          <h2 className="text-balance text-3xl font-black tracking-tighter sm:text-6xl text-white">
            Automate{" "}
            <span className="text-cyan-400 underline decoration-cyan-500/20 underline-offset-8">
              Intelligence.
            </span>
          </h2>
          <p className="text-pretty text-slate-500 text-lg max-w-2xl">
            Mosaic replaces fragile scraping logic with autonomous reasoning
            agents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
          {/* Large Card: Stealth Browsing */}
          <div className="md:col-span-3 lg:col-span-7 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 lg:p-12 transition-all hover:bg-slate-900/80 group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 text-slate-700/50 group-hover:text-cyan-500/20 transition-colors">
              <ShieldCheck className="h-32 w-32 rotate-12" />
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
                <Zap className="h-6 w-6 fill-current" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">
                Evade detection by default.
              </h3>
              <p className="text-pretty text-slate-400 leading-relaxed text-lg flex-1">
                Mosaic rotates residential proxies and spoofs headless browsers
                automatically. No more CAPTCHAs, no more IP bans.
              </p>
              <div className="mt-8 pt-8 border-t border-slate-800/50 flex gap-4 overflow-hidden">
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  RESIDENTIAL_PROXY_V2
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-monospace text-slate-500">
                  STEALTH_JS_RUNTIME
                </div>
              </div>
            </div>
          </div>

          {/* Tall Card: Fact Reconciliation */}
          <div className="md:col-span-3 lg:col-span-5 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 lg:p-12 transition-all hover:bg-slate-900/80 overflow-hidden group">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
              <Globe className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">
              Reconcile facts.
            </h3>
            <p className="text-pretty text-slate-400 leading-relaxed text-lg mb-8">
              Agents cross-verify claims against multiple sources. We score data
              integrity so you can trust every byte.
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

          {/* Square Card: Agent Reasoners */}
          <div className="md:col-span-3 lg:col-span-4 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Reasoning over CSS.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Mosaic agents interpret the page like a human analyst. No more
              fragile CSS selectors.
            </p>
          </div>

          {/* Square Card: Context Understanding */}
          <div className="md:col-span-3 lg:col-span-4 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group">
            <div className="h-12 w-12 rounded-2xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400 mb-8">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Contextual Search.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Our agents don&apos;t just crawl, they search for intent and
              meaning in every paragraph.
            </p>
          </div>

          {/* Square Card: Scale Orchestration */}
          <div className="md:col-span-6 lg:col-span-4 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 mb-8">
              <Settings className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              Auto-Orchestration.
            </h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Self-healing pipelines that adapt to UI changes without a single
              line of code.
            </p>
          </div>

          {/* Wide Card: Deep Web Discovery */}
          <div className="md:col-span-6 lg:col-span-8 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 p-8 transition-all hover:bg-slate-900/80 group relative overflow-hidden">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-6">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4">
                  Discovery Engine.
                </h3>
                <p className="text-pretty text-slate-400 leading-relaxed text-lg">
                  Traverse the deep web. Mosaic agents find hidden APIs,
                  portals, and data points that standard crawlers miss.
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

          {/* Last Square Card: Vector DB Integration */}
          <div className="md:col-span-6 lg:col-span-4 bg-cyan-500/5 rounded-[2.5rem] border border-cyan-500/20 p-8 transition-all hover:bg-cyan-500/10 group">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400 mb-8">
              <Database className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">RAG Ready.</h3>
            <p className="text-pretty text-slate-400 text-sm leading-relaxed">
              Output optimized for vector databases and LLM context windows. No
              cleanup required.
            </p>
          </div>
        </div>
      </section>

      {/* Code Section */}
      <section className="container max-w-6xl py-24 border-t border-slate-900">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-balance text-4xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              One API call.
              <br />
              <span className="text-cyan-400 italic">Total Control.</span>
            </h2>
            <p className="text-pretty text-slate-400 text-lg leading-relaxed mb-8">
              Send a URL and a schema. Mosaic delivers verified facts. No
              complex pipelines, no middleware.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                <span className="text-slate-300 font-medium">
                  Type-safe TypeScript SDK
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
                  Mosaic AI Intelligence Request
                </span>
              </div>
              <div className="p-6 font-mono text-[11px] md:text-sm leading-relaxed text-slate-300 overflow-x-auto">
                <div className="space-y-1 text-slate-400">
                  <div>
                    <span className="text-slate-500 italic">
                      {"// Deployment request"}
                    </span>
                  </div>
                  <div>
                    <span className="text-pink-400 font-bold italic">
                      await
                    </span>{" "}
                    <span className="text-cyan-400 font-bold group-hover:text-cyan-300 transition-colors">
                      mosaic
                    </span>
                    .<span className="text-cyan-400">extract</span>({"{"}
                  </div>
                  <div className="pl-4">
                    url:{" "}
                    <span className="text-cyan-400">
                      &quot;https://competitor.com/pricing&quot;
                    </span>
                    ,
                  </div>
                  <div className="pl-4">
                    schema: {"{"} product:{" "}
                    <span className="text-cyan-400">&quot;string&quot;</span>,
                    price:{" "}
                    <span className="text-cyan-400">&quot;number&quot;</span>{" "}
                    {"}"}
                  </div>
                  <div>{"}"});</div>
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
            <MessageSquare className="h-10 w-10 text-cyan-400 mb-8 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-black text-white mb-4">
              AI Engineers
            </h3>
            <p className="text-pretty text-sm text-slate-400 leading-relaxed mb-8">
              Feed your models with high-fidelity markdown. Stop post-processing
              garbage data and start receiving model-ready context.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                RAG Optimized
              </span>
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                Clean MDR
              </span>
            </div>
          </div>

          <div className="relative p-10 rounded-[2.5rem] border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
            <LineChart className="h-10 w-10 text-cyan-400 mb-8 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-black text-white mb-4">
              Market Analysts
            </h3>
            <p className="text-pretty text-sm text-slate-400 leading-relaxed mb-8">
              Monitor competitors silently. Track price changes, new product
              launches, and industry shifts in real-time.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                Pricing Feed
              </span>
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                Signal Alerts
              </span>
            </div>
          </div>

          <div className="relative p-10 rounded-[2.5rem] border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors group">
            <Target className="h-10 w-10 text-pink-400 mb-8 transition-transform group-hover:scale-110" />
            <h3 className="text-2xl font-black text-white mb-4">
              Sales Operations
            </h3>
            <p className="text-pretty text-sm text-slate-400 leading-relaxed mb-8">
              Enrich leads automatically. Extract intent signals from news and
              directories the moment they happen.
            </p>
            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/50">
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                Intent Signals
              </span>
              <span className="text-[10px] font-monospace text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                CRM Sync
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container max-w-6xl py-20 md:py-40">
        <div className="w-full flex flex-col items-center justify-center gap-12 text-center bg-slate-950/40 border border-slate-800 px-8 py-24 md:p-24 rounded-[3rem] md:rounded-[5rem] relative overflow-hidden backdrop-blur-xl transition-all hover:bg-slate-900/40 group">
          {/* Mercedes-style Horizon Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 blur-[120px] pointer-events-none group-hover:bg-cyan-500/15 transition-colors" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-cyan-500/50 to-transparent opacity-30" />

          <h2 className="text-balance text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl text-white group-hover:scale-[1.01] transition-transform duration-700 leading-tight">
            Ready to structure the web?
          </h2>
          <p className="text-pretty max-w-[600px] text-slate-400 text-xl md:text-2xl leading-relaxed font-bold">
            Join the automated intelligence network. No credit card required.
            Private beta access.
          </p>
          <div className="w-full flex justify-center max-w-2xl">
            <InviteForm />
          </div>
          <div className="pt-4 flex flex-col items-center gap-4">
            <p className="text-[10px] text-cyan-500/60 font-black uppercase tracking-[0.4em]">
              Secure • Verifiable • Autonomous
            </p>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-xs text-slate-500 font-monospace uppercase tracking-[0.2em] font-bold">
                Built with Mosaic AI
              </p>
              <div className="h-1 w-8 bg-[#CCFF00] rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
