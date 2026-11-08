import type { EmbeddingPort } from "../embedding";

export class FakeEmbedding implements EmbeddingPort {
  async embed(): Promise<number[]> {
    return Array.from({ length: 1536 }, (_, i) => (i % 2 === 0 ? 0.1 : -0.1));
  }
}
