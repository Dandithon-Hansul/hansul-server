import type { TtsPort } from "../ai/tts";
import type { InterviewRepository } from "../db/interview";
import { requireRecipe } from "./analyze";
import { InterviewError } from "./errors";

export async function publishRecipe(repo: InterviewRepository, owner: string, id: string, voice?: { quote?: string; tts: TtsPort }) {
  const recipe = await requireRecipe(repo, owner, id, false);
  if (recipe.status === "published") return repo.publishedResult(owner, id);
  if (await repo.countConfirmed(owner, id) < 1) throw new InterviewError(422, "SENSORY_INSUFFICIENT", "확정된 감각 항목이 한 개 이상 필요합니다");
  const a = await repo.getAnalysis(owner, id);
  if (!a?.recipe.food_name.trim() || !a.recipe.ingredients.length || !a.recipe.steps.length) throw new InterviewError(422, "ANALYSIS_REQUIRED", "레시피 분석을 먼저 완료해 주세요");
  if (a.asr_uncertainties.some(u => u.needs_confirmation) || [...a.questions, ...a.pending_questions].some(q => q.priority === "P0")) {
    throw new InterviewError(422, "UNRESOLVED_CRITICAL", "안전·핵심 불확실성을 먼저 확인해 주세요");
  }
  const result = await repo.publish(owner, id, a, voice?.quote);
  if (!voice?.quote || result.transmitter_quote !== voice.quote || result.voice_message_url) return result;

  try {
    await repo.storeQuoteAudio(owner, id, await voice.tts.synthesize(voice.quote));
    return await repo.publishedResult(owner, id);
  } catch {
    console.warn("Recipe quote audio generation failed");
    return result;
  }
}
