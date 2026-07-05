const buckets = new Map<string, number[]>();

function recentHits(key: string, windowMs: number) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  buckets.set(key, recent);
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
