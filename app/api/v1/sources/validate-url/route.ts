import { NextResponse } from "next/server";

import { validateUrlWithDnsCheck } from "@/lib/validation/url-validator";

/**
 * Extract page title from HTML content
 */
function extractTitle(html: string): string | null {
  // Try to find <title> tag (case-insensitive)
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    // Decode HTML entities and trim
    const title = titleMatch[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    return title || null;
  }
  return null;
}

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

    // Step 1: Validate URL format and SSRF protection
    const validation = await validateUrlWithDnsCheck(url);

    if (!validation.isValid) {
      return NextResponse.json({
        isValid: false,
        error: validation.error,
      });
    }

    // Step 2: Fetch page to check accessibility and extract title
    let isAccessible: boolean | undefined;
    let pageTitle: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MosaicAI/1.0; +https://mosaicai.app)",
          Accept: "text/html",
        },
      });

      clearTimeout(timeoutId);

      // 2xx, 3xx = accessible
      // 401, 403 = accessible (site exists, requires auth)
      // 404, 5xx = potentially inaccessible
      if (
        response.ok ||
        response.status === 401 ||
        response.status === 403 ||
        (response.status >= 300 && response.status < 400)
      ) {
        isAccessible = true;

        // Try to extract title from HTML if response is OK
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("text/html")) {
            const html = await response.text();
            pageTitle = extractTitle(html);
          }
        }
      } else {
        isAccessible = false;
      }
    } catch {
      // Network error, timeout, or other fetch failure
      // Don't block submission, just mark as potentially inaccessible
      isAccessible = false;
    }

    return NextResponse.json({
      isValid: true,
      isAccessible,
      pageTitle,
    });
  } catch (validationError) {
    console.error("URL validation error:", validationError);
    return NextResponse.json(
      { isValid: false, error: "Failed to validate URL" },
      { status: 500 },
    );
  }
}
