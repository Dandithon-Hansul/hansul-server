import "server-only";

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import type { StepImageDependencies } from "../services/step-images";
import { createSupabaseAdminClient } from "../supabase/server";
import { recipeMediaUrl } from "./media";

const bucket = "step-images";
const recipeSchema = z.object({
  title: z.string().nullable(),
  status: z.string(),
  steps: z.array(z.object({
    order: z.number().int().positive(),
    title: z.string(),
    description: z.string(),
    image_url: z.string().nullish(),
  })),
});

export function stepImageDependencies(): StepImageDependencies {
  const db = createSupabaseAdminClient();
  const storage = db.storage.from(bucket);
  return {
    async read(owner, id) {
      const { data, error } = await db.from("recipes").select("title,status,steps")
        .eq("id", id).eq("transmitter_id", owner).maybeSingle();
      if (error) throw error;
      return data ? recipeSchema.parse(data) : null;
    },
    async generate(prompt) {
      const configuredModel = process.env.IMAGE_MODEL?.trim();
      const retiredModels = ["gpt-image-1", "dall-e-2", "dall-e-3"];
      const model = !configuredModel || retiredModels.includes(configuredModel) ? "gpt-image-1.5" : configuredModel;
      const client = new OpenAI({ timeout: 60_000, maxRetries: 0 });
      const result = await client.images.generate({ model, prompt, output_format: "webp" });
      const image = result.data?.[0]?.b64_json;
      if (!image) throw new Error("IMAGE_OUTPUT_MISSING");
      return Buffer.from(image, "base64");
    },
    async save(owner, id, order, image) {
      const path = `${owner}/${id}/${order}-${randomUUID()}.webp`;
      const upload = await storage.upload(path, image, { contentType: "image/webp" });
      if (upload.error) throw upload.error;
      const { data, error } = await db.rpc("save_generated_step_image", {
        p_owner: owner, p_recipe: id, p_order: order, p_path: path,
      });
      // A concurrent request may already have stored an image for this step.
      if (!error && data && data !== path) await storage.remove([path]);
      if (error) throw error;
      return z.string().min(1).parse(data);
    },
    async url(owner, id, path) {
      return z.string().min(1).parse(await recipeMediaUrl(db, path, bucket, `${owner}/${id}`));
    },
  };
}
