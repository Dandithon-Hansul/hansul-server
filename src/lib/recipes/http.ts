import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const recipeIdSchema = z.guid();
const headers = { "Cache-Control": "private, no-store" };

export function recipeJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}

export function recipeError(status: number, code: string, message: string) {
  return recipeJson({ code, message, details: {} }, status);
}

export async function getRecipeViewer(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return null;

  const { data, error } = await createSupabaseServerClient().auth.getUser(token);
  if (error && error.status !== 400 && error.status !== 401 && error.status !== 403) throw error;
  return error ? null : data.user?.id ?? null;
}
