import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

// TC-H-01
describe("GET /api/health", () => {
  it("서버 상태 ok 반환", async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe("ok");
  });
});
