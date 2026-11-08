import type { SupabaseClient } from "@supabase/supabase-js";

// Authorization 헤더에서 Bearer 토큰만 추출한다. 순수 함수.
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}

// 토큰을 검증해 사용자 id를 돌려준다. 토큰이 없거나 무효하면 null.
// 비인증 요청은 공개 데이터만 반환하는 degrade 경로로 이어진다.
export async function resolveUserId(
  client: SupabaseClient,
  request: Request,
): Promise<string | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user.id;
}
