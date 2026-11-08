import type { TtsPort } from "../tts";

export class FakeTts implements TtsPort {
  async synthesize(text: string): Promise<Buffer> {
    return Buffer.from(`fake-audio-data:${text}`);
  }
}
