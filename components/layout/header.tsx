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

  // Close menu when clicking an anchor link
  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="container max-w-6xl flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link
            href={user ? "/dashboard" : "/"}
            className="group mr-12 flex items-center space-x-2 transition-opacity hover:opacity-90"
            onClick={handleLinkClick}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
              <Bot className="h-5 w-5 text-emerald-400" />
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
              href="/#how-it-works"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              How it works
            </Link>
            <Link
              href="/#reliability"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Reliability
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
                  className="text-sm font-medium text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button
                  asChild
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5"
                >
                  <Link href="/signup">
                    <Zap className="mr-2 h-4 w-4 fill-current" />
                    Get Started
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
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

      {/* Mobile Navigation Overlay */}
      <div
        className={cn(
          "fixed inset-0 top-16 z-40 md:hidden bg-slate-950 transition-all duration-300 ease-in-out px-6 pt-8",
          isMenuOpen
            ? "translate-x-0 opacity-100"
            : "translate-x-full opacity-0",
        )}
      >
        <nav className="flex flex-col space-y-8">
          <Link
            href="/#use-cases"
            className="text-2xl font-bold text-white tracking-tight"
            onClick={handleLinkClick}
          >
            Use Cases
          </Link>
          <Link
            href="/#how-it-works"
            className="text-2xl font-bold text-white tracking-tight"
            onClick={handleLinkClick}
          >
            How it works
          </Link>
          <Link
            href="/#reliability"
            className="text-2xl font-bold text-white tracking-tight"
            onClick={handleLinkClick}
          >
            Reliability
          </Link>

          <div className="pt-8 border-t border-slate-900 space-y-6">
            {!user && (
              <>
                <Link
                  href="/login"
                  className="block text-lg font-medium text-slate-400"
                  onClick={handleLinkClick}
                >
                  Sign In
                </Link>
                <Button
                  asChild
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                  onClick={handleLinkClick}
                >
                  <Link href="/signup">
                    <Zap className="mr-2 h-4 w-4 fill-current" />
                    Get Started
                  </Link>
                </Button>
              </>
            )}
            {user && (
              <Link
                href="/dashboard"
                className="block text-lg font-medium text-slate-400"
                onClick={handleLinkClick}
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
