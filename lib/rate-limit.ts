/**
 * In-memory login throttle.
 *
 * The studio runs a single Next instance on its own network, so a module-level
 * Map is enough — there is no second process to share counters with. If this
 * app is ever scaled past one instance, this must move to the database or a
 * shared cache, because each instance would otherwise keep its own count and
 * the effective limit would multiply by the instance count.
 */

/** Attempts allowed per key before the key is locked out. */
export const MAX_ATTEMPTS = 8
/** Both the counting window and the lockout length. */
export const WINDOW_MS = 15 * 60 * 1000

type Bucket = {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const buckets = new Map<string, Bucket>()

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Drops buckets that are outside their window and not serving a lockout, so a
 * long-running process does not accumulate one entry per source address.
 */
function prune(now: number) {
  for (const [key, bucket] of buckets) {
    const windowOver = now - bucket.firstAttemptAt > WINDOW_MS
    const lockoutOver = (bucket.blockedUntil ?? 0) <= now
    if (windowOver && lockoutOver) buckets.delete(key)
  }
}

export function checkLoginRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  prune(now)

  const bucket = buckets.get(key)
  if (!bucket?.blockedUntil || bucket.blockedUntil <= now) return { allowed: true }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
  }
}

export function recordFailedLogin(key: string, now: number = Date.now()): void {
  const bucket = buckets.get(key)

  // No bucket yet, or the previous window has rolled over: start counting again.
  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now, blockedUntil: null })
    return
  }

  bucket.count += 1
  if (bucket.count >= MAX_ATTEMPTS) bucket.blockedUntil = now + WINDOW_MS
}

/** Called on a successful sign-in so a coach who mistyped is not left throttled. */
export function clearLoginAttempts(key: string): void {
  buckets.delete(key)
}

/** Test-only: drops all state so cases cannot leak into each other. */
export function resetLoginRateLimit(): void {
  buckets.clear()
}

/**
 * Best-effort client identity for throttling.
 *
 * `x-forwarded-for` is spoofable unless a trusted proxy sets it, which is
 * acceptable here: the app is not internet-facing, and an attacker who can
 * already forge headers on the studio LAN is past this control anyway. Requests
 * with no usable address share one bucket rather than escaping the limit.
 */
export function clientKey(headers: Record<string, unknown> | undefined): string {
  const forwarded = headers?.['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const first = typeof raw === 'string' ? raw.split(',')[0]?.trim() : ''
  if (first) return first

  const realIp = headers?.['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()

  return 'unknown'
}
