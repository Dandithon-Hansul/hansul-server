// 쿼리 파라미터 limit 파싱. 유효하지 않으면 fallback, max로 클램프.
export function parseLimit(raw: string | null, fallback: number, max = 50): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}
