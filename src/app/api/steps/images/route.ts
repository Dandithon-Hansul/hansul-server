import { z } from "zod";

import { resolveUserId } from "@/lib/auth";
import { interviewFailure } from "@/lib/interview/http";
import { recipeError, recipeJson } from "@/lib/recipes/http";
import { stepImageDependencies } from "@/lib/recipes/step-image-dependencies";
import { generateStepImages } from "@/lib/services/step-images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const inputSchema = z.strictObject({ recipe_id: z.uuid() });

export async function POST(request: Request) {
  try {
    const owner = await resolveUserId(createSupabaseServerClient(), request);
    if (!owner) return recipeError(401, "UNAUTHORIZED", "인증이 필요합니다");
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return recipeError(400, "INVALID_INPUT", "레시피 ID를 확인해 주세요");
    return recipeJson(await generateStepImages(stepImageDependencies(), owner, input.data.recipe_id));
  } catch (error) {
    return interviewFailure(error);
  }
}
