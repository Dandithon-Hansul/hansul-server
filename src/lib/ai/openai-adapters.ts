import "server-only";
import OpenAI from "openai";
import type { TtsPort } from "./tts";
import type { EmbeddingPort } from "./embedding";

export class OpenAiTts implements TtsPort {
  constructor(private client = new OpenAI()) {}
  async synthesize(text: string) {
    const response = await this.client.audio.speech.create({ model: "tts-1", voice: "alloy", input: text, response_format: "mp3" });
    return Buffer.from(await response.arrayBuffer());
  }
}
export class OpenAiEmbedding implements EmbeddingPort {
  constructor(private client = new OpenAI()) {}
  async embed(input: string) {
    const response = await this.client.embeddings.create({ model: "text-embedding-3-small", dimensions: 1536, input });
    const vector = response.data[0]?.embedding;
    if (!vector || vector.length !== 1536 || !vector.every(Number.isFinite)) throw new Error("INVALID_EMBEDDING");
    return vector;
  }
}
