import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveUserId } from "./auth";

const userId = "11111111-1111-4111-8111-111111111111";

function client(user: { id: string } | null = null, error: unknown = null) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) } };
}

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/chat", { headers });
}

afterEach(() => vi.unstubAllEnvs());

describe("resolveUserId", () => {
  it("개발 모드에서는 개발 사용자 헤더를 사용한다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const db = client();
    expect(await resolveUserId(db as unknown as SupabaseClient, request({ "x-dev-user": userId }))).toBe(userId);
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });

  it("개발 모드에서는 헤더가 없으면 환경변수를 사용한다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_USER_ID", userId);
    expect(await resolveUserId(client() as unknown as SupabaseClient, request())).toBe(userId);
  });

  it.each(["production", "test"])("%s 모드에서는 개발 인증을 우회하지 않는다", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("DEV_USER_ID", userId);
    expect(await resolveUserId(client() as unknown as SupabaseClient, request({ "x-dev-user": userId }))).toBeNull();
  });

  it("운영 모드에서는 검증된 Bearer 사용자를 사용한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const db = client({ id: userId });
    expect(await resolveUserId(db as unknown as SupabaseClient, request({ authorization: "Bearer valid-token" }))).toBe(userId);
    expect(db.auth.getUser).toHaveBeenCalledWith("valid-token");
  });

  it("유효하지 않은 Bearer 토큰은 거부한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await resolveUserId(client(null, new Error("invalid")) as unknown as SupabaseClient, request({ authorization: "Bearer invalid-token" }))).toBeNull();
  });
});
