import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/recipes/detail", () => ({ isRecipeSeedMode: () => false }));
vi.mock("@/lib/recipes/http", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/recipes/http")>(),
  getRecipeViewer: vi.fn(async () => "viewer-id"),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdminClient: vi.fn() }));

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/profiles/[id]/route";

describe("GET /api/profiles/:id", () => {
  it("다른 사람의 저장 수와 공개 저장 목록을 이미지 URL과 함께 반환한다", async () => {
    const signedUrl = vi.fn(async (path: string) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }));
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: {
          profile_id: "22222222-2222-4222-8222-222222222222",
          display_name: "김영희",
          avatar_url: null,
          region: null,
          bio: null,
          recipe_count: 0,
          received_like_count: 0,
          recipes: [],
          saved_recipe_count: 1,
          saved_recipes: [{
            recipe_id: "a0000001-0000-0000-0000-000000000001",
            title: "안동 찜닭",
            hero_image_url: "recipe-images/33333333-3333-3333-3333-333333333333/a0000001-0000-0000-0000-000000000001/hero.webp",
            transmitter_id: "33333333-3333-3333-3333-333333333333",
            transmitter_name: "박순자",
          }],
        },
        error: null,
      })),
      storage: { from: () => ({ createSignedUrl: signedUrl }) },
    } as never);

    const response = await GET(new Request("https://example.com/api/profiles/22222222-2222-4222-8222-222222222222", {
      headers: { authorization: "Bearer token" },
    }), { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.saved_recipe_count).toBe(1);
    expect(body.saved_recipes).toEqual([{
      recipe_id: "a0000001-0000-0000-0000-000000000001",
      title: "안동 찜닭",
      hero_image_url: "https://signed.example/33333333-3333-3333-3333-333333333333/a0000001-0000-0000-0000-000000000001/hero.webp",
      transmitter_name: "박순자",
    }]);
  });
});
