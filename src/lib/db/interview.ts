import type { Analysis } from "../ai/analysis";
import type { ChatMessage, DictionaryEntry } from "../ai/claude";

export interface InterviewRecipe {
  id: string; transmitter_id: string; status: "draft" | "published";
  visibility: "public" | "private"; transcript: string | null;
}
export interface StoredMessage extends ChatMessage { id: string; audio_url?: string | null }
export interface SensoryCase {
  recipe_id: string; message_id: string; expression: string; dimension: string;
  context: string; food_name: string; resolved_value: string; evidence: string;
  embedding: number[]; confidence: number;
}
export interface PublishResult { recipe_id: string; status: "published"; context_summary: string; voice_message_url: string | null }
export interface InterviewRepository {
  getRecipe(owner: string, id: string): Promise<InterviewRecipe | null>;
  getAnalysis(owner: string, id: string): Promise<Analysis | null>;
  listMessages(owner: string, id: string): Promise<StoredMessage[]>;
  listDictionary(owner: string): Promise<DictionaryEntry[]>;
  saveAnalysis(owner: string, id: string, analysis: Analysis, lastMessageId: string | null): Promise<void>;
  appendMessage(owner: string, id: string, message: ChatMessage & { audio_url?: string | null }): Promise<string>;
  addCase(owner: string, item: SensoryCase): Promise<void>;
  countConfirmed(owner: string, id: string): Promise<number>;
  publish(owner: string, id: string, expectedAnalysis: Analysis): Promise<PublishResult>;
  publishedResult(owner: string, id: string): Promise<PublishResult>;
  storeAudio(owner: string, id: string, name: string, audio: Buffer): Promise<string>;
  resolveImage(owner: string, id: string, path: string): Promise<string>;
}
