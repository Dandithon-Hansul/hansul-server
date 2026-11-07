import { profileError, profilePatchSchema, readProfile, updateProfile, withProfile } from "@/lib/profiles/me";

export function GET(request: Request) {
  return withProfile(request, readProfile);
}

export function PATCH(request: Request) {
  return withProfile(request, async (db, id) => {
    const body = await request.json().catch(() => null);
    const patch = profilePatchSchema.safeParse(body);
    if (!patch.success) return profileError(400, "INVALID_PROFILE_PATCH", "수정할 프로필 필드를 확인해 주세요.");
    return updateProfile(db, id, patch.data);
  });
}
