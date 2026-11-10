import { analysisSchema, type Analysis } from "../ai/analysis";
import type { ClaudePort } from "../ai/claude";
import type { EmbeddingPort } from "../ai/embedding";
import type { InterviewRepository } from "../db/interview";
import { InterviewError } from "./errors";
import { confirmedAnswers, matchDictionary } from "./sensory";

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
  const started = performance.now();
  const recipe = await requireRecipe(repo, owner, id);
  if (!recipe.transcript?.trim()) throw new InterviewError(422, "TRANSCRIPT_REQUIRED", "먼저 녹음 또는 텍스트를 저장해 주세요");
  const recipe_ms = Math.round(performance.now() - started);
  const lookupStarted = performance.now();
  const [history, dictionary, previous] = await Promise.all([
    repo.listMessages(owner, id),
    repo.listDictionary(owner),
    repo.getAnalysis(owner, id),
  ]);
  const lookup_ms = Math.round(performance.now() - lookupStarted);
  const aiStarted = performance.now();
  const modelDictionary = dictionary.map(({ id, expression, dimension, context, food_name, resolved_value, confidence, confirmations }) =>
    ({ id, expression, dimension, context, food_name, resolved_value, confidence, confirmations }));
  const a = analysisSchema.parse(await ai.analyzeJson({ transcript: recipe.transcript, dictionary: modelDictionary, history, previous_analysis: previous ?? undefined }));
  const ai_ms = Math.round(performance.now() - aiStarted);
  const postprocessStarted = performance.now();
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
  const postprocess_ms = Math.round(performance.now() - postprocessStarted);
  const saveStarted = performance.now();
  await repo.saveAnalysis(owner, id, a, history.at(-1)?.id ?? null);
  const answer = history.findLast(message => message.role === "user");
  if (answer) {
    const terms = confirmedAnswers(a, previous ?? undefined, answer.content);
    try {
      await Promise.all(terms.map(async term => {
        const repeated = dictionary.some(entry => entry.expression === term.expression &&
          entry.dimension === term.dimension && entry.context === term.context &&
          entry.food_name === a.recipe.food_name && entry.resolved_value === term.interpreted_value &&
          entry.confirmations > 0);
        await repo.addCase(owner, {
          recipe_id: id, message_id: answer.id, expression: term.expression,
          dimension: term.dimension, context: term.context, food_name: a.recipe.food_name,
          resolved_value: term.interpreted_value!, evidence: answer.content,
          embedding: await embedding.embed(`${term.dimension}: ${term.expression}`),
          confidence: repeated ? 0.9 : 0.6,
        });
      }));
    } catch (error) {
      console.error("sensory confirmation failed", { code: "SENSORY_SAVE_FAILED", candidates: terms.length });
      throw error;
    }
  }
  console.info("recipe analysis timing", { recipe_ms, lookup_ms, ai_ms, postprocess_ms,
    save_ms: Math.round(performance.now() - saveStarted), total_ms: Math.round(performance.now() - started) });
  return analysisDto(a);
}
