import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/map/regions", () => ({
  mapRegions: [
    { region_code: "47170", region: "안동시", sido: "경북" },
    { region_code: "27110", region: "중구", sido: "대구" },
  ],
}));

import { setupSchema, createOnboarding } from "@/lib/profiles/setup";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

describe("setupSchema", () => {
  it("display_name 없으면 실패", () => {
    expect(setupSchema.safeParse({ region_code: "47170" }).success).toBe(false);
  });

  it("display_name 공백만이면 실패", () => {
    expect(setupSchema.safeParse({ display_name: "   ", region_code: "47170" }).success).toBe(false);
  });

  it("region_code 4자리면 실패", () => {
    expect(setupSchema.safeParse({ display_name: "한솔", region_code: "4717" }).success).toBe(false);
  });

  it("정상 입력 성공", () => {
    expect(
      setupSchema.safeParse({ display_name: "한솔", region_code: "47170", food_preferences: ["구이"] }).success,
    ).toBe(true);
  });

  it("food_preferences 없어도 성공", () => {
    expect(setupSchema.safeParse({ display_name: "한솔", region_code: "47170" }).success).toBe(true);
  });

  it("dong 포함 정상 입력 성공", () => {
    expect(
      setupSchema.safeParse({ display_name: "한솔", region_code: "47170", dong: "정하동" }).success,
    ).toBe(true);
  });

  it("dong 없어도 성공", () => {
    expect(setupSchema.safeParse({ display_name: "한솔", region_code: "47170" }).success).toBe(true);
  });

  it("dong이 빈 문자열이면 실패", () => {
    expect(setupSchema.safeParse({ display_name: "한솔", region_code: "47170", dong: "" }).success).toBe(false);
  });
});

describe("createOnboarding", () => {
  const mockDb = { from: vi.fn() };

  beforeEach(() => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(mockDb as never);
    mockDb.from.mockReset();
  });

  it("유효하지 않은 region_code → 422", async () => {
    const res = await createOnboarding(mockDb as never, "user-1", {
      display_name: "한솔",
      region_code: "99999",
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("INVALID_REGION_CODE");
  });

  it("정상 입력 → 200 + profile_id + start_route", async () => {
    mockDb.from.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
        }),
      }),
    });
    const res = await createOnboarding(mockDb as never, "user-1", {
      display_name: "한솔",
      region_code: "47170",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile_id).toBe("user-1");
    expect(body.start_route).toBe("/");
  });

  it("DB error → throw", async () => {
    mockDb.from.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("db fail") }),
        }),
      }),
    });
    await expect(
      createOnboarding(mockDb as never, "user-1", { display_name: "한솔", region_code: "47170" }),
    ).rejects.toThrow();
  });

  it("재온보딩 — 동일 userId 재호출도 200", async () => {
    mockDb.from.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
        }),
      }),
    });
    const res = await createOnboarding(mockDb as never, "user-1", {
      display_name: "한솔변경",
      region_code: "27110",
    });
    expect(res.status).toBe(200);
  });

  it("food_preferences 없으면 빈 배열로 저장", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
      }),
    });
    mockDb.from.mockReturnValue({ upsert: upsertMock });
    await createOnboarding(mockDb as never, "user-1", { display_name: "한솔", region_code: "47170" });
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ food_preferences: [] });
  });

  it("dong 있으면 upsert에 dong 포함", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
      }),
    });
    mockDb.from.mockReturnValue({ upsert: upsertMock });
    await createOnboarding(mockDb as never, "user-1", { display_name: "한솔", region_code: "47170", dong: "정하동" });
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ dong: "정하동" });
  });

  it("dong 없으면 upsert에 dong이 null", async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: "user-1" }, error: null }),
      }),
    });
    mockDb.from.mockReturnValue({ upsert: upsertMock });
    await createOnboarding(mockDb as never, "user-1", { display_name: "한솔", region_code: "47170" });
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ dong: null });
  });
});
