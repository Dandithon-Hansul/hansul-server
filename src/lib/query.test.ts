import { describe, it, expect } from "vitest";
import { parseLimit } from "./query";

describe("parseLimit", () => {
  it("유효한 값을 정수로 반환한다", () => {
    expect(parseLimit("15", 10)).toBe(15);
  });

  it("없거나 음수·비정상 값이면 fallback", () => {
    expect(parseLimit(null, 10)).toBe(10);
    expect(parseLimit("0", 10)).toBe(10);
    expect(parseLimit("-3", 10)).toBe(10);
    expect(parseLimit("abc", 10)).toBe(10);
  });

  it("max를 넘지 않는다", () => {
    expect(parseLimit("999", 10, 50)).toBe(50);
  });
});
