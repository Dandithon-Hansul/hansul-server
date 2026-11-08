import { getRecipeViewer, recipeError } from "@/lib/recipes/http";
import { signUpload } from "@/lib/uploads/sign";

export async function POST(request: Request) {
  try {
    const userId = await getRecipeViewer(request);
    const body = await request.json();
    return signUpload(userId, body);
  } catch {
    return recipeError(400, "INVALID_BODY", "요청 형식이 올바르지 않습니다");
  }
}
