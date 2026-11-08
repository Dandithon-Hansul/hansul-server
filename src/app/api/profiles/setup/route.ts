import "server-only";
import { setupSchema, setupError, createOnboarding, withSetup } from "@/lib/profiles/setup";

export async function POST(request: Request) {
  return withSetup(request, async (db, userId) => {
    const body = await request.json().catch(() => null);
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) return setupError(422, "MISSING_FIELD", "입력값을 확인해 주세요.");
    return createOnboarding(db, userId, parsed.data);
  });
}
