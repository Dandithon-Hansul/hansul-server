import { parseProfilePage, profileError, readSavedRecipes, withProfile } from "@/lib/profiles/me";

export function GET(request: Request) {
  return withProfile(request, (db, id) => {
    const page = parseProfilePage(request);
    if (!page) return Promise.resolve(profileError(400, "INVALID_PAGE", "페이지 조회 조건을 확인해 주세요."));
    return readSavedRecipes(db, id, page);
  });
}
