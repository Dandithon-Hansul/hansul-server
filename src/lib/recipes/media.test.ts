import { describe, expect, it, vi, beforeEach } from "vitest";
import type { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  recipeMediaUrl,
  batchRecipeMediaUrls,
  resolveRecipeHeroImages,
  clearMediaUrlCache,
} from "./media";

describe("media url utilities", () => {
  beforeEach(() => {
    clearMediaUrlCache();
  });

  const createMockDb = () => {
    const createSignedUrl = vi.fn().mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://mock.storage/${path}?token=abc` },
      error: null,
    }));
    const createSignedUrls = vi.fn().mockImplementation(async (paths: string[]) => ({
      data: paths.map((p) => ({
        path: p,
        signedUrl: `https://mock.storage/${p}?token=batch_abc`,
        error: null,
      })),
      error: null,
    }));

    return {
      db: {
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl,
            createSignedUrls,
          }),
        },
      } as unknown as ReturnType<typeof createSupabaseAdminClient>,
      createSignedUrl,
      createSignedUrls,
    };
  };

  describe("recipeMediaUrl with cache", () => {
    it("returns null for empty or invalid paths", async () => {
      const { db, createSignedUrl } = createMockDb();
      expect(await recipeMediaUrl(db, null, "recipe-images", "user1/rec1")).toBeNull();
      expect(await recipeMediaUrl(db, "other-user/file.jpg", "recipe-images", "user1/rec1")).toBeNull();
      expect(await recipeMediaUrl(db, "user1/rec1/../secret.jpg", "recipe-images", "user1/rec1")).toBeNull();
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("returns https url as is without calling storage", async () => {
      const { db, createSignedUrl } = createMockDb();
      const directUrl = "https://cdn.example.com/image.jpg";
      expect(await recipeMediaUrl(db, directUrl, "recipe-images", "user1/rec1")).toBe(directUrl);
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it("creates and caches signed url", async () => {
      const { db, createSignedUrl } = createMockDb();
      const path = "recipe-images/user1/rec1/hero.jpg";

      const url1 = await recipeMediaUrl(db, path, "recipe-images", "user1/rec1");
      expect(url1).toBe("https://mock.storage/user1/rec1/hero.jpg?token=abc");
      expect(createSignedUrl).toHaveBeenCalledTimes(1);

      // Same call should hit cache and NOT call storage again
      const url2 = await recipeMediaUrl(db, path, "recipe-images", "user1/rec1");
      expect(url2).toBe(url1);
      expect(createSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe("batchRecipeMediaUrls", () => {
    it("batches requests and calls createSignedUrls once per bucket", async () => {
      const { db, createSignedUrls } = createMockDb();

      const items = [
        { key: "1", value: "recipe-images/user1/rec1/hero.jpg", bucket: "recipe-images", ownerPath: "user1/rec1" },
        { key: "2", value: "recipe-images/user2/rec2/hero.jpg", bucket: "recipe-images", ownerPath: "user2/rec2" },
        { key: "3", value: "https://external.com/pic.png", bucket: "recipe-images", ownerPath: "user3/rec3" },
        { key: "4", value: null, bucket: "recipe-images", ownerPath: "user4/rec4" },
      ];

      const results = await batchRecipeMediaUrls(db, items);

      expect(results.get("1")).toBe("https://mock.storage/user1/rec1/hero.jpg?token=batch_abc");
      expect(results.get("2")).toBe("https://mock.storage/user2/rec2/hero.jpg?token=batch_abc");
      expect(results.get("3")).toBe("https://external.com/pic.png");
      expect(results.get("4")).toBeNull();

      // Only 2 paths needed signing from recipe-images
      expect(createSignedUrls).toHaveBeenCalledTimes(1);
      expect(createSignedUrls).toHaveBeenCalledWith(["user1/rec1/hero.jpg", "user2/rec2/hero.jpg"], 600);

      // Calling again should use cache with 0 storage calls
      const cachedResults = await batchRecipeMediaUrls(db, items);
      expect(cachedResults.get("1")).toBe(results.get("1"));
      expect(createSignedUrls).toHaveBeenCalledTimes(1);
    });
  });

  describe("resolveRecipeHeroImages", () => {
    it("resolves all recipe hero images using batch API", async () => {
      const { db, createSignedUrls } = createMockDb();

      const rows = [
        { id: "r1", transmitter_id: "t1", hero_image_url: "recipe-images/t1/r1/main.jpg", title: "닭볶음탕" },
        { id: "r2", transmitter_id: "t2", hero_image_url: "recipe-images/t2/r2/main.jpg", title: "안동찜닭" },
        { id: "r3", transmitter_id: "t3", hero_image_url: null, title: "비빔밥" },
      ];

      const resolved = await resolveRecipeHeroImages(db, rows);

      expect(resolved).toHaveLength(3);
      expect(resolved[0].hero_image_url).toBe("https://mock.storage/t1/r1/main.jpg?token=batch_abc");
      expect(resolved[1].hero_image_url).toBe("https://mock.storage/t2/r2/main.jpg?token=batch_abc");
      expect(resolved[2].hero_image_url).toBeNull();
      expect(resolved[0].title).toBe("닭볶음탕");

      // Batch called once for both images
      expect(createSignedUrls).toHaveBeenCalledTimes(1);
      expect(createSignedUrls).toHaveBeenCalledWith(["t1/r1/main.jpg", "t2/r2/main.jpg"], 600);
    });
  });
});
