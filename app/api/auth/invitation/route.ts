import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Get invitation with mosaic name
    const { data, error } = await adminClient
      .from("mosaic_invitations")
      .select("id, email, role, status, expires_at, mosaic_id, mosaics(name)")
      .eq("token", token)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }

    const invitation = data as {
      id: string;
      email: string;
      role: string;
      status: string;
      expires_at: string;
      mosaic_id: string;
      mosaics: { name: string } | null;
    };

    // Check if invitation is still valid
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation is no longer valid", status: invitation.status },
        { status: 400 },
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired", status: "expired" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      mosaicName: invitation.mosaics?.name || "Unknown Mosaic",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
