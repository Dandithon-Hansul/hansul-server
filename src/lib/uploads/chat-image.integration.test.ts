import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { signUpload } from "./sign";
import { SupabaseInterviewRepository } from "../db/supabase-interview";
const owner = "11111111-1111-4111-8111-111111111111";
const recipe = "22222222-2222-4222-8222-222222222222";
const otherRecipe = "33333333-3333-4333-8333-333333333333";
type Row = Record<string, unknown>;
function setup() {
  const grants: Row[] = [];
  const objects = new Map<string, { size: number; contentType: string }>();
  const recipes = [recipe, otherRecipe].map(id => ({ id, transmitter_id: owner, status: "draft", visibility: "private", transcript: "나물무침" }));
  const db = {
    from(table: string) {
      return {
        async insert(row: Row) { grants.push(row); return { error: null }; },
        select() {
          const filters: Row = {};
          const query = {
            eq(key: string, value: unknown) { filters[key] = value; return query; },
            async maybeSingle() { return { data: (table === "recipes" ? recipes : grants).find(row => Object.entries(filters).every(([key, value]) => (row as Row)[key] === value)) ?? null, error: null }; },
          };
          return query;
        },
      };
    },
    storage: { from: () => ({
      async createSignedUploadUrl(path: string) { return { data: { path, token: "test-token" }, error: null }; },
      async info(path: string) { return { data: objects.get(path) ?? null, error: null }; },
      async createSignedUrl(path: string) { return { data: { signedUrl: `https://signed.test/${path}` }, error: null }; },
    }) },
  } as unknown as SupabaseClient;
  return { db, objects, repo: new SupabaseInterviewRepository(db) };
}
describe("upload grant and chat image integration", () => {
  it("실제 발급 함수가 저장한 기록을 채팅 저장소가 확인한다", async () => {
    const { db, objects, repo } = setup();
    const issued = await signUpload(owner, { purpose: "chat_image", recipe_id: recipe, content_type: "image/png", size_bytes: 100 }, db);
    expect(issued.status).toBe(200);
    const { path } = await issued.json(); objects.set(path, { size: 100, contentType: "image/png" });
    expect(await repo.resolveImage(owner, recipe, path)).toContain(path);
    await expect(repo.resolveImage(owner, otherRecipe, path)).rejects.toMatchObject({ status: 403, code: "UPLOAD_NOT_GRANTED" });
  });
  it("자기 소유 경로에 객체만 있어도 발급 기록이 없으면 거부한다", async () => {
    const { objects, repo } = setup(); const path = `${owner}/chat_image/44444444-4444-4444-8444-444444444444.png`;
    objects.set(path, { size: 100, contentType: "image/png" });
    await expect(repo.resolveImage(owner, recipe, path)).rejects.toMatchObject({ status: 403 });
  });
});
