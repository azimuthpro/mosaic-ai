"use client";

import { User } from "@supabase/supabase-js";
import { Bot } from "lucide-react";
import Link from "next/link";

import { UserMenu } from "./user-menu";

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link
            href={user ? "/dashboard" : "/"}
            className="mr-6 flex items-center space-x-2"
          >
            <Bot className="h-6 w-6" />
            <span className="font-bold">Mosaic AI</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <nav className="flex items-center space-x-2">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Get Started
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
