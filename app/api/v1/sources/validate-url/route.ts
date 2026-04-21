import { NextResponse } from "next/server";

import { validateUrlWithMetadata } from "@/lib/firecrawl/client";
import { validateUrlWithDnsCheck } from "@/lib/validation/url-validator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { isValid: false, error: "URL is required" },
        { status: 400 },
      );
    }

    // Step 1: SSRF protection (first-line defense)
    const validation = await validateUrlWithDnsCheck(url);

    if (!validation.isValid) {
      return NextResponse.json({
        isValid: false,
        error: validation.error,
      });
    }

    // Step 2: Firecrawl-based validation and metadata extraction
    const metadata = await validateUrlWithMetadata(url);

    return NextResponse.json({
      isValid: metadata.isValid,
      isAccessible: metadata.isAccessible,
      pageTitle: metadata.pageTitle,
      error: metadata.error,
    });
  } catch (validationError) {
    console.error("URL validation error:", validationError);
    return NextResponse.json(
      { isValid: false, error: "Failed to validate URL" },
      { status: 500 },
    );
  }
}
