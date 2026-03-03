"use client";

import { ArrowRight, CheckCircle, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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
import { signUpWithMagicLink } from "@/lib/auth/actions";

interface InvitationDetails {
  email: string;
  role: string;
  mosaicName: string;
}

function SignupForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation");
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(
    () => !!invitationToken,
  );

  useEffect(() => {
    if (!invitationToken) return;

    let cancelled = false;

    fetch(`/api/auth/invitation?token=${invitationToken}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setInvitation(data);
          if (data.email) {
            setEmail((prev) => prev || data.email);
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load invitation details");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingInvitation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invitationToken]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

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

    const next = invitationToken
      ? `/mosaics?invitation=${invitationToken}`
      : undefined;

    const result = await signUpWithMagicLink({
      email,
      fullName,
      next,
    });

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setIsEmailSent(true);
    setIsLoading(false);
  }

  if (isEmailSent) {
    return (
      <Card className="w-full bg-slate-900/40 border-slate-800 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="space-y-2 pb-8 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20">
            <CheckCircle className="h-8 w-8 text-cyan-400" />
          </div>
          <CardTitle className="text-3xl font-bold text-white tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="text-slate-400 text-base">
            We sent a magic link to{" "}
            <span className="text-white font-medium">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <div className="flex items-center justify-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
            <Mail className="h-5 w-5 text-cyan-400" />
            <p className="text-sm text-slate-300">
              Click the link in your email to complete signup
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-6 pb-10">
          <p className="text-center text-sm text-slate-500">
            Didn&apos;t receive the email?{" "}
            <button
              onClick={() => setIsEmailSent(false)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-400"
            >
              Try again
            </button>
          </p>
        </CardFooter>
      </Card>
    );
  }

  function renderDescription(): React.ReactNode {
    if (isLoadingInvitation) {
      return "Loading invitation details...";
    }
    if (invitation) {
      return (
        <>
          You&apos;ve been invited to join{" "}
          <span className="text-white font-semibold">
            {invitation.mosaicName}
          </span>
        </>
      );
    }
    return "Mosaic is in private beta. You need an invitation to sign up.";
  }

  return (
    <Card className="w-full bg-slate-900/40 border-slate-800 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
      <CardHeader className="space-y-2 pb-8 pt-8">
        <CardTitle className="text-3xl font-bold text-white tracking-tight">
          Create an account
        </CardTitle>
        <CardDescription className="text-slate-400 text-base">
          {renderDescription()}
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
              className="h-12 bg-slate-950/50 border-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl text-white placeholder:text-slate-600 transition-all font-medium"
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
              className="h-12 bg-slate-950/50 border-slate-800 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl text-white placeholder:text-slate-600 transition-all font-medium"
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-6 pt-6 pb-10">
          <Button
            type="submit"
            className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] active:scale-[0.98] group"
            disabled={isLoading || isLoadingInvitation}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <span>Send magic link</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </Button>
          {!invitation && (
            <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4 text-center">
              <p className="text-sm text-slate-400">
                Don&apos;t have an invitation?{" "}
                <Link
                  href="/#cta"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-400"
                >
                  Join the waitlist
                </Link>
              </p>
            </div>
          )}
          <p className="text-center text-sm text-slate-500 font-medium">
            Already have an account?{" "}
            <Link
              href={
                invitationToken
                  ? `/signin?invitation=${invitationToken}`
                  : "/signin"
              }
              className="text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-400"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function SignupPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
