"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

const ERROR_REDIRECT = "/signin?error=auth_callback_error";

function FullScreenSpinner({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        {children}
      </div>
    </div>
  );
}

/**
 * Client-side auth callback for magic links sent via SendGrid.
 *
 * Email security scanners (Microsoft SafeLinks, Google link scanners)
 * prefetch GET links but don't execute JavaScript. By verifying the OTP
 * client-side, scanners can't consume the one-time token before the user.
 */
function CallbackHandler(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next") ?? "/mosaics";

    if (!tokenHash || !type) {
      router.replace(ERROR_REDIRECT);
      return;
    }

    const supabase = createClient();
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => {
        if (error) {
          console.error("Auth verification error:", error);
          router.replace(ERROR_REDIRECT);
        } else {
          router.replace(next);
        }
      });
  }, [router, searchParams]);

  return (
    <FullScreenSpinner>
      <p className="text-slate-400 text-sm font-medium">
        Verifying your magic link...
      </p>
    </FullScreenSpinner>
  );
}

export default function AuthCallbackPage(): React.ReactElement {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <CallbackHandler />
    </Suspense>
  );
}
