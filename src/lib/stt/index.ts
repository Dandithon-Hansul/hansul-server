import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recipeError, recipeJson } from "@/lib/recipes/http";

const bodySchema = z.union([
  z.object({ audio_path: z.string().min(1), recipe_id: z.uuid().optional() }),
  z.object({ transcript: z.string().min(1), recipe_id: z.uuid().optional() }),
]);

export type SttInput = z.infer<typeof bodySchema>;

function isOwnedSttAudioPath(userId: string, audioPath: string): boolean {
  const [bucket, ownerId, purpose, ...pathParts] = audioPath.split("/");
  return bucket === "uploads" && ownerId === userId && purpose === "stt_audio" && pathParts.length === 1 && Boolean(pathParts[0]);
}

async function transcribeAudio(userId: string, audioPath: string): Promise<string> {
  const [, ownerId, purpose, filename] = audioPath.split("/");
  const bucket = "uploads";

  const db = createSupabaseAdminClient();
  const path = `${ownerId}/${purpose}/${filename}`;

  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) throw new Error("STORAGE_DOWNLOAD_FAILED");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const type = filename.endsWith(".mp4") ? "audio/mp4" : filename.endsWith(".wav") ? "audio/wav" : "audio/webm";
  const file = new File([data], filename, { type });
  const result = await openai.audio.transcriptions.create({
    file,
    model: process.env.STT_MODEL ?? "whisper-1",
    language: "ko",
  });
  return result.text;
}

async function createDraft(userId: string, transcript: string, audioPath?: string) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("recipes")
    .insert({
      transmitter_id: userId,
      status: "draft",
      transcript,
      ...(audioPath && { audio_url: audioPath }),
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("DB_INSERT_FAILED");
  return data.id as string;
}

async function updateDraft(userId: string, recipeId: string, transcript: string, audioPath?: string) {
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from("recipes")
    .update({
      transcript,
      ...(audioPath && { audio_url: audioPath }),
    })
    .eq("id", recipeId)
    .eq("transmitter_id", userId)
    .eq("status", "draft");

  if (error) throw new Error("DB_UPDATE_FAILED");
}

export async function processStt(userId: string | null, input: SttInput) {
  if (!userId) return recipeError(401, "UNAUTHORIZED", "인증이 필요합니다");

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return recipeError(400, "INVALID_BODY", "요청 형식이 올바르지 않습니다");

  const { recipe_id } = parsed.data;

  let transcript: string;
  let audioPath: string | undefined;

  if ("audio_path" in parsed.data) {
    audioPath = parsed.data.audio_path;
    if (!isOwnedSttAudioPath(userId, audioPath)) {
      return recipeError(400, "INVALID_AUDIO_PATH", "오디오 경로가 올바르지 않습니다");
    }
    transcript = await transcribeAudio(userId, audioPath);
  } else {
    transcript = parsed.data.transcript;
  }

  let recipeId: string;
  if (recipe_id) {
    await updateDraft(userId, recipe_id, transcript, audioPath);
    recipeId = recipe_id;
  } else {
    recipeId = await createDraft(userId, transcript, audioPath);
  }

  return recipeJson({ transcript, recipe_id: recipeId, status: "draft" });
}
