import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("@/lib/recipes/detail", () => ({
  isRecipeSeedMode: () => false,
  getRecipeDetail: vi.fn(),
}));
vi.mock("@/lib/recipes/http", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/recipes/http")>(),
  getRecipeViewer: vi.fn(),
}));

import { GET } from "@/app/api/recipes/[id]/route";
import { getRecipeViewer } from "@/lib/recipes/http";
import { getRecipeDetail } from "@/lib/recipes/detail";

const RECIPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARAMS = { params: Promise.resolve({ id: RECIPE_ID }) };

beforeEach(() => vi.resetAllMocks());

describe("GET /api/recipes/:id", () => {
  it("TC-R-19: UUID 형식 오류 → 400", async () => {
    const r = await GET(
      new Request("http://localhost/api/recipes/not-a-uuid"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(r.status).toBe(400);
  });

  it("TC-R-20: 미인증 → 401", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue(null);
    const r = await GET(new Request("http://localhost/api/recipes/" + RECIPE_ID), PARAMS);
    expect(r.status).toBe(401);
  });

  it("TC-R-20b: 존재하지 않는 ID → 404", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    vi.mocked(getRecipeDetail).mockResolvedValue({ status: "missing" });
    const r = await GET(
      new Request("http://localhost/api/recipes/" + RECIPE_ID, {
        headers: { authorization: "Bearer valid" },
      }),
      PARAMS,
    );
    expect(r.status).toBe(404);
  });

  it("TC-R-21: 비공개 레시피 타인 접근 → 403", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("other-user");
    vi.mocked(getRecipeDetail).mockResolvedValue({ status: "forbidden" });
    const r = await GET(
      new Request("http://localhost/api/recipes/" + RECIPE_ID, {
        headers: { authorization: "Bearer other" },
      }),
      PARAMS,
    );
    expect(r.status).toBe(403);
  });

  it("TC-R-18: 공개 레시피 조회 → 200", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    vi.mocked(getRecipeDetail).mockResolvedValue({
      status: "ok",
      recipe: { recipe_id: RECIPE_ID, title: "안동찜닭" },
    } as never);
    const r = await GET(
      new Request("http://localhost/api/recipes/" + RECIPE_ID, {
        headers: { authorization: "Bearer valid" },
      }),
      PARAMS,
    );
    expect(r.status).toBe(200);
  });
});
