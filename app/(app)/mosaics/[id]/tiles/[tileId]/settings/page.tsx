import { redirect } from "next/navigation";

interface TileSettingsPageProps {
  params: Promise<{ id: string; tileId: string }>;
}

export default async function TileSettingsPage({
  params,
}: TileSettingsPageProps) {
  const { id, tileId } = await params;
  redirect(`/mosaics/${id}/tiles/${tileId}`);
}
