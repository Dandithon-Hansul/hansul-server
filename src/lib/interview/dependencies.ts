import "server-only";
import { resolveUserId } from "../auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../supabase/server";
import { SupabaseInterviewRepository } from "../db/supabase-interview";
import { ClaudeAdapter } from "../ai/claude-adapter";
import { OpenAiEmbedding, OpenAiTts } from "../ai/openai-adapters";
import type { InterviewDependencies } from "./http";

export async function interviewDependencies(request: Request): Promise<InterviewDependencies> {
  const userId = await resolveUserId(createSupabaseServerClient(), request);
  return {
    userId,
    get repo() { return new SupabaseInterviewRepository(createSupabaseAdminClient()); },
    get ai() { return new ClaudeAdapter(); },
    embedding: { embed: text => new OpenAiEmbedding().embed(text) },
    tts: { synthesize: text => new OpenAiTts().synthesize(text) },
  };
}
