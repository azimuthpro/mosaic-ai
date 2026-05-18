import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { cancelOfferDraft, sendOfferDraft } from "@/lib/email/send-offer-draft";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface SendOfferBody {
  action?: "send" | "cancel";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tileId: string; jobId: string }> },
): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tileId, jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as SendOfferBody;
  const isCancel = body.action === "cancel";

  const admin = createAdminClient();
  const outcome = isCancel
    ? await cancelOfferDraft(admin, jobId, user.id)
    : await sendOfferDraft(admin, jobId, user.id);

  const { data: tileRow } = await admin
    .from("tiles")
    .select("mosaic_id")
    .eq("id", tileId)
    .maybeSingle();
  const mosaicId = (tileRow as { mosaic_id?: string } | null)?.mosaic_id;
  if (mosaicId) {
    revalidatePath(`/mosaics/${mosaicId}`);
    revalidatePath(`/mosaics/${mosaicId}/tiles/${tileId}`);
  }

  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, draft: outcome.draft });
}
