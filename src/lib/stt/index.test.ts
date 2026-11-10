import { describe, it, expect, vi, beforeEach } from "vitest";
import { processStt } from "./index";

const mockFrom = vi.fn();

const mockStorageFrom = vi.fn();
const mockDownload = vi.fn();
const mockDb = {
  from: mockFrom,
  storage: { from: mockStorageFrom },
};

const mockTranscribe = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => mockDb,
}));

vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create: mockTranscribe } };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageFrom.mockReturnValue({ download: mockDownload });
  mockDownload.mockResolvedValue({ data: new Blob(["audio"]), error: null });
  mockTranscribe.mockResolvedValue({ text: "소고기 국을 끓여요" });
});

describe("processStt — transcript 경로", () => {
  it("미인증 요청은 401을 반환한다", async () => {
    const res = await processStt(null, { transcript: "소고기 국" });
    expect(res.status).toBe(401);
  });

  it("transcript로 신규 draft 레시피를 생성하고 recipe_id를 반환한다", async () => {
    const newRecipeId = "new-recipe-uuid";
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: newRecipeId },
            error: null,
          }),
        }),
      }),
    });

    const res = await processStt("user1", { transcript: "소고기 국을 끓여요" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ transcript: "소고기 국을 끓여요", recipe_id: newRecipeId, status: "draft" });
  });

  it("recipe_id가 있으면 작성자 소유 draft를 갱신한다", async () => {
    const existingId = "123e4567-e89b-12d3-a456-426614174000";
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });

    const res = await processStt("user1", { transcript: "소고기 국", recipe_id: existingId });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ transcript: "소고기 국", recipe_id: existingId, status: "draft" });
  });
});

describe("processStt — audio_path 경로", () => {
  it("사용자 소유의 stt_audio 경로가 아니면 다운로드하지 않는다", async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "recipe1" }, error: null }),
        }),
      }),
    });

    const res = await processStt("user1", {
      audio_path: "uploads/user2/stt_audio/private.webm",
    });

    expect(res.status).toBe(400);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockTranscribe).not.toHaveBeenCalled();
  });
  it("audio_path로 Whisper 전사 후 draft를 생성한다", async () => {
    const newRecipeId = "new-recipe-uuid";
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: newRecipeId },
            error: null,
          }),
        }),
      }),
    });

    const res = await processStt("user1", {
      audio_path: "uploads/user1/stt_audio/uuid.webm",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      transcript: "소고기 국을 끓여요",
      recipe_id: newRecipeId,
      status: "draft",
    });
    expect(mockTranscribe).toHaveBeenCalledOnce();
    const fileArg: File = mockTranscribe.mock.calls[0][0].file;
    expect(fileArg.name).toBe("uuid.webm");
    expect(fileArg.type).toBe("audio/webm");
  });
  it("MP4 오디오는 올바른 파일 형식으로 Whisper에 전달된다", async () => {
    const newRecipeId = "new-recipe-uuid";
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: newRecipeId }, error: null }),
        }),
      }),
    });
    await processStt("user1", { audio_path: "uploads/user1/stt_audio/uuid.mp4" });
    const fileArg: File = mockTranscribe.mock.calls[0][0].file;
    expect(fileArg.name).toBe("uuid.mp4");
    expect(fileArg.type).toBe("audio/mp4");
  });
});

describe("processStt — 전사 전용 모드", () => {
  it("오디오 경로 없이 전사 전용 모드를 요청하면 저장하지 않는다", async () => {
    const input = { transcript: "소고기 국", transcribe_only: true };
    const res = await processStt("user1", input);
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([undefined, "123e4567-e89b-12d3-a456-426614174000"])(
    "recipe_id가 %s일 때 전사만 수행한다",
    async (recipe_id) => {
      const input = {
        audio_path: "uploads/user1/stt_audio/reply.webm",
        transcribe_only: true,
        recipe_id,
      };
      const res = await processStt("user1", input);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ transcript: "소고기 국을 끓여요" });
      expect(mockDownload).toHaveBeenCalledWith("user1/stt_audio/reply.webm");
      expect(mockTranscribe).toHaveBeenCalledOnce();
      expect(mockFrom).not.toHaveBeenCalled();
    },
  );
});
