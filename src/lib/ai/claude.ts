export interface StructuredRecipe {
  title: string;
  ingredients: Array<{ name: string; amount: string; unit?: string }>;
  steps: Array<{ order: number; description: string }>;
  context_summary?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  options: string[];
  allow_free_text: boolean;
}

export interface AutoAppliedEntry {
  expression: string;
  resolved_value: string;
  confidence: number;
}

export interface AnalyzeResult {
  structured: StructuredRecipe;
  questions: QuestionOption[];
  auto_applied: AutoAppliedEntry[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_url?: string;
}

export interface ClaudePort {
  analyzeJson(
    transcript: string,
    autoApplied: AutoAppliedEntry[],
    asrUncertainties?: string[],
  ): Promise<AnalyzeResult>;
  chatStream(
    messages: ChatMessage[],
    systemPrompt: string,
    onChunk: (text: string) => void,
  ): Promise<string>;
}
