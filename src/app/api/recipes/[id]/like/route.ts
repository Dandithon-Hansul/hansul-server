import { toggleRecipeInteraction } from "@/lib/recipes/interaction";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return toggleRecipeInteraction(request, (await params).id, "like");
}
