import { z } from "zod";

const nullableText = z.string().nullable();
const confidence = z.number().min(0).max(1);
const rule = z.union([z.string(), z.object({ rule: z.string(), rationale: nullableText })]);
export const ingredientSchema = z.object({
  name: z.string().min(1), amount: z.number().nonnegative().nullable(), unit: nullableText,
  original_expression: z.string(), optional: z.boolean(), confidence,
});
export const questionSchema = z.object({
  id: z.string().min(1), priority: z.enum(["P0", "P1", "P2"]), expression: z.string(),
  question: z.string().min(1), options: z.array(z.string()).min(2).max(4),
  allow_free_text: z.literal(true), allow_voice: z.literal(true), ask_now: z.boolean(),
});
export const analysisSchema = z.object({
  normalized_transcript: z.string(),
  asr_uncertainties: z.array(z.object({
    original: z.string(), candidate: z.string(), confidence, needs_confirmation: z.boolean(),
  })),
  recipe: z.object({
    food_name: z.string(), food_types: z.array(z.string()), servings: z.number().positive().nullable(),
    components: z.array(z.object({ name: z.string(), ingredients: z.array(z.union([z.string(), ingredientSchema])), step_orders: z.array(z.number().int().positive()) })),
    equipment: z.array(z.string()),
    environment: z.object({ season: nullableText, room_temperature_c: z.number().nullable(), humidity_sensitive: z.boolean() }),
    ingredients: z.array(ingredientSchema),
    steps: z.array(z.object({
      order: z.number().int().positive(), action: z.string(), heat: nullableText,
      duration_seconds: z.number().nonnegative().nullable(), sensory_cues: z.array(z.string()),
      rationale: nullableText, sensory_expressions: z.array(z.string()),
      parallel_with: z.array(z.number().int().positive()), safety_checkpoint: nullableText,
    })),
  }),
  detected_sensory_terms: z.array(z.object({
    expression: z.string(), category: z.string(), dimension: z.string(), context: z.string(),
    interpreted_value: nullableText, source: z.string(), confidence, needs_confirmation: z.boolean(),
  })),
  auto_applied: z.array(z.object({ expression: z.string(), dictionary_entry_id: z.string(), applied_value: z.string(), reason: z.string() })),
  questions: z.array(questionSchema), pending_questions: z.array(questionSchema),
  card: z.object({
    must_keep: z.array(rule), can_change: z.array(rule), unresolved: z.array(z.string()),
    context: z.object({ occasion: nullableText, for_whom: nullableText, servings: z.number().positive().nullable(), tools: z.array(z.string()) }),
    storage: z.object({ method: nullableText, duration: nullableText, reheating: nullableText }),
  }),
}).superRefine((value, ctx) => {
  const now = [...value.questions, ...value.pending_questions].filter(q => q.ask_now);
  if (now.length > 1 || now.some(q => q.priority !== "P0") || value.pending_questions.some(q => q.ask_now)) {
    ctx.addIssue({ code: "custom", message: "즉시 질문은 P0 하나만 허용하며 나머지는 대기한다" });
  }
});
export type Analysis = z.infer<typeof analysisSchema>;
