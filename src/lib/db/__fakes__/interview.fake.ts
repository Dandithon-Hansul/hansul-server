import type { Analysis } from "../../ai/analysis";
import type { ChatMessage, DictionaryEntry } from "../../ai/claude";
import type { InterviewRecipe, InterviewRepository, SensoryCase, StoredMessage } from "../interview";

export class FakeInterviewRepository implements InterviewRepository {
  recipe: InterviewRecipe = { id: "recipe", transmitter_id: "owner", status: "draft", visibility: "private", transcript: "소금을 쪼매 넣어요." };
  analysis: Analysis | null = null;
  messages: StoredMessage[] = [];
  cases: SensoryCase[] = [];
  dictionary: DictionaryEntry[] = [];
  confirmedCount = 0;
  publishCalls = 0;
  profileVector: number[] | null = null;
  vectorOwner: string | null = null;
  async getRecipe(owner: string, id: string) { return owner === this.recipe.transmitter_id && id === this.recipe.id ? this.recipe : null; }
  async getAnalysis() { return this.analysis; }
  async listMessages() { return [...this.messages]; }
  async listDictionary() { return this.dictionary; }
  async saveProfileVector(owner: string, vector: number[]) { this.vectorOwner = owner; this.profileVector = vector; }
  async saveAnalysis(_owner: string, _id: string, a: Analysis) { this.analysis = a; }
  async appendMessage(_owner: string, _id: string, message: ChatMessage & { audio_url?: string | null }) {
    const id = `message-${this.messages.length + 1}`; this.messages.push({ ...message, id }); return id;
  }
  async addCase(_owner: string, item: SensoryCase) { this.cases.push(item); this.confirmedCount++; }
  async countConfirmed() { return this.confirmedCount; }
  quote: string | null = null;
  quoteAudioUrl: string | null = null;
  async publish(owner: string, id: string, _analysis: Analysis, quote?: string) { this.quote = quote ?? null; this.recipe.status = "published"; this.recipe.visibility = "public"; this.publishCalls++; return this.publishedResult(owner, id); }
  async publishedResult(_owner: string, id: string) { return { recipe_id: id, status: "published" as const, context_summary: "가족 레시피", transmitter_quote: this.quote, voice_message_url: this.quoteAudioUrl }; }
  async storeQuoteAudio() { this.quoteAudioUrl = "https://example.test/quote.mp3"; }
  async storeAudio(_owner: string, _id: string, name: string) { return `https://example.test/${name}.mp3`; }
  async resolveImage() { return "https://example.test/image.png"; }
}
