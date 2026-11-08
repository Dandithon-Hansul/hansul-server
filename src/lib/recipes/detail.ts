import "server-only";

import { recipeMediaUrl } from "./media";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Ingredient = {
  name: string;
  amount?: number | null;
  unit?: string | null;
  note?: string | null;
  display_amount?: string;
};

type Step = {
  order: number;
  title: string;
  description: string;
  image_url?: string | null;
  tip?: string | null;
  is_key_step?: boolean;
};

const seedRecipeId = "11111111-1111-4111-8111-111111111111";

export const seedRecipe = {
  recipe_id: seedRecipeId,
  title: "안동찜닭",
  hero_image_url: null,
  transmitter_id: "22222222-2222-4222-8222-222222222222",
  transmitter_name: "한술 시드 전승자",
  region: "안동시",
  region_code: "47170",
  transmitter_quote: "당면은 국물이 자작해질 때 넣어야 양념이 잘 배어요.",
  context_summary: "가족이 모이는 날 함께 먹는 안동찜닭입니다.",
  voice_message_url: null,
  cooking_time: 45,
  difficulty: "보통",
  servings: 3,
  like_count: 0,
  save_count: 0,
  is_liked: false,
  is_saved: false,
  ingredients: [
    { name: "닭", amount: 900, unit: "g", note: "손질한 닭" },
    { name: "감자", amount: 2, unit: "개", note: null },
    { name: "간장", amount: 5, unit: "큰술", note: null },
    { name: "당면", amount: 100, unit: "g", note: "미리 불려 두기" },
  ],
  steps: [
    { order: 1, title: "재료 손질하기", description: "닭과 감자를 먹기 좋은 크기로 손질하고 당면을 불립니다.", image_url: null, tip: "감자는 너무 작게 자르면 쉽게 부서져요.", is_key_step: false },
    { order: 2, title: "닭과 감자 조리기", description: "닭과 감자를 간장 양념에 넣고 닭이 익을 때까지 조립니다.", image_url: null, tip: "국물이 자작해질 때까지 중간에 한두 번 뒤집어 주세요.", is_key_step: true },
    { order: 3, title: "당면 넣고 마무리하기", description: "불린 당면을 넣고 익힌 뒤 그릇에 담습니다.", image_url: null, tip: "당면이 국물을 흡수하니 상태를 보며 물을 조금씩 더하세요.", is_key_step: false },
  ],
  version: 1,
  updated_at: "2026-11-07T00:00:00.000Z",
};

export function isRecipeSeedMode() {
  return process.env.RECIPE_DETAIL_SEED_MODE === "true" && process.env.VERCEL_ENV !== "production";
}

export async function getRecipeDetail(id: string, userId: string | null) {
  if (isRecipeSeedMode() && !userId) {
    return id === seedRecipeId ? { status: "ok" as const, recipe: seedRecipe } : { status: "missing" as const };
  }

  const db = createSupabaseAdminClient();
  const { data: row, error } = await db
    .from("recipes")
    .select("id,title,hero_image_url,transmitter_id,region,region_code,transmitter_quote,cooking_time,difficulty,servings,like_count,save_count,ingredients,steps,version,updated_at,status,visibility")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { status: "missing" as const };
  if (!userId || (row.transmitter_id !== userId && (row.status !== "published" || row.visibility !== "public"))) {
    return { status: "forbidden" as const };
  }

  const [profile, card, like, save] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", row.transmitter_id).single(),
    db.from("transmission_cards").select("context_summary,voice_message_url").eq("recipe_id", id).maybeSingle(),
    db.from("recipe_likes").select("recipe_id").eq("recipe_id", id).eq("profile_id", userId).maybeSingle(),
    db.from("recipe_saves").select("recipe_id").eq("recipe_id", id).eq("profile_id", userId).maybeSingle(),
  ]);
  for (const result of [profile, card, like, save]) {
    if (result.error) throw result.error;
  }

  const ownerPath = row.transmitter_id + "/" + id;
  const [heroImageUrl, voiceMessageUrl, steps] = await Promise.all([
    recipeMediaUrl(db, row.hero_image_url, "recipe-images", ownerPath),
    recipeMediaUrl(db, card.data?.voice_message_url, "card-voice", ownerPath),
    Promise.all((row.steps as Step[]).slice().sort((a, b) => a.order - b.order)
      .map(async ({ order, title, description, image_url, tip, is_key_step }) => ({
        order,
        title,
        description,
        image_url: await recipeMediaUrl(db, image_url, "step-images", ownerPath),
        tip: tip ?? null,
        is_key_step: is_key_step ?? false,
      }))),
  ]);

  return {
    status: "ok" as const,
    recipe: {
      recipe_id: row.id,
      title: row.title,
      hero_image_url: heroImageUrl,
      transmitter_name: profile.data!.display_name,
      transmitter_quote: row.transmitter_quote,
      context_summary: card.data?.context_summary ?? "",
      voice_message_url: voiceMessageUrl,
      cooking_time: row.cooking_time,
      difficulty: row.difficulty,
      servings: row.servings,
      like_count: row.like_count,
      save_count: row.save_count,
      is_liked: Boolean(like.data),
      is_saved: Boolean(save.data),
      ingredients: (row.ingredients as Ingredient[]).map(({ name, amount, unit, note, display_amount }) => ({
        name, amount: amount ?? null, unit: unit ?? null, note: note ?? display_amount ?? null,
      })),
      steps,
      version: row.version,
      updated_at: row.updated_at,
    },
  };
}
