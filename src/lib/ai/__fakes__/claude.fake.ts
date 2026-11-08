import type { ClaudePort, ChatMessage } from "../claude";
import { analysisFixture } from "./analysis.fixture";

export class FakeClaude implements ClaudePort {
  async analyzeJson() { return analysisFixture(); }
  async chatStream(_messages: ChatMessage[], _systemPrompt: string, onChunk: (text: string) => void) {
    const response = "소금은 어떤 숟가락으로 넣으세요?";
    onChunk(response);
    return response;
  }
}
