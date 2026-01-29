export const dynamic = "force-dynamic";

import { Bot, Github, Linkedin, Twitter } from "lucide-react";
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
    <div className="flex min-h-screen flex-col dark bg-slate-950 text-slate-300 selection:bg-emerald-500/30">
      <Header user={user} />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-900 bg-slate-950/50 pt-16 pb-8">
        <div className="container max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
            <div className="col-span-2">
              <Link href="/" className="flex items-center space-x-2 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Bot className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="font-black text-xl tracking-tight text-white">
                  Mosaic
                </span>
              </Link>
              <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
                Empowering the next generation of analysts with automated
                intelligence pipelines. Turn the web into your private database.
              </p>
              <div className="flex items-center space-x-4 mt-6">
                <Link
                  href="#"
                  className="text-slate-600 hover:text-emerald-400 transition-colors"
                >
                  <Twitter className="h-5 w-5" />
                </Link>
                <Link
                  href="#"
                  className="text-slate-600 hover:text-emerald-400 transition-colors"
                >
                  <Github className="h-5 w-5" />
                </Link>
                <Link
                  href="#"
                  className="text-slate-600 hover:text-emerald-400 transition-colors"
                >
                  <Linkedin className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">
                Solutions
              </h4>
              <ul className="space-y-4 text-sm">
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Market Analysts
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    OSINT & Researchers
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Sales Teams
                  </Link>
                </li>
                <li>
                  <Link
                    href="#use-cases"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    AI Engineers
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
                    href="#reliability"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Anti-bot evasion
                  </Link>
                </li>
                <li>
                  <Link
                    href="#reliability"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Semantic parsing
                  </Link>
                </li>
                <li>
                  <Link
                    href="#reliability"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Fact reconciliation
                  </Link>
                </li>
                <li>
                  <Link
                    href="#how-it-works"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Multi-step Pipelines
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">
                Legal & Support
              </h4>
              <ul className="space-y-4 text-sm">
                <li>
                  <Link
                    href="#"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600 font-mono italic">
              Built by Azimuth PRO • v0.4.0
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
