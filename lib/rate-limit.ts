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
/**
 * Attempts allowed across *all* keys in the same window.
 *
 * `clientKey` reads `x-forwarded-for`, which an attacker can vary per request
 * to get a fresh bucket every time and so never trip the per-key limit. This
 * second counter cannot be escaped that way: it has no key to rotate. It sits
 * well above the per-key limit so ordinary mistyping by the one coach who uses
 * this app never reaches it.
 */
export const GLOBAL_MAX_ATTEMPTS = 40
/** Both the counting window and the lockout length. */
export const WINDOW_MS = 15 * 60 * 1000

/**
 * Bucket name for the all-sources counter. Leading whitespace is stripped from
 * every real key by `clientKey`, so this cannot collide with a client address.
 */
const GLOBAL_KEY = '  all-sources  '

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

/** Remaining lockout for one bucket, or 0 when it is not blocked. */
function blockedFor(key: string, now: number): number {
  const bucket = buckets.get(key)
  if (!bucket?.blockedUntil || bucket.blockedUntil <= now) return 0
  return Math.ceil((bucket.blockedUntil - now) / 1000)
}

export function checkLoginRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  prune(now)

  // The longer of the two lockouts wins, so reporting either one is honest
  // about when the caller may try again.
  const retryAfterSeconds = Math.max(blockedFor(key, now), blockedFor(GLOBAL_KEY, now))
  if (retryAfterSeconds === 0) return { allowed: true }

  return { allowed: false, retryAfterSeconds }
}

/** Adds one failure to a bucket, locking it out once it reaches `max`. */
function bump(key: string, max: number, now: number): void {
  const bucket = buckets.get(key)

  // No bucket yet, or the previous window has rolled over: start counting again.
  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now, blockedUntil: null })
    return
  }

  bucket.count += 1
  if (bucket.count >= max) bucket.blockedUntil = now + WINDOW_MS
}

export function recordFailedLogin(key: string, now: number = Date.now()): void {
  bump(key, MAX_ATTEMPTS, now)
  bump(GLOBAL_KEY, GLOBAL_MAX_ATTEMPTS, now)
}

/** Called on a successful sign-in so a coach who mistyped is not left throttled. */
export function clearLoginAttempts(key: string): void {
  buckets.delete(key)
  // A correct password proves the traffic is not a spraying run, so the
  // all-sources counter is cleared too — otherwise noise from elsewhere on the
  // network could lock the coach out mid-session.
  buckets.delete(GLOBAL_KEY)
}

/** Test-only: drops all state so cases cannot leak into each other. */
export function resetLoginRateLimit(): void {
  buckets.clear()
}

/**
 * Best-effort client identity for throttling.
 *
 * `x-forwarded-for` is spoofable unless a trusted proxy sets it. Rotating it
 * defeats the per-key limit but not the all-sources limit above, which is why
 * that second counter exists. Requests with no usable address share one bucket
 * rather than escaping the limit.
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
