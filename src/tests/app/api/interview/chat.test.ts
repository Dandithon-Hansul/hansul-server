import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deps: vi.fn(),
  chat: vi.fn(),
}));

vi.mock("@/lib/interview/dependencies", () => ({ interviewDependencies: mocks.deps }));
vi.mock("@/lib/services/chat", () => ({ chatRecipe: mocks.chat }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { POST } from "@/app/api/chat/route";

const RECIPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeDeps(userId: string | null) {
  return {
    userId,
    get repo() { return {}; },
    get ai() { return {}; },
    embedding: { embed: vi.fn() },
    tts: { synthesize: vi.fn() },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.chat.mockResolvedValue(undefined);
});

describe("POST /api/chat", () => {
  it("TC-I-10: 미인증 (userId null) → 401", async () => {
    mocks.deps.mockResolvedValue(makeDeps(null));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, message: "안녕" }),
    }));
    expect(r.status).toBe(401);
  });

  it("TC-I-08: message 빈 문자열 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, message: "" }),
    }));
    expect(r.status).toBe(422);
  });

  it("TC-I-09: message 8001자 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, message: "가".repeat(8001) }),
    }));
    expect(r.status).toBe(422);
  });

  it("recipe_id 누락 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "안녕" }),
    }));
    expect(r.status).toBe(422);
  });

  it("TC-I-05: 기본 텍스트 메시지 → 200 SSE 스트림", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, message: "간장은 얼마나 넣나요?" }),
    }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
  });

  it("TC-I-06: tts=true → 200 SSE, chatRecipe에 tts 포함 deps 전달", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, message: "설명해줘", tts: true }),
    }));
    expect(r.status).toBe(200);
  });

  it("TC-I-07: image_path 포함 → 200 SSE", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, message: "이 재료 맞나요?", image_path: "uploads/chat/img.jpg" }),
    }));
    expect(r.status).toBe(200);
  });
});
