import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiEmbedding, OpenAiTts } from "./openai-adapters";

afterEach(() => vi.unstubAllEnvs());

describe("OpenAiTts", () => {
  it("uses TTS_MODEL from the environment", async () => {
    vi.stubEnv("TTS_MODEL", "custom-tts");
    const create = vi.fn().mockResolvedValue({ arrayBuffer: async () => Uint8Array.from([1, 2]).buffer });
    const client = { audio: { speech: { create } } } as unknown as OpenAI;

    await new OpenAiTts(client).synthesize("hello");

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: "custom-tts" }));
  });
});

describe("OpenAiEmbedding", () => {
  it("uses EMBEDDING_MODEL from the environment", async () => {
    vi.stubEnv("EMBEDDING_MODEL", "custom-embedding");
    const create = vi.fn().mockResolvedValue({ data: [{ embedding: Array(1536).fill(0.1) }] });
    const client = { embeddings: { create } } as unknown as OpenAI;

    await new OpenAiEmbedding(client).embed("hello");

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: "custom-embedding" }));
  });
});
