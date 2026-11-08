import { describe, it, expect } from "vitest";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/map/regions", () => ({
  mapRegions: [
    { region_code: "47170", region: "안동시", sido: "경북" },
    { region_code: "27110", region: "중구", sido: "대구" },
  ],
}));

import { vi } from "vitest";
import { regionDto, profilePatchSchema } from "@/lib/profiles/me";

describe("regionDto", () => {
  it("dong이 있으면 응답에 포함된다", () => {
    expect(regionDto("47170", "안동시", "정하동")).toEqual({
      code: "47170",
      sido: "경상북도",
      sigungu: "안동시",
      dong: "정하동",
    });
  });

  it("dong이 없으면 null", () => {
    expect(regionDto("47170", "안동시", null)).toEqual({
      code: "47170",
      sido: "경상북도",
      sigungu: "안동시",
      dong: null,
    });
  });

  it("대구 region_code면 sido가 대구광역시", () => {
    expect(regionDto("27110", "중구", null)).toMatchObject({ sido: "대구광역시" });
  });

  it("code와 name이 모두 null이면 null 반환", () => {
    expect(regionDto(null, null, null)).toBeNull();
  });
});

describe("profilePatchSchema", () => {
  it("dong 필드를 허용한다", () => {
    expect(profilePatchSchema.safeParse({ dong: "정하동" }).success).toBe(true);
  });

  it("dong이 빈 문자열이면 실패", () => {
    expect(profilePatchSchema.safeParse({ dong: "" }).success).toBe(false);
  });
});
