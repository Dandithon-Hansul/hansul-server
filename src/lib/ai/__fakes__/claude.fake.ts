import type { ClaudePort, AnalyzeResult, ChatMessage } from "../claude";

export class FakeClaude implements ClaudePort {
  async analyzeJson(): Promise<AnalyzeResult> {
    return {
      structured: {
        title: "테스트 레시피",
        ingredients: [{ name: "재료1", amount: "100", unit: "g" }],
        steps: [{ order: 1, description: "1번 단계" }],
      },
      questions: [
        {
          id: "q1",
          text: "'쪼매'는 얼마나 되나요?",
          options: ["한 티스푼", "한 큰술", "한 국자"],
          allow_free_text: true,
        },
      ],
      auto_applied: [],
    };
  }

  async chatStream(
    _messages: ChatMessage[],
    _systemPrompt: string,
    onChunk: (text: string) => void,
  ): Promise<string> {
    const response = "알겠습니다, 더 자세히 설명해 주세요.";
    onChunk(response);
    return response;
  }
}
