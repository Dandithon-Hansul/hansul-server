import { InterviewError } from "./errors";

export type ImageStep = { order: number; title: string; description: string; image_url?: string | null };
export type StepImageRecipe = { title: string | null; status: string; steps: ImageStep[] };
export interface StepImageDependencies {
  read(owner: string, id: string): Promise<StepImageRecipe | null>;
  generate(prompt: string): Promise<Buffer>;
  save(owner: string, id: string, order: number, image: Buffer): Promise<string>;
  url(owner: string, id: string, path: string): Promise<string>;
}

export async function generateStepImages(d: StepImageDependencies, owner: string, id: string) {
  const recipe = await d.read(owner, id);
  if (!recipe) throw new InterviewError(404, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다");
  if (recipe.status !== "published" || !recipe.steps.length) {
    throw new InterviewError(422, "RECIPE_NOT_PUBLISHED", "레시피를 발행한 후 이미지를 생성해 주세요");
  }

  const generated: { order: number; image_url: string; prompt_used: string }[] = [];
  const failed_orders: number[] = [];
  const steps = recipe.steps.slice().sort((a, b) => a.order - b.order);
  for (let index = 0; index < steps.length; index += 3) {
    await Promise.all(steps.slice(index, index + 3).map(async (step) => {
      const prompt = [
        `한국 요리 ${recipe.title}의 조리 과정 사진.`,
        `단계 ${step.order} - ${step.title}. ${step.description}`,
        step.order === steps[steps.length - 1].order ? "완성된 요리를 실제 음식 사진처럼 보여준다." : "해당 단계의 조리 상태만 보여준다.",
        "자연광, 실제 재료, 글자와 워터마크 없음.",
      ].join(" ");
      try {
        const path = step.image_url || await d.save(owner, id, step.order, await d.generate(prompt));
        generated.push({ order: step.order, image_url: await d.url(owner, id, path), prompt_used: step.image_url ? "" : prompt });
      } catch {
        failed_orders.push(step.order);
      }
    }));
  }
  return { generated: generated.sort((a, b) => a.order - b.order), failed_orders: failed_orders.sort((a, b) => a - b) };
}
