import { describe, it, expect } from "vitest";
import { corsHeaders } from "./middleware";

describe("corsHeaders", () => {
  it("허용 목록에 없는 origin은 null을 반환한다", () => {
    expect(corsHeaders(["https://app.example.com"], "https://evil.com")).toBeNull();
  });

  it("허용 목록의 origin을 Access-Control-Allow-Origin으로 반환한다", () => {
    const headers = corsHeaders(["https://app.example.com"], "https://app.example.com");
    expect(headers?.["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("여러 origin 중 일치하는 origin만 허용한다", () => {
    const headers = corsHeaders(["https://app.example.com", "http://localhost:5173"], "http://localhost:5173");
    expect(headers?.["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("허용 목록이 비어있으면 항상 null을 반환한다", () => {
    expect(corsHeaders([], "https://app.example.com")).toBeNull();
  });

  it("Vary: Origin 헤더를 포함한다", () => {
    const headers = corsHeaders(["https://app.example.com"], "https://app.example.com");
    expect(headers?.["Vary"]).toBe("Origin");
  });
});
