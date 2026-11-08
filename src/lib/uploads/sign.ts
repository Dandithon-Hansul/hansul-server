import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseAdminClient } from "../supabase/server";
import { recipeError, recipeJson } from "../recipes/http";

const PURPOSES = {
  stt_audio: { maxBytes: 25 * 1024 * 1024, types: ["audio/webm", "audio/mp4", "audio/wav"] },
  card_voice: { maxBytes: 5 * 1024 * 1024, types: ["audio/webm", "audio/mp4", "audio/wav"] },
  chat_image: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  avatar: { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
};
const NO_RECIPE_PURPOSES = new Set(["stt_audio", "avatar"]);
const uploadInput = z.object({
  purpose: z.enum(["stt_audio", "card_voice", "chat_image", "avatar"]),
  content_type: z.string(), size_bytes: z.number().int().positive(), recipe_id: z.uuid().optional(),
}).strict();

export async function signUpload(userId: string | null, input: unknown, client?: SupabaseClient) {
  if (!userId) return recipeError(401, "UNAUTHORIZED", "인증이 필요합니다");
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return recipeError(400, "INVALID_BODY", "업로드 요청 필드를 확인해 주세요");
  const value = parsed.data;
  const config = PURPOSES[value.purpose];
  if (value.size_bytes > config.maxBytes) return recipeError(413, "FILE_TOO_LARGE", "파일 크기 초과");
  if (!config.types.includes(value.content_type)) return recipeError(415, "UNSUPPORTED_FORMAT", "지원하지 않는 파일 형식입니다");
  if (!NO_RECIPE_PURPOSES.has(value.purpose) && !value.recipe_id) return recipeError(400, "RECIPE_ID_REQUIRED", "recipe_id가 필요합니다");
  const db = client ?? createSupabaseAdminClient();
  if (value.recipe_id) {
    const { data, error } = await db.from("recipes").select("id,status").eq("id", value.recipe_id).eq("transmitter_id", userId).maybeSingle();
    if (error) return recipeError(500, "DATABASE_ERROR", "레시피 권한을 확인할 수 없습니다");
    if (!data) return recipeError(404, "NOT_FOUND", "레시피를 찾을 수 없습니다");
    if (value.purpose === "chat_image" && data.status !== "draft") return recipeError(409, "NOT_DRAFT", "초안에만 채팅 이미지를 올릴 수 있습니다");
  }
  const ext = value.content_type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${value.purpose}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("uploads").createSignedUploadUrl(path);
  if (error || !data?.token || data.path !== path) return recipeError(500, "STORAGE_ERROR", "업로드 토큰 발급에 실패했습니다");
  const { error: grantError } = await db.from("upload_grants").insert({ bucket: "uploads", path, owner_id: userId, recipe_id: value.recipe_id ?? null, purpose: value.purpose, content_type: value.content_type, size_bytes: value.size_bytes });
  if (grantError) return recipeError(500, "UPLOAD_GRANT_FAILED", "업로드 발급 기록을 저장하지 못했습니다");
  return recipeJson({ bucket: "uploads", path, token: data.token });
}
