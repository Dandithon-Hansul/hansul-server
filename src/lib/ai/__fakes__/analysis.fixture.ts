import type { Analysis } from "../analysis";

export function analysisFixture(): Analysis {
  return {
    normalized_transcript: "소금을 쪼매 넣어요.", asr_uncertainties: [],
    recipe: {
      food_name: "나물무침", food_types: ["나물"], servings: null, components: [], equipment: [],
      environment: { season: null, room_temperature_c: null, humidity_sensitive: false },
      ingredients: [{ name: "소금", amount: null, unit: null, original_expression: "쪼매", optional: false, confidence: 0 }],
      steps: [{ order: 1, action: "소금을 넣고 무쳐요.", heat: null, duration_seconds: null, sensory_cues: [], rationale: null, sensory_expressions: ["쪼매"], parallel_with: [], safety_checkpoint: null }],
    },
    detected_sensory_terms: [{ expression: "쪼매", category: "amount", dimension: "salt_intensity", context: "나물 간하기", interpreted_value: null, source: "current_transcript", confidence: 0, needs_confirmation: true }],
    auto_applied: [], questions: [{ id: "q1", priority: "P0", expression: "쪼매", question: "소금은 어떤 숟가락으로 넣으세요?", options: ["밥숟가락", "찻숟가락"], allow_free_text: true, allow_voice: true, ask_now: true }],
    pending_questions: [], card: {
      must_keep: [], can_change: [], unresolved: ["소금 양"],
      context: { occasion: null, for_whom: null, servings: null, tools: [] },
      storage: { method: null, duration: null, reheating: null },
    },
  };
}
