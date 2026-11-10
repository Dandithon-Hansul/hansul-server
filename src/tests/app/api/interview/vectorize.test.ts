import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deps: vi.fn(),
  vectorize: vi.fn(),
}));

vi.mock("@/lib/interview/dependencies", () => ({ interviewDependencies: mocks.deps }));
vi.mock("@/lib/services/vectorize", () => ({ vectorizeProfile: mocks.vectorize }));

import { POST } from "@/app/api/sensory/vectorize/route";

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
  mocks.vectorize.mockResolvedValue({ vectorized: true });
});

describe("POST /api/sensory/vectorize", () => {
  it("TC-I-14: 미인증 (userId null) → 401", async () => {
    mocks.deps.mockResolvedValue(makeDeps(null));
    const r = await POST(new Request("http://localhost/api/sensory/vectorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(r.status).toBe(401);
  });

  it("TC-I-13: 빈 바디 → 200", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/sensory/vectorize", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(r.status).toBe(200);
    expect(mocks.vectorize).toHaveBeenCalledWith(expect.anything(), expect.anything(), "user-1");
  });

  it("바디에 추가 필드 포함 (strict 위반) → 422", async () => {
    mocks.deps.mockResolvedValue(makeDeps("user-1"));
    const r = await POST(new Request("http://localhost/api/sensory/vectorize", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ extra: "field" }),
    }));
    expect(r.status).toBe(422);
  });
});
