import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const configSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export function createSupabaseServerClient(accessToken?: string) {
  const { url, publishableKey } = configSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken && {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }),
  });
}

export function createSupabaseAdminClient() {
  return createClient(
    z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
    z.string().min(1).parse(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
