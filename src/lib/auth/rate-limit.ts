const buckets = new Map<string, number[]>();
const MAX_RATE_LIMIT_KEYS = 5_000;
const MAX_RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;
let operationsSincePrune = 0;

function pruneBuckets(now: number) {
  operationsSincePrune += 1;
  if (operationsSincePrune < 100 && buckets.size <= MAX_RATE_LIMIT_KEYS) return;
  operationsSincePrune = 0;
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((timestamp) => now - timestamp < MAX_RATE_LIMIT_RETENTION_MS);
    if (recent.length) buckets.set(key, recent);
    else buckets.delete(key);
  }
  while (buckets.size > MAX_RATE_LIMIT_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (typeof oldestKey !== "string") break;
    buckets.delete(oldestKey);
  }
}

function recentHits(key: string, windowMs: number) {
  const now = Date.now();
  pruneBuckets(now);
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length) buckets.set(key, recent);
  else buckets.delete(key);
  return recent;
}

export function isRateLimited(key: string, limit: number, windowMs: number) {
  return recentHits(key, windowMs).length >= limit;
}

export function recordRateLimitHit(key: string, windowMs: number) {
  const recent = recentHits(key, windowMs);
  recent.push(Date.now());
  buckets.set(key, recent);
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const recent = recentHits(key, windowMs);
  if (recent.length >= limit) {
    return false;
  }

  recordRateLimitHit(key, windowMs);
  return true;
}

export function getClientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "local";
}
