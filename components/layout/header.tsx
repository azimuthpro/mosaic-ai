"use client";

import { User } from "@supabase/supabase-js";
import { Bot, Zap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { UserMenu } from "./user-menu";

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link
            href={user ? "/dashboard" : "/"}
            className="group mr-8 flex items-center space-x-2 transition-opacity hover:opacity-90"
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
              href="/#solutions"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Solutions
            </Link>
            <Link
              href="/#features"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#research"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Research
            </Link>
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Sign In
              </Link>
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
      </div>
    </header>
  );
}
