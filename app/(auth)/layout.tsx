export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex justify-center pt-[6vh] md:pt-[10vh]">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px] opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/5 blur-[100px] opacity-30 pointer-events-none"></div>

      <div className="relative z-10 w-full px-4">{children}</div>
    </div>
  );
}
