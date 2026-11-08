import type { Analysis } from "./analysis";

export interface DictionaryEntry {
  id: string;
  expression: string;
  dimension: string;
  context: string;
  food_name: string;
  resolved_value: string;
  confidence: number;
  confirmations: number;
  embedding: number[] | null;
}
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image_url?: string;
}
export interface AnalyzeInput {
  transcript: string;
  dictionary: DictionaryEntry[];
  history: ChatMessage[];
  previous_analysis?: Analysis;
}
export interface ClaudePort {
  analyzeJson(input: AnalyzeInput): Promise<Analysis>;
  chatStream(messages: ChatMessage[], systemPrompt: string, onChunk: (text: string) => void, signal?: AbortSignal): Promise<string>;
}
