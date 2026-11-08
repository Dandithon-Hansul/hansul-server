import { z } from "zod";
import type { EmbeddingPort } from "../ai/embedding";
import type { InterviewRepository } from "../db/interview";
import { InterviewError } from "./errors";

export async function vectorizeProfile(repo: InterviewRepository, embedding: EmbeddingPort, owner: string) {
  const entries = (await repo.listDictionary(owner)).filter(e => e.confirmations > 0 && e.confidence > 0 && e.resolved_value.trim());
  if (!entries.length) throw new InterviewError(422, "SENSORY_INSUFFICIENT", "확정된 감각 항목이 한 개 이상 필요합니다");
  const profileSummary = [...new Set(entries.map(e => `${e.food_name} · ${e.context} · ${e.dimension}: ${e.expression} = ${e.resolved_value}`))].sort().join("\n");
  const vector = z.array(z.number()).length(1536).parse(await embedding.embed(profileSummary));
  await repo.saveProfileVector(owner, vector);
  return {
    profile_summary: profileSummary,
    dimensions: {
      salt_intensity: null,
      liquid_reduction: null,
      sweet_ratio: null,
      browning_preference: null,
      spice_tolerance: null,
    },
    vector_updated: true,
  };
}
