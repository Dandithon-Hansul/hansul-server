import { describe, expect, it, vi } from "vitest";
import { resolveRecipeHeroImages } from "./media";

describe("resolveRecipeHeroImages", () => {
  it("레시피별 소유 경로를 서명 URL로 변환하고 파일명만 있는 값은 null로 처리한다", async () => {
    const createSignedUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }));
    const db = { storage: { from: vi.fn(() => ({ createSignedUrl })) } };
    const rows = [
      { id: "recipe-1", transmitter_id: "owner-1", hero_image_url: "recipe-images/owner-1/recipe-1/hero.webp" },
      { id: "recipe-2", transmitter_id: "owner-2", hero_image_url: "hero.webp" },
    ];

    const resolved = await resolveRecipeHeroImages(db as never, rows);

    expect(resolved.map((row) => row.hero_image_url)).toEqual([
      "https://signed.example/owner-1/recipe-1/hero.webp",
      null,
    ]);
    expect(createSignedUrl).toHaveBeenCalledOnce();
  });
});
