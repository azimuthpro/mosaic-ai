import { CreateMosaicDialog } from "@/components/mosaic/create-mosaic-dialog";
import { MosaicCard } from "@/components/mosaic/mosaic-card";
import { getMosaics, getSharedMosaics } from "@/lib/actions/mosaics";

export default async function MosaicsPage() {
  const [ownedMosaics, sharedMosaics] = await Promise.all([
    getMosaics(),
    getSharedMosaics(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mosaics</h1>
          <p className="text-muted-foreground">
            Your intelligence gathering workspaces
          </p>
        </div>
        <CreateMosaicDialog />
      </div>

      {/* My Mosaics */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My Mosaics</h2>
        {ownedMosaics.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No mosaics yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first mosaic to start organizing your intelligence gathering.
              </p>
            </div>
            <div className="mt-4">
              <CreateMosaicDialog />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ownedMosaics.map((mosaic) => (
              <MosaicCard key={mosaic.id} mosaic={mosaic} />
            ))}
          </div>
        )}
      </section>

      {/* Shared Mosaics */}
      {sharedMosaics.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Shared with Me</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedMosaics.map((mosaic) => (
              <MosaicCard key={mosaic.id} mosaic={mosaic} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
