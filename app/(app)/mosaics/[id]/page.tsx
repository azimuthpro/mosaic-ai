import { notFound } from "next/navigation";

import { MosaicCanvas } from "@/components/mosaic/mosaic-canvas";
import { getMosaic } from "@/lib/actions/mosaics";
import { getTileConnections } from "@/lib/actions/tiles";

interface MosaicPageProps {
  params: Promise<{ id: string }>;
}

export default async function MosaicPage({ params }: MosaicPageProps) {
  const { id } = await params;

  const [mosaic, connections] = await Promise.all([
    getMosaic(id),
    getTileConnections(id),
  ]);

  if (!mosaic) {
    notFound();
  }

  return <MosaicCanvas mosaic={mosaic} connections={connections} />;
}
