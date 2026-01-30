export const dynamic = "force-dynamic";

import { Grid3X3, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MosaicSelector } from "@/components/layout/mosaic-selector";
import { UserMenu } from "@/components/layout/user-menu";
import { CreateMosaicDialog } from "@/components/mosaic/create-mosaic-dialog";
import { getMosaics, getSharedMosaics } from "@/lib/actions/mosaics";
import { getUser } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [ownedMosaics, sharedMosaics] = await Promise.all([
    getMosaics(),
    getSharedMosaics(),
  ]);

  const allMosaics = [...ownedMosaics, ...sharedMosaics].map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/mosaics"
            className="flex items-center gap-2 font-semibold"
          >
            <Grid3X3 className="h-6 w-6" />
            <span>Mosaic AI</span>
          </Link>
          <MosaicSelector mosaics={allMosaics} />
          <CreateMosaicDialog
            trigger={
              <button className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <Plus className="h-4 w-4" />
                New
              </button>
            }
          />
        </div>
        <UserMenu user={user} />
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
