import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deps: vi.fn(),
  analyze: vi.fn(),
}));

vi.mock("@/lib/interview/dependencies", () => ({ interviewDependencies: mocks.deps }));
vi.mock("@/lib/services/analyze", () => ({ analyzeRecipe: mocks.analyze }));

import { POST } from "@/app/api/analyze/route";

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
  mocks.analyze.mockResolvedValue({ summary: "레시피 분석 완료" });
});

describe("POST /api/analyze", () => {
  it("TC-I-04: 미인증 (userId null) → 401", async () => {
    mocks.deps.mockResolvedValue(makeDeps(null));
    const r = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID }),
    }));
    expect(r.status).toBe(401);
  });

  it("TC-I-02: recipe_id 누락 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(r.status).toBe(422);
  });

  it("TC-I-03: recipe_id UUID 형식 오류 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: "not-a-uuid" }),
    }));
    expect(r.status).toBe(422);
  });

  it("TC-I-01: 정상 분석 → 200", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID }),
    }));
    expect(r.status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      "user-1", RECIPE_ID,
    );
    expect(log).toHaveBeenCalledWith("recipe analysis request timing", expect.objectContaining({ auth_ms: expect.any(Number), total_ms: expect.any(Number), status: 200 }));
    log.mockRestore();
  });

  it("추가 필드 포함 (strict 위반) → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, extra_field: "unexpected" }),
    }));
    expect(r.status).toBe(422);
  });
});
