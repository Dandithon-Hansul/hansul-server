import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deps: vi.fn(),
  publish: vi.fn(),
}));

vi.mock("@/lib/interview/dependencies", () => ({ interviewDependencies: mocks.deps }));
vi.mock("@/lib/services/publish", () => ({ publishRecipe: mocks.publish }));

import { POST } from "@/app/api/recipes/route";

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
  mocks.publish.mockResolvedValue({ recipe_id: RECIPE_ID, status: "published" });
});

describe("POST /api/recipes (레시피 초안 발행)", () => {
  it("TC-R-10: 미인증 (userId null) → 401", async () => {
    mocks.deps.mockResolvedValue(makeDeps(null));
    const r = await POST(new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID }),
    }));
    expect(r.status).toBe(401);
  });

  it("TC-R-09: recipe_id 누락 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(r.status).toBe(422);
  });

  it("TC-R-09b: recipe_id UUID 형식 오류 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: "not-a-uuid" }),
    }));
    expect(r.status).toBe(422);
  });

  it("TC-R-08: transmitter_quote 301자 → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, transmitter_quote: "가".repeat(301) }),
    }));
    expect(r.status).toBe(422);
  });

  it("TC-R-06: 필수 필드만 → 200", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID }),
    }));
    expect(r.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith(expect.anything(), "user-1", RECIPE_ID, expect.objectContaining({ quote: undefined }));
  });

  it("TC-R-07: transmitter_quote 포함 → 200, quote 전달", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/recipes", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: RECIPE_ID, transmitter_quote: "할머니의 손맛" }),
    }));
    expect(r.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.anything(), "user-1", RECIPE_ID,
      expect.objectContaining({ quote: "할머니의 손맛" }),
    );
  });
});
