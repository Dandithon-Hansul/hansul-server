import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/auth", () => ({ resolveUserId: mocks.user }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: () => ({}) }));
vi.mock("@/lib/uploads/sign", () => ({ signUpload: mocks.sign }));
import { POST } from "./route";
const owner = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue(owner); mocks.sign.mockResolvedValue(Response.json({ bucket: "uploads", path: "test-path", token: "test-token" })); });
describe("POST /api/uploads/sign", () => {
  it("미인증 요청에는 발급하지 않는다", async () => {
    mocks.user.mockResolvedValue(null);
    const r = await POST(new Request("http://localhost/api/uploads/sign", { method: "POST", body: "{}" }));
    expect(r.status).toBe(401); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("잘못된 JSON은 발급 전에 400으로 반환한다", async () => {
    const r = await POST(new Request("http://localhost/api/uploads/sign", { method: "POST", body: "{" }));
    expect(r.status).toBe(400); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("인증된 사용자와 입력을 발급 함수로 전달한다", async () => {
    const input = { purpose: "stt_audio", content_type: "audio/webm", size_bytes: 100 };
    const r = await POST(new Request("http://localhost/api/uploads/sign", { method: "POST", body: JSON.stringify(input) }));
    expect(r.status).toBe(200); expect(mocks.sign).toHaveBeenCalledWith(owner, input);
  });
  it("예외의 내부 정보는 응답에 노출하지 않는다", async () => {
    mocks.sign.mockRejectedValue(new Error("sensitive internal exception"));
    const r = await POST(new Request("http://localhost/api/uploads/sign", { method: "POST", body: "{}" }));
    expect(r.status).toBe(500); expect(await r.text()).not.toContain("sensitive");
  });
});
