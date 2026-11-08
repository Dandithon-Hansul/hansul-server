import type { TtsPort } from "../tts";

export class FakeTts implements TtsPort {
  async synthesize(): Promise<Buffer> {
    return Buffer.from("fake-audio-data");
  }
}
