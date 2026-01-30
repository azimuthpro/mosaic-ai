"use client";

import { Bot, FileText, Grid3X3, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Mosaics", href: "/mosaics", icon: Grid3X3 },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Reports", href: "/reports", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/10">
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href="/mosaics"
          className="flex items-center gap-2 font-semibold"
        >
          <Grid3X3 className="h-6 w-6" />
          <span>Mosaic AI</span>
        </Link>
      </div>
      <div className="flex-1 space-y-1 p-4">
        <Button
          asChild
          variant="outline"
          className="w-full justify-start gap-2"
          size="sm"
        >
          <Link href="/mosaics">
            <Plus className="h-4 w-4" />
            New Mosaic
          </Link>
        </Button>
        <nav className="mt-4 space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
