import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recipes/http", () => ({
  getRecipeViewer: vi.fn(),
  recipeError: (status: number, code: string, message: string) =>
    Response.json({ code, message, details: {} }, { status }),
  recipeJson: (body: unknown, status = 200) => Response.json(body, { status }),
}));
vi.mock("@/lib/services/recommendations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/recommendations")>()),
  getRecommendedRecipes: vi.fn(),
}));

import { GET } from "@/app/api/recommendations/route";
import { getRecipeViewer } from "@/lib/recipes/http";
import { getRecommendedRecipes } from "@/lib/services/recommendations";

describe("GET /api/recommendations", () => {
  beforeEach(() => {
    vi.mocked(getRecipeViewer).mockReset();
    vi.mocked(getRecommendedRecipes).mockReset();
  });

  it("인증되지 않은 요청을 거부한다", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/recommendations"));

    expect(response.status).toBe(401);
  });

  it("잘못된 limit을 거부한다", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");

    const response = await GET(new Request("http://localhost/api/recommendations?limit=0"));

    expect(response.status).toBe(422);
  });

  it("기본 limit 10으로 추천 레시피 배열을 반환한다", async () => {
    vi.mocked(getRecipeViewer).mockResolvedValue("user-1");
    vi.mocked(getRecommendedRecipes).mockResolvedValue([
      {
        recipe_id: "recipe-1",
        title: "대구식 육개장",
        hero_image_url: null,
        region_tag: "대구 중구",
        transmitter_quote: "파를 듬뿍 넣어요",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/recommendations"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recipes: [
        {
          recipe_id: "recipe-1",
          title: "대구식 육개장",
          hero_image_url: null,
          region_tag: "대구 중구",
          transmitter_quote: "파를 듬뿍 넣어요",
        },
      ],
    });
    expect(getRecommendedRecipes).toHaveBeenCalledWith("user-1", 10);
  });
});
