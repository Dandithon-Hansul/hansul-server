import { describe, it, expect } from "vitest";
import { extractBearerToken } from "./auth";

describe("extractBearerToken", () => {
  it("Bearer 토큰을 추출한다", () => {
    const req = new Request("http://localhost/api/home", {
      headers: { Authorization: "Bearer abc.def.ghi" },
    });
    expect(extractBearerToken(req)).toBe("abc.def.ghi");
  });

  it("헤더가 없으면 null", () => {
    const req = new Request("http://localhost/api/home");
    expect(extractBearerToken(req)).toBeNull();
  });

  it("Bearer 스킴이 아니면 null", () => {
    const req = new Request("http://localhost/api/home", {
      headers: { Authorization: "Basic abc" },
    });
    expect(extractBearerToken(req)).toBeNull();
  });

  it("토큰 값이 비어 있으면 null", () => {
    const req = new Request("http://localhost/api/home", {
      headers: { Authorization: "Bearer " },
    });
    expect(extractBearerToken(req)).toBeNull();
  });
});
