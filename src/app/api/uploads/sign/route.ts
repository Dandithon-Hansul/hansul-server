import { resolveUserId } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recipeError } from "@/lib/recipes/http";
import { signUpload } from "@/lib/uploads/sign";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await resolveUserId(createSupabaseServerClient(), request);
    if (!user) return recipeError(401, "UNAUTHORIZED", "인증이 필요합니다");
    let body: unknown;
    try { body = await request.json(); }
    catch { return recipeError(400, "INVALID_BODY", "JSON 형식을 확인해 주세요"); }
    return await signUpload(user, body);
  } catch { return recipeError(500, "UPLOAD_SIGN_FAILED", "업로드 토큰을 발급하지 못했습니다"); }
}
