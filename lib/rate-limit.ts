/**
 * Login throttle, backed by the `LoginAttempt` table.
 *
 * This used to be a module-level Map, which was correct while the app ran as a
 * single process on the studio's own network. Under serverless it was not: each
 * warm container kept its own counters and cold starts dropped them, so the
 * effective limit was `MAX_ATTEMPTS` times however many containers happened to
 * be alive — which is to say, no limit worth relying on.
 *
 * Counting now happens in Postgres, in a single statement per bucket, so
 * concurrent containers increment the same row instead of racing each other.
 */

import { prisma } from '@/lib/prisma'

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

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

/**
 * Whether either the caller's bucket or the all-sources bucket is serving a
 * lockout, and for how much longer.
 *
 * Throws if the database is unreachable. `authorize` treats that as a failed
 * sign-in, which is the right way round: a login cannot succeed without the
 * database either, so failing closed here costs nothing and never leaves the
 * one unauthenticated endpoint running unthrottled.
 */
export async function checkLoginRateLimit(
  key: string,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const blocked = await prisma.loginAttempt.findMany({
    where: {
      key: { in: [key, GLOBAL_KEY] },
      blockedUntil: { gt: now },
    },
    select: { blockedUntil: true },
  })

  if (blocked.length === 0) return { allowed: true }

  // The longer of the two lockouts wins, so reporting it is honest about when
  // the caller may actually try again.
  const latest = Math.max(...blocked.map((row) => Number(row.blockedUntil)))
  return { allowed: false, retryAfterSeconds: Math.ceil((latest - now) / 1000) }
}

/**
 * Adds one failure to a bucket, locking it out once it reaches `max`.
 *
 * Written as one upsert so the read, the increment and the lockout decision
 * cannot be split across concurrent containers. A bucket whose window has
 * already passed is reset rather than incremented, which is what stops slow
 * guessing from accumulating into a lockout over hours.
 */
function bump(key: string, max: number, now: number) {
  // BigInt rather than number, so these bind as int8 and compare against the
  // column without an implicit cast.
  const at = BigInt(now)
  const windowStart = BigInt(now - WINDOW_MS)
  const blockUntil = BigInt(now + WINDOW_MS)

  return prisma.$executeRaw`
    INSERT INTO "LoginAttempt" ("key", "count", "firstAttemptAt", "blockedUntil")
    VALUES (${key}, 1, ${at}, NULL)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "LoginAttempt"."firstAttemptAt" < ${windowStart} THEN 1
        ELSE "LoginAttempt"."count" + 1
      END,
      "firstAttemptAt" = CASE
        WHEN "LoginAttempt"."firstAttemptAt" < ${windowStart} THEN ${at}
        ELSE "LoginAttempt"."firstAttemptAt"
      END,
      "blockedUntil" = CASE
        WHEN "LoginAttempt"."firstAttemptAt" < ${windowStart} THEN NULL
        WHEN "LoginAttempt"."count" + 1 >= ${max} THEN ${blockUntil}
        ELSE "LoginAttempt"."blockedUntil"
      END
  `
}

/**
 * Drops buckets that are outside their window and not serving a lockout.
 *
 * This runs on failure rather than on every check, because failure is the only
 * thing that creates rows — and under a spraying run, which forges a fresh
 * address per request, it is the only thing that makes the table grow.
 */
function prune(now: number) {
  return prisma.loginAttempt.deleteMany({
    where: {
      firstAttemptAt: { lt: now - WINDOW_MS },
      OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
    },
  })
}

export async function recordFailedLogin(key: string, now: number = Date.now()): Promise<void> {
  // Both bumps must land before the next check reads them, so they share a
  // transaction. They lock in a fixed order — the caller's bucket, then the
  // all-sources bucket — so concurrent failures queue behind each other rather
  // than deadlocking.
  await prisma.$transaction([
    bump(key, MAX_ATTEMPTS, now),
    bump(GLOBAL_KEY, GLOBAL_MAX_ATTEMPTS, now),
  ])

  // Housekeeping, deliberately outside that transaction and best-effort. It
  // deletes rows a concurrent bump may be holding, which inside the transaction
  // would mean taking locks in an order the bumps do not — the one shape that
  // could deadlock them. Nothing depends on a sweep having happened.
  await prune(now).catch(() => {})
}

/** Called on a successful sign-in so a coach who mistyped is not left throttled. */
export async function clearLoginAttempts(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: {
      // A correct password proves the traffic is not a spraying run, so the
      // all-sources counter goes too — otherwise noise from elsewhere on the
      // network could lock the coach out mid-session.
      key: { in: [key, GLOBAL_KEY] },
    },
  })
}

/** Test-only: drops all state so cases cannot leak into each other. */
export async function resetLoginRateLimit(): Promise<void> {
  await prisma.loginAttempt.deleteMany({})
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
