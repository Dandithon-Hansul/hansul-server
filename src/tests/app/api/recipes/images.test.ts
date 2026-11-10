import { beforeEach, describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  generate: vi.fn(),
  deps: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ resolveUserId: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({}) }));
vi.mock("@/lib/services/step-images", () => ({ generateStepImages: mocks.generate }));
vi.mock("@/lib/recipes/step-image-dependencies", () => ({ stepImageDependencies: mocks.deps }));

import { POST } from "@/app/api/steps/images/route";
import { InterviewError } from "@/lib/services/errors";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue("user-1");
  mocks.deps.mockReturnValue({});
});

describe("POST /api/steps/images", () => {
  it("TC-R-16: 미인증 → 401", async () => {
    mocks.user.mockResolvedValue(null);
    const r = await POST(new Request("http://localhost/api/steps/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    }));
    expect(r.status).toBe(401);
  });

  it("TC-R-16b: recipe_id 누락 → 400", async () => {
    const r = await POST(new Request("http://localhost/api/steps/images", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(r.status).toBe(400);
  });

  it("TC-R-16c: recipe_id UUID 형식 오류 → 400", async () => {
    const r = await POST(new Request("http://localhost/api/steps/images", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: "not-a-uuid" }),
    }));
    expect(r.status).toBe(400);
  });

  it("TC-R-14: 이미지 생성 성공 → 200, generated/failed_orders 포함", async () => {
    const result = {
      generated: [{ order: 1, image_url: "https://example.com/img.jpg", prompt_used: "볶는다" }],
      failed_orders: [],
    };
    mocks.generate.mockResolvedValue(result);
    const r = await POST(new Request("http://localhost/api/steps/images", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.generated).toHaveLength(1);
    expect(body.failed_orders).toHaveLength(0);
  });

  it("TC-R-15: 존재하지 않는 레시피 → 404", async () => {
    mocks.generate.mockRejectedValue(new InterviewError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다."));
    const r = await POST(new Request("http://localhost/api/steps/images", {
      method: "POST",
      headers: { authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    }));
    expect(r.status).toBe(404);
  });
});
