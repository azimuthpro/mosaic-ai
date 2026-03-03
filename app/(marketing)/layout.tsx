export const dynamic = "force-dynamic";

import { Bot } from "lucide-react";
import Link from "next/link";

import { Header } from "@/components/layout/header";
import { getUser } from "@/lib/supabase/server";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="flex min-h-screen flex-col dark bg-black text-slate-300 selection:bg-cyan-500/30">
      <Header user={user} />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-900 bg-slate-950/50 pt-16 pb-8">
        <div className="container max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <Link href="/" className="flex items-center space-x-2 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <Bot className="h-5 w-5 text-cyan-400" />
                </div>
                <span className="font-black text-xl tracking-tight text-white">
                  Mosaic
                </span>
              </Link>
              <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
                Automated intelligence gathering and analysis. Connect scattered
                data sources into pipelines that deliver actionable insights on
                your schedule.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">
                Solutions
              </h4>
              <ul className="space-y-4 text-sm">
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Close the Loop
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Market Monitoring
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Morning Intelligence
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Entity Tracking
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">
                Capabilities
              </h4>
              <ul className="space-y-4 text-sm">
                <li>
                  <Link
                    href="#features"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Tile Pipelines
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Scheduled Execution
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Slack Integration
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="hover:text-cyan-400 transition-colors"
                  >
                    REST API & Webhooks
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600 font-mono italic">
              Built by Azimuth PRO • v1.3.0
            </p>
            <p className="text-xs text-slate-600 font-mono">
              © 2026 Azimuth PRO. High-fidelity intelligence pipelines.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
