import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function extractBearerToken(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1] ?? null;
}

export async function resolveUserId(
  client: SupabaseClient,
  request: Request,
): Promise<string | null> {
  // 개발 스텁: X-Dev-User 헤더 또는 DEV_USER_ID 환경변수로 인증 우회
  if (process.env.NODE_ENV === "development") {
    const devUser =
      request.headers.get("x-dev-user") ?? process.env.DEV_USER_ID ?? null;
    if (devUser) return devUser;
  }
  const token = extractBearerToken(request);
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
