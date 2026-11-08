import { analysisSchema, type Analysis } from "../ai/analysis";
import type { ClaudePort } from "../ai/claude";
import type { EmbeddingPort } from "../ai/embedding";
import type { InterviewRepository } from "../db/interview";
import { InterviewError } from "./errors";
import { matchDictionary } from "./sensory";

export async function requireRecipe(repo: InterviewRepository, owner: string, id: string, draft = true) {
  const recipe = await repo.getRecipe(owner, id);
  if (!recipe) throw new InterviewError(404, "NOT_FOUND", "레시피를 찾을 수 없습니다");
  if (draft && recipe.status !== "draft") throw new InterviewError(409, "NOT_DRAFT", "초안만 수정할 수 있습니다");
  return recipe;
}
export function analysisDto(a: Analysis) {
  return {
    structured: {
      ingredients: a.recipe.ingredients.map(i => ({ name: i.name, amount: i.amount, unit: i.unit })),
      steps: a.recipe.steps.map(s => ({ order: s.order, action: s.action, sensory_expressions: s.sensory_expressions })),
      context: { occasion: a.card.context.occasion, for_whom: a.card.context.for_whom, season: a.recipe.environment.season },
    },
    questions: [...a.questions, ...a.pending_questions].map(q => ({
      expression: q.expression, question: q.question, options: q.options, already_known: false,
      id: q.id, priority: q.priority, ask_now: q.ask_now, allow_free_text: q.allow_free_text, allow_voice: q.allow_voice,
    })),
    auto_applied: a.auto_applied.map(e => ({ expression: e.expression, applied_value: e.applied_value })),
  };
}
export async function analyzeRecipe(repo: InterviewRepository, ai: ClaudePort, embedding: EmbeddingPort, owner: string, id: string) {
  const recipe = await requireRecipe(repo, owner, id);
  if (!recipe.transcript?.trim()) throw new InterviewError(422, "TRANSCRIPT_REQUIRED", "먼저 녹음 또는 텍스트를 저장해 주세요");
  const history = await repo.listMessages(owner, id);
  const dictionary = await repo.listDictionary(owner);
  const previous = await repo.getAnalysis(owner, id);
  const a = analysisSchema.parse(await ai.analyzeJson({ transcript: recipe.transcript, dictionary, history, previous_analysis: previous ?? undefined }));
  a.auto_applied = [];
  const matches = await Promise.all(a.detected_sensory_terms.map(async term => {
    const exact = matchDictionary(term, a.recipe.food_name, null, dictionary);
    if (exact || !dictionary.length) return exact;
    return matchDictionary(term, a.recipe.food_name, await embedding.embed(`${term.dimension}: ${term.expression}`), dictionary);
  }));
  for (const [i, term] of a.detected_sensory_terms.entries()) {
    const related = a.detected_sensory_terms.map((t, j) => t.expression === term.expression ? j : -1).filter(j => j >= 0);
    const match = related.every(j => matches[j]) ? matches[i] : null;
    if (match) {
      a.auto_applied.push({ expression: term.expression, dictionary_entry_id: match.id, applied_value: match.resolved_value, reason: "같은 전승자·음식·차원·문맥의 확인 사례" });
      term.interpreted_value = match.resolved_value;
      term.needs_confirmation = false;
    } else if (term.needs_confirmation) {
      term.interpreted_value = null;
    }
  }
  for (const ingredient of a.recipe.ingredients) {
    if (ingredient.confidence === 0) ingredient.amount = null;
  }
  const applied = new Set(a.auto_applied.map(e => e.expression));
  a.questions = a.questions.filter(q => !applied.has(q.expression));
  a.pending_questions = a.pending_questions.filter(q => !applied.has(q.expression));
  await repo.saveAnalysis(owner, id, a, history.at(-1)?.id ?? null);
  return analysisDto(a);
}
