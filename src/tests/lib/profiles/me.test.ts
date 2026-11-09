import { describe, it, expect } from "vitest";

vi.mock("@/lib/supabase/server");

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

  it("대구 전체 코드는 시군구 없이 반환한다", () => {
    expect(regionDto("27000", "대구광역시", null)).toEqual({
      code: "27000", sido: "대구광역시", sigungu: null, dong: null,
    });
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

  it("avatar_url에 storage path를 허용한다", () => {
    expect(profilePatchSchema.safeParse({ avatar_url: "user-id/avatar/uuid.jpg" }).success).toBe(true);
  });

  it("avatar_url에 https URL을 허용한다", () => {
    expect(profilePatchSchema.safeParse({ avatar_url: "https://example.com/avatar.jpg" }).success).toBe(true);
  });

  it("avatar_url이 빈 문자열이면 실패", () => {
    expect(profilePatchSchema.safeParse({ avatar_url: "" }).success).toBe(false);
  });

  it("avatar_url을 null로 설정할 수 있다", () => {
    expect(profilePatchSchema.safeParse({ avatar_url: null }).success).toBe(true);
  });
});

describe("profile bio", () => {
  it("공백을 제거하고 50자를 허용한다", () => {
    const bio = "가".repeat(50);
    expect(profilePatchSchema.parse({ bio: " " + bio + " " })).toEqual({ bio });
  });

  it("50자 초과를 거부하고 null로 지울 수 있다", () => {
    expect(profilePatchSchema.safeParse({ bio: "가".repeat(51) }).success).toBe(false);
    expect(profilePatchSchema.parse({ bio: null })).toEqual({ bio: null });
  });
});
