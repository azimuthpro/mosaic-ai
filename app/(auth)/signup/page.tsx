"use client";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // First check if email is allowed (via API endpoint)
    const checkResponse = await fetch("/api/auth/check-allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const checkResult = await checkResponse.json();

    if (!checkResult.allowed) {
      setError(
        "This email is not on the invite list. Please request an invite.",
      );
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/40 border-slate-800 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="space-y-2 pb-8 pt-8">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl font-bold text-white tracking-tight">
            Create an account
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            Join the automated intelligence network. Invite only.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="fullName"
                className="text-slate-300 font-medium ml-1 text-xs uppercase tracking-widest"
              >
                Full Name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                className="h-12 bg-slate-950/50 border-slate-800 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl text-white placeholder:text-slate-600 transition-all font-medium"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-slate-300 font-medium ml-1 text-xs uppercase tracking-widest"
              >
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-slate-950/50 border-slate-800 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl text-white placeholder:text-slate-600 transition-all font-medium"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-slate-300 font-medium ml-1 text-xs uppercase tracking-widest"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 bg-slate-950/50 border-slate-800 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl text-white placeholder:text-slate-600 transition-all font-medium"
                disabled={isLoading}
              />
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider ml-1">
                Minimum 6 characters required
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-6 pt-6 pb-10">
            <Button
              type="submit"
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-[0.98] group"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <span>Create account</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </Button>
            <p className="text-center text-sm text-slate-500 font-medium">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-4 decoration-emerald-500/30 hover:decoration-emerald-400"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
