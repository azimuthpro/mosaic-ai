"use client";

import { User } from "@supabase/supabase-js";
import { Bot, Menu, X, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { UserMenu } from "./user-menu";

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handleLinkClick(): void {
    setIsMenuOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="container max-w-6xl flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link
            href={user ? "/mosaics" : "/"}
            className="group mr-12 flex items-center space-x-2 transition-opacity hover:opacity-90"
            onClick={handleLinkClick}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
              <Bot className="h-5 w-5 text-cyan-400" />
            </div>
            <span className="font-black text-xl tracking-tight text-white">
              Mosaic
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/#use-cases"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Use Cases
            </Link>
            <Link
              href="/#features"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#api"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              API
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="text-sm font-medium text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all"
                >
                  <Link href="/signin">Sign In</Link>
                </Button>
                <Button
                  asChild
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5"
                >
                  <Link href="/signup">
                    <Zap className="mr-2 h-4 w-4 fill-current" />
                    Get Started
                  </Link>
                </Button>
              </>
            )}
          </div>

          <button
            className="flex md:hidden items-center justify-center h-10 w-10 text-slate-400 hover:text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 top-16 h-[calc(100vh-64px)] z-[100] md:hidden bg-slate-950 transition-all duration-500 ease-in-out px-10 pt-16 text-center shadow-2xl",
          isMenuOpen
            ? "translate-y-0 opacity-100 block"
            : "-translate-y-10 opacity-0 pointer-events-none",
        )}
        style={{ backgroundColor: "#020617" }}
      >
        <nav className="flex flex-col space-y-10">
          <Link
            href="/#use-cases"
            className="text-3xl font-black text-white tracking-tighter hover:text-cyan-400 transition-colors"
            onClick={handleLinkClick}
          >
            Use Cases
          </Link>
          <Link
            href="/#features"
            className="text-3xl font-black text-white tracking-tighter hover:text-cyan-400 transition-colors"
            onClick={handleLinkClick}
          >
            Features
          </Link>
          <Link
            href="/#api"
            className="text-3xl font-black text-white tracking-tighter hover:text-cyan-400 transition-colors"
            onClick={handleLinkClick}
          >
            API
          </Link>

          <div className="pt-12 border-t border-slate-900 flex flex-col items-center space-y-8">
            {user ? (
              <Link
                href="/mosaics"
                className="text-xl font-bold text-slate-400 hover:text-white transition-colors"
                onClick={handleLinkClick}
              >
                Go to Mosaics
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="text-xl font-bold text-slate-400 hover:text-white transition-colors"
                  onClick={handleLinkClick}
                >
                  Sign In
                </Link>
                <Button
                  asChild
                  className="w-full max-w-xs h-14 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xl rounded-2xl"
                  onClick={handleLinkClick}
                >
                  <Link href="/signup">
                    <Zap className="mr-3 h-5 w-5 fill-current" />
                    Get Started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
