import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  Globe,
  LineChart,
  MessageSquare,
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
    <div className="flex flex-col selection:bg-emerald-500/30">
      {/* Hero Section */}
      <section className="container max-w-6xl relative flex flex-col items-center gap-8 pb-16 pt-12 md:pt-20 lg:pt-32 overflow-hidden">
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
            <span>Mosaic v2 • The Intelligence Layer for the Web</span>
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight md:text-7xl lg:text-8xl text-white">
            Own the web.
            <br />
            <span className="bg-linear-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent italic">
              Structured & Verified.
            </span>
          </h1>

          <p className="max-w-[850px] text-lg text-slate-400 sm:text-xl lg:text-2xl leading-relaxed">
            Turn the web into your private, structured database. Deploy
            autonomous agents that bypass anti-bots, reason through content, and
            deliver verified intelligence.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mt-4">
          <Button
            asChild
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold h-12 px-8 rounded-xl text-lg group"
          >
            <Link href="/signup">
              Get API Access
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="w-full sm:w-auto text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/5 h-12 px-8 text-lg font-medium transition-all"
          >
            <Link href="#">Explore Docs</Link>
          </Button>
        </div>
      </section>

      {/* Mission Section */}
      <section className="container max-w-6xl py-24 border-y border-slate-900 bg-slate-950/50">
        <div className="mx-auto flex flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Beyond Scraping.{" "}
            <span className="text-emerald-400">Autonomous Reasoners.</span>
          </h2>
          <p className="max-w-[800px] text-lg text-slate-400 sm:text-xl leading-relaxed">
            Traditional scrapers extract HTML.{" "}
            <span className="text-white font-bold">Mosaic extracts truth.</span>{" "}
            Our agents don&apos;t just &quot;crawl&quot;—they understand
            context, cross-verify claims, and self-heal when layouts change.
          </p>
        </div>
      </section>

      {/* Code Section */}
      <section className="container max-w-6xl py-24 md:py-32">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-white mb-6">
              Build in minutes,
              <br />
              <span className="text-emerald-400">scale to millions.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Deploy specialized agents that reason through market intelligence,
              pricing, and business signals with a single API call.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-slate-300 font-medium">
                  Production-ready TypeScript SDK
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-slate-300 font-medium">
                  Seamless RAG & Vector DB integration
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <span className="text-slate-300 font-medium">
                  Autonomous anti-bot management
                </span>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -inset-1 rounded-3xl bg-linear-to-r from-emerald-500/20 to-cyan-500/20 blur-2xl opacity-75"></div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800/50 bg-slate-900/50 px-4 py-3 font-mono text-xs">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                  <div className="h-3 w-3 rounded-full bg-slate-800" />
                </div>
                <span className="text-slate-500 uppercase tracking-widest text-[10px]">
                  Market Intelligence Deployment
                </span>
              </div>
              <div className="p-6 font-mono text-[11px] md:text-sm leading-relaxed text-slate-300 overflow-x-auto">
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500">
                      {"// Deploying an agent to track market intelligence"}
                    </span>
                  </div>
                  <div>
                    <span className="text-pink-400">const</span>{" "}
                    <span className="text-cyan-400">mosaic</span> ={" "}
                    <span className="text-pink-400">new</span>{" "}
                    <span className="text-emerald-400">MosaicAI</span>(
                    <span className="text-emerald-400">
                      &apos;your_api_key&apos;
                    </span>
                    );
                  </div>
                  <br />
                  <div>
                    <span className="text-pink-400">const</span>{" "}
                    <span className="text-cyan-400">result</span> ={" "}
                    <span className="text-pink-400">await</span>{" "}
                    <span className="text-cyan-400">mosaic</span>.
                    <span className="text-cyan-400">deploy</span>({"{"}
                  </div>
                  <div className="pl-4">
                    source:{" "}
                    <span className="text-emerald-400">
                      &quot;https://competitor.com/pricing&quot;
                    </span>
                    ,
                  </div>
                  <div className="pl-4">schema: {"{"}</div>
                  <div className="pl-8">
                    productName:{" "}
                    <span className="text-emerald-400">&quot;string&quot;</span>
                    ,
                  </div>
                  <div className="pl-8">
                    currentPrice:{" "}
                    <span className="text-emerald-400">&quot;number&quot;</span>
                    ,
                  </div>
                  <div className="pl-8">
                    features:{" "}
                    <span className="text-emerald-400">&quot;array&quot;</span>,
                  </div>
                  <div className="pl-8">
                    confidenceScore:{" "}
                    <span className="text-emerald-400">
                      &quot;boolean&quot;
                    </span>
                  </div>
                  <div className="pl-4">{"}"},</div>
                  <div className="pl-4">options: {"{"}</div>
                  <div className="pl-8">
                    verifyAgainst: [
                    <span className="text-emerald-400">
                      &quot;.../industry-news.com&quot;
                    </span>
                    ],
                  </div>
                  <div className="pl-8">
                    frequency:{" "}
                    <span className="text-emerald-400">&quot;daily&quot;</span>
                  </div>
                  <div className="pl-4">{"}"}</div>
                  <div>{"}"});</div>
                  <br />
                  <div className="text-slate-500 font-italic">
                    {
                      "// Output: Verified, structured JSON ready for your DB or RAG."
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Table Section */}
      <section
        id="ai-stack"
        className="container max-w-6xl py-24 bg-slate-900/10"
      >
        <div className="mx-auto flex flex-col items-center gap-4 text-center mb-16 px-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl text-white">
            Built for the <span className="text-emerald-400">AI Stack</span>
          </h2>
        </div>

        <div className="grid gap-px bg-slate-800 border border-slate-800 rounded-2xl overflow-hidden md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-slate-950 p-8 hover:bg-slate-900 transition-colors">
            <Sparkles className="h-8 w-8 text-emerald-400 mb-6" />
            <h3 className="text-lg font-bold text-white mb-3">
              Agentic Reasoning
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              No CSS selectors. No fragile rules. Agents interpret the page like
              a human would.
            </p>
          </div>
          <div className="bg-slate-950 p-8 hover:bg-slate-900 transition-colors">
            <ShieldCheck className="h-8 w-8 text-cyan-400 mb-6" />
            <h3 className="text-lg font-bold text-white mb-3">
              Stealth by Default
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Built-in residential proxies and stealth browsers. We handle the
              blocks.
            </p>
          </div>
          <div className="bg-slate-950 p-8 hover:bg-slate-900 transition-colors">
            <Globe className="h-8 w-8 text-pink-400 mb-6" />
            <h3 className="text-lg font-bold text-white mb-3">
              Truth-First Extraction
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Automatic conflict detection. If sources disagree, Mosaic flags it
              and scores the confidence.
            </p>
          </div>
          <div className="bg-slate-950 p-8 hover:bg-slate-900 transition-colors">
            <Database className="h-8 w-8 text-amber-500 mb-6" />
            <h3 className="text-lg font-bold text-white mb-3">
              LLM-Ready Output
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Clean Markdown and structured JSON, optimized for RAG and vector
              databases.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container max-w-6xl py-24 md:py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            How it works
          </h2>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          <div className="flex flex-col items-center text-center group">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <Settings className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              1. Define your Schema
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Tell Mosaic what you need. From competitor pricing to executive
              changes. Define your headers in a Google Sheet or via JSON schema.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              2. Deploy the Agents
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Mosaic agents navigate complex, dynamic sites, solve captchas, and
              hunt for signals across multiple layers of the web.
            </p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="h-16 w-16 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-6 group-hover:scale-110 transition-transform">
              <Code2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              3. Own the Intelligence
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Data flows directly into your systems via Webhook, API, or Google
              Sheets. Verified, deduplicated, and traceable to the source.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section
        id="use-cases"
        className="container max-w-6xl py-24 border-t border-slate-900"
      >
        <div className="mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl text-left">
            Use Cases
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="relative p-8 rounded-2xl border border-slate-800 bg-slate-900/30">
            <MessageSquare className="h-8 w-8 text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">AI Engineers</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 italic">
              Feed your RAG
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Stop fighting &quot;garbage-in.&quot; Get high-fidelity,
              structured markdown that enhances your model&apos;s performance.
              No post-processing required.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Clean Markdown
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Structured JSON
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Vector-ready
              </span>
            </div>
          </div>

          <div className="relative p-8 rounded-2xl border border-slate-800 bg-slate-900/30">
            <LineChart className="h-8 w-8 text-cyan-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">
              Market Analysts
            </h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 italic">
              Strategic Monitoring
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Track pricing, product launches, and industry shifts across
              thousands of stores and portals.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Pricing Intelligence
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Competitor Mapping
              </span>
            </div>
          </div>

          <div className="relative p-8 rounded-2xl border border-slate-800 bg-slate-900/30">
            <Target className="h-8 w-8 text-pink-400 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">Sales Teams</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 italic">
              Signal-Based Prospecting
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Extract high-value leads from niche directories and funding alerts
              the moment they trigger.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Lead Extraction
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                Intent Detection
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Reliability - Layout Agility */}
      <section
        id="reliability"
        className="container max-w-6xl py-24 bg-slate-900/10 border-y border-slate-900"
      >
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl mb-8">
              Technical <span className="text-emerald-400">Reliability</span>
            </h2>
            <blockquote className="border-l-4 border-emerald-500 pl-6 py-2 mb-10">
              <p className="text-2xl font-medium text-white italic leading-relaxed">
                &quot;Mosaic doesn&apos;t just scrape. It understands. When a
                website redesigns, our pipelines don&apos;t break.&quot;
              </p>
            </blockquote>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-white font-bold mb-1">Layout Agnostic</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Agents reason about meaning, not markup.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-white font-bold mb-1">Scale-Ready</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    25,000+ verified rows per week with 85% autonomous accuracy.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-white font-bold mb-1">
                    Full Audit Trail
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Every data point includes a direct link to the source.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-linear-to-r from-emerald-500/10 to-transparent blur-xl opacity-20"></div>
            <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 shadow-2xl relative">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-900">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">
                      Operational Health
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded italic">
                    Stable
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full w-[95%] bg-emerald-500 opacity-80" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-600">
                    <span>99.9% Extraction Success</span>
                    <span>0.1% Block Rate</span>
                  </div>
                </div>
                <div className="pt-4 grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">
                      Total Intelligence
                    </p>
                    <p className="text-lg font-black text-white italic">
                      1.2M+
                    </p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">
                      Active Agents
                    </p>
                    <p className="text-lg font-black text-white italic">452</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container max-w-6xl py-20 md:py-40">
        <div className="mx-auto flex max-w-232 flex-col items-center justify-center gap-8 text-center bg-slate-900/30 border border-slate-800 px-6 py-16 md:p-16 rounded-3xl md:rounded-[4rem] relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] pointer-events-none" />

          <h2 className="text-5xl font-extrabold tracking-tight sm:text-6xl text-white">
            Ready to build?
          </h2>
          <p className="max-w-[700px] text-slate-400 text-xl leading-relaxed font-bold">
            Join the automated intelligence network. Limited slots for the
            private beta.
          </p>
          <div className="mt-4 w-full flex justify-center max-w-md">
            <InviteForm />
          </div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-[0.3em] font-bold">
            No credit card required • Built with Mosaic AI
          </p>
        </div>
      </section>
    </div>
  );
}
