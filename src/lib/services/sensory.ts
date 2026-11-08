import type { Analysis } from "../ai/analysis";
import type { DictionaryEntry } from "../ai/claude";
type Term = Analysis["detected_sensory_terms"][number];

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm ? a.reduce((sum, n, i) => sum + n * b[i], 0) / norm : 0;
}
export function matchDictionary(term: Term, food: string, embedding: number[] | null, entries: DictionaryEntry[]) {
  const context = entries.filter(e => e.dimension === term.dimension && e.context === term.context && e.food_name === food && e.confidence > 0 && e.confirmations > 0);
  const exact = context.filter(e => e.expression === term.expression);
  const candidates = exact.length ? exact : context.filter(e => embedding && e.embedding && cosine(embedding, e.embedding) >= 0.85);
  if (!candidates.length || new Set(candidates.map(e => e.resolved_value)).size > 1) return null;
  if (term.interpreted_value && !term.needs_confirmation && candidates[0].resolved_value !== term.interpreted_value) return null;
  return candidates[0];
}
export function confirmedAnswers(a: Analysis, previous: Analysis | undefined, message: string) {
  if (!previous) return [];
  const asked = previous.questions.filter(q => q.ask_now).map(q => q.expression);
  return a.detected_sensory_terms.filter(t =>
    asked.includes(t.expression) && t.source === "user_answer" && !t.needs_confirmation &&
    t.interpreted_value?.trim() && message.includes(t.interpreted_value),
  );
}
