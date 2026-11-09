import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/server";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 540 * 1000; // 9분 (서명 만료 10분보다 1분 여유)
const MAX_CACHE_ENTRIES = 2000;
const mediaCache = new Map<string, CacheEntry>();

export function clearMediaUrlCache() {
  mediaCache.clear();
}

function getFromCache(key: string): string | null {
  const entry = mediaCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    mediaCache.delete(key);
    return null;
  }
  return entry.url;
}

function setInCache(key: string, url: string) {
  if (mediaCache.size >= MAX_CACHE_ENTRIES) {
    // 가장 오래된 항목 제거 (Map iteration 순서 활용)
    const firstKey = mediaCache.keys().next().value;
    if (firstKey) mediaCache.delete(firstKey);
  }
  mediaCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

function normalizeAndValidatePath(
  value: string | null | undefined,
  bucket: string,
  ownerPath: string,
): { valid: false } | { valid: true; directUrl?: string; storagePath?: string } {
  if (!value) return { valid: false };
  if (value.startsWith("https://")) return { valid: true, directUrl: value };

  const prefix = bucket + "/";
  const path = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  if (!path.startsWith(ownerPath + "/") || path.split("/").includes("..")) {
    return { valid: false };
  }

  return { valid: true, storagePath: path };
}

export async function recipeMediaUrl(
  db: ReturnType<typeof createSupabaseAdminClient>,
  value: string | null | undefined,
  bucket: string,
  ownerPath: string,
): Promise<string | null> {
  const check = normalizeAndValidatePath(value, bucket, ownerPath);
  if (!check.valid) return null;
  if (check.directUrl) return check.directUrl;

  const storagePath = check.storagePath!;
  const cacheKey = `${bucket}:${storagePath}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const { data, error } = await db.storage.from(bucket).createSignedUrl(storagePath, 600);
  if (error) throw error;
  if (!data?.signedUrl) return null;

  setInCache(cacheKey, data.signedUrl);
  return data.signedUrl;
}

export interface MediaItemToResolve {
  key: string;
  value: string | null | undefined;
  bucket: string;
  ownerPath: string;
}

export async function batchRecipeMediaUrls(
  db: ReturnType<typeof createSupabaseAdminClient>,
  items: MediaItemToResolve[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  // bucket별 서명 대상: bucket -> Array<{ key: string; storagePath: string }>
  const toFetchByBucket = new Map<string, Array<{ key: string; storagePath: string }>>();

  for (const item of items) {
    const check = normalizeAndValidatePath(item.value, item.bucket, item.ownerPath);
    if (!check.valid) {
      result.set(item.key, null);
      continue;
    }
    if (check.directUrl) {
      result.set(item.key, check.directUrl);
      continue;
    }

    const storagePath = check.storagePath!;
    const cacheKey = `${item.bucket}:${storagePath}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      result.set(item.key, cached);
      continue;
    }

    const list = toFetchByBucket.get(item.bucket) ?? [];
    list.push({ key: item.key, storagePath });
    toFetchByBucket.set(item.bucket, list);
  }

  if (toFetchByBucket.size === 0) {
    return result;
  }

  // 각 버킷별로 createSignedUrls를 1회씩만 배치 호출
  await Promise.all(
    Array.from(toFetchByBucket.entries()).map(async ([bucket, pending]) => {
      const paths = pending.map((p) => p.storagePath);
      // 중복 path 제거하여 최소한의 요청 전송
      const uniquePaths = Array.from(new Set(paths));
      const { data, error } = await db.storage.from(bucket).createSignedUrls(uniquePaths, 600);
      if (error) throw error;

      const signedMap = new Map<string, string>();
      for (const signed of data ?? []) {
        if (signed.signedUrl && signed.path) {
          signedMap.set(signed.path, signed.signedUrl);
          setInCache(`${bucket}:${signed.path}`, signed.signedUrl);
        }
      }

      for (const { key, storagePath } of pending) {
        result.set(key, signedMap.get(storagePath) ?? null);
      }
    }),
  );

  return result;
}

export async function resolveRecipeHeroImages<
  T extends { id: string; transmitter_id: string; hero_image_url: string | null },
>(
  db: ReturnType<typeof createSupabaseAdminClient>,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return [];

  const items: MediaItemToResolve[] = rows.map((row) => ({
    key: row.id,
    value: row.hero_image_url,
    bucket: "recipe-images",
    ownerPath: `${row.transmitter_id}/${row.id}`,
  }));

  const urlMap = await batchRecipeMediaUrls(db, items);

  return rows.map((row) => ({
    ...row,
    hero_image_url: urlMap.get(row.id) ?? null,
  }));
}
