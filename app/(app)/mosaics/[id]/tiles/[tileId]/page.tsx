import { notFound } from "next/navigation";

import { TileDetailPage } from "@/components/tiles/tile-detail-page";
import { getMosaic } from "@/lib/actions/mosaics";
import { getTile } from "@/lib/actions/tiles";

interface TilePageProps {
  params: Promise<{ id: string; tileId: string }>;
}

export default async function TilePage({ params }: TilePageProps) {
  const { id, tileId } = await params;

  const [mosaic, tile] = await Promise.all([getMosaic(id), getTile(tileId)]);

  if (!mosaic || !tile) {
    notFound();
  }

  return (
    <TileDetailPage tile={tile} mosaicId={mosaic.id} />
  );
}
