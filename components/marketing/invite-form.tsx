"use client";

import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestInvite } from "@/lib/actions/invite";

export function InviteForm() {
  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await requestInvite(email);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setIsSubmitted(true);
      setEmail("");
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center gap-3 text-emerald-400 font-bold py-4 px-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 animate-in fade-in zoom-in duration-300">
        <CheckCircle2 className="h-6 w-6" />
        <span className="text-lg">Request sent! Welcome to the network.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-3 group">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors pointer-events-none">
          <Mail className="h-5 w-5" />
        </div>
        <Input
          type="email"
          placeholder="Enter your email to join..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-14 pl-12 pr-44 bg-slate-950 border-slate-800 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-2xl text-white placeholder:text-slate-600 transition-all font-medium"
          disabled={isLoading}
        />
        <div className="absolute right-1.5">
          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-slate-950/20 border-t-slate-950 animate-spin rounded-full" />
                <span>Sending</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>Request Invite</span>
                <CheckCircle2 className="h-4 w-4 opacity-50" />
              </div>
            )}
          </Button>
        </div>
      </form>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm font-bold px-4 py-2 rounded-lg bg-red-400/5 border border-red-400/10 animate-in slide-in-from-top-1 duration-200">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
