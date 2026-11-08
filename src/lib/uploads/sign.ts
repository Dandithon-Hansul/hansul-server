import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recipeError, recipeJson } from "@/lib/recipes/http";

const PURPOSES = {
  stt_audio: {
    bucket: "uploads",
    maxBytes: 25 * 1024 * 1024,
    allowedTypes: ["audio/webm", "audio/mp4", "audio/wav"],
    requiresRecipeId: false,
  },
  card_voice: {
    bucket: "uploads",
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ["audio/webm", "audio/mp4", "audio/wav"],
    requiresRecipeId: true,
  },
  chat_image: {
    bucket: "uploads",
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    requiresRecipeId: true,
  },
} as const;

type Purpose = keyof typeof PURPOSES;

export interface SignUploadInput {
  purpose: string;
  content_type: string;
  size_bytes: number;
  recipe_id?: string;
}

export async function signUpload(userId: string | null, input: SignUploadInput) {
  if (!userId) return recipeError(401, "UNAUTHORIZED", "인증이 필요합니다");

  const config = PURPOSES[input.purpose as Purpose];
  if (!config) return recipeError(400, "INVALID_PURPOSE", "지원하지 않는 업로드 용도입니다");

  if (input.size_bytes > config.maxBytes) {
    return recipeError(413, "FILE_TOO_LARGE", "파일 크기 초과");
  }

  if (!config.allowedTypes.includes(input.content_type as never)) {
    return recipeError(415, "UNSUPPORTED_MEDIA_TYPE", "지원하지 않는 파일 형식입니다");
  }

  if (config.requiresRecipeId && !input.recipe_id) {
    return recipeError(400, "RECIPE_ID_REQUIRED", "recipe_id가 필요합니다");
  }

  const ext = input.content_type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${input.purpose}/${crypto.randomUUID()}.${ext}`;

  const db = createSupabaseAdminClient();
  const { data, error } = await db.storage.from(config.bucket).createSignedUploadUrl(path);
  if (error) return recipeError(500, "STORAGE_ERROR", "파일 저장 실패");

  return recipeJson({ bucket: config.bucket, path: data.path, token: data.token });
}
