export interface TtsPort {
  synthesize(text: string): Promise<Buffer>;
}
