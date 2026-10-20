// Per-IP limit on /api/chat (PLAN.md §4.3, item 6). In memory: each server instance counts on its own,
// which is enough to keep one visitor from draining the free-tier LLM quota.
const WINDOW_MS = 60_000;
const DEFAULT_PER_MINUTE = 10;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, number[]>();

export function rateLimitPerMinute(): number {
  const value = Number(process.env.RATE_LIMIT_PER_MIN);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PER_MINUTE;
}

/** Records a request; returns seconds until the next allowed one, or 0 when this one is allowed. */
export function checkRateLimit(ip: string, limit = rateLimitPerMinute(), now = Date.now()): number {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED_IPS) hits.delete(hits.keys().next().value!);
  return 0;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

export function resetRateLimit(): void {
  hits.clear();
}
