import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey } from "@/lib/supabase/keys";
import type { Database } from "@/types/database";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
