import { Bot, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex flex-col items-center pt-[6vh] md:pt-[10vh]">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[120px] opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px] opacity-30 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-xl px-4 flex flex-col">
        <div className="flex items-center justify-between mb-8 w-full">
          <Link
            href="/"
            className="group flex items-center space-x-2 transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="font-black text-xl tracking-tight text-white">
              Mosaic
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-cyan-400 uppercase tracking-widest transition-colors group"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to website
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
