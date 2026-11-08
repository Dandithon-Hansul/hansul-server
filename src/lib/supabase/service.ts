import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const configSchema = z.object({
  url: z.url(),
  serviceRoleKey: z.string().min(1),
});

// RLS·GRANT를 우회하는 서버 전용 클라이언트.
// 공개 레시피 조회는 이 클라이언트로 status/visibility 필터를 직접 적용한다.
export function createSupabaseServiceClient() {
  const { url, serviceRoleKey } = configSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
