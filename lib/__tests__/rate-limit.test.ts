import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  GLOBAL_MAX_ATTEMPTS,
  MAX_ATTEMPTS,
  WINDOW_MS,
  checkLoginRateLimit,
  clearLoginAttempts,
  clientKey,
  recordFailedLogin,
  resetLoginRateLimit,
} from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

/**
 * These run against a real PostgreSQL, because the whole point of the throttle
 * is that its counting survives being shared between processes — and that is a
 * property of the SQL, not of anything a fake store would exercise. They need
 * DATABASE_URL set and migrations applied, and they fail loudly rather than
 * skipping if that is not the case: a security test that quietly opts out is
 * worse than no test, because it still gets trusted.
 */

// Time is injected rather than mocked so each case states its own clock.
const T0 = 1_700_000_000_000

const failTimes = async (key: string, times: number, now = T0) => {
  for (let i = 0; i < times; i++) await recordFailedLogin(key, now)
}

beforeEach(async () => {
  await resetLoginRateLimit()
})

afterAll(async () => {
  await resetLoginRateLimit()
  await prisma.$disconnect()
})

describe('checkLoginRateLimit', () => {
  it('allows a key that has never been seen', async () => {
    expect(await checkLoginRateLimit('10.0.0.1', T0)).toEqual({ allowed: true })
  })

  it('allows attempts right up to the limit', async () => {
    await failTimes('10.0.0.1', MAX_ATTEMPTS - 1)
    expect((await checkLoginRateLimit('10.0.0.1', T0)).allowed).toBe(true)
  })

  it('blocks once the limit is reached', async () => {
    await failTimes('10.0.0.1', MAX_ATTEMPTS)

    const result = await checkLoginRateLimit('10.0.0.1', T0)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBe(WINDOW_MS / 1000)
    }
  })

  it('keeps the block for the whole window, then releases it', async () => {
    await failTimes('10.0.0.1', MAX_ATTEMPTS)

    expect((await checkLoginRateLimit('10.0.0.1', T0 + WINDOW_MS - 1)).allowed).toBe(false)
    expect((await checkLoginRateLimit('10.0.0.1', T0 + WINDOW_MS + 1)).allowed).toBe(true)
  })

  it('throttles each key independently', async () => {
    await failTimes('10.0.0.1', MAX_ATTEMPTS)

    expect((await checkLoginRateLimit('10.0.0.1', T0)).allowed).toBe(false)
    expect((await checkLoginRateLimit('10.0.0.2', T0)).allowed).toBe(true)
  })
})

describe('recordFailedLogin', () => {
  it('starts a fresh count when failures are spread beyond the window', async () => {
    // Slow guessing must not accumulate into a lockout.
    for (let i = 0; i < MAX_ATTEMPTS * 3; i++) {
      const now = T0 + i * (WINDOW_MS + 1)
      await recordFailedLogin('10.0.0.1', now)
      expect((await checkLoginRateLimit('10.0.0.1', now)).allowed).toBe(true)
    }
  })

  it('still blocks when attempts sit just inside the window', async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await recordFailedLogin('10.0.0.1', T0 + i * 1000)
    }
    expect((await checkLoginRateLimit('10.0.0.1', T0 + MAX_ATTEMPTS * 1000)).allowed).toBe(false)
  })

  it('counts every failure when they arrive at once', async () => {
    // The reason this table exists. Concurrent requests land on separate
    // connections, so the increment has to be atomic in SQL — a read-then-write
    // would lose updates here and the limit would be reached late or not at all.
    await Promise.all(
      Array.from({ length: MAX_ATTEMPTS }, () => recordFailedLogin('10.0.0.1', T0))
    )

    const row = await prisma.loginAttempt.findUnique({ where: { key: '10.0.0.1' } })
    expect(row?.count).toBe(MAX_ATTEMPTS)
    expect((await checkLoginRateLimit('10.0.0.1', T0)).allowed).toBe(false)
  })
})

describe('all-sources limit', () => {
  // `x-forwarded-for` is attacker-controlled, so a per-key limit alone is
  // bypassed by sending a different address on every request. These cases pin
  // the counter that has no key to rotate.
  const spray = async (attempts: number, now = T0) => {
    for (let i = 0; i < attempts; i++) await recordFailedLogin(`10.0.0.${i}`, now)
  }

  it('does not fire before the global limit is reached', async () => {
    await spray(GLOBAL_MAX_ATTEMPTS - 1)
    expect((await checkLoginRateLimit('10.0.0.250', T0)).allowed).toBe(true)
  })

  it('blocks a never-before-seen address once the global limit is reached', async () => {
    await spray(GLOBAL_MAX_ATTEMPTS)

    const result = await checkLoginRateLimit('10.0.0.250', T0)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.retryAfterSeconds).toBe(WINDOW_MS / 1000)
  })

  it('releases the global block after the window', async () => {
    await spray(GLOBAL_MAX_ATTEMPTS)

    expect((await checkLoginRateLimit('10.0.0.250', T0 + WINDOW_MS - 1)).allowed).toBe(false)
    expect((await checkLoginRateLimit('10.0.0.250', T0 + WINDOW_MS + 1)).allowed).toBe(true)
  })

  it('reports the longer of the two lockouts', async () => {
    // Per-key lockout starts at T0, global lockout ten minutes later.
    await failTimes('10.0.0.1', MAX_ATTEMPTS)
    const later = T0 + 10 * 60 * 1000
    await spray(GLOBAL_MAX_ATTEMPTS, later)

    const result = await checkLoginRateLimit('10.0.0.1', later)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.retryAfterSeconds).toBe(WINDOW_MS / 1000)
  })
})

describe('clearLoginAttempts', () => {
  it('resets the count after a successful sign-in', async () => {
    await failTimes('10.0.0.1', MAX_ATTEMPTS - 1)
    await clearLoginAttempts('10.0.0.1')

    // The earlier near-miss is forgotten, so the next typo does not lock out.
    await failTimes('10.0.0.1', 1)
    expect((await checkLoginRateLimit('10.0.0.1', T0)).allowed).toBe(true)
  })

  it('clears the all-sources counter too, so noise cannot lock the coach out', async () => {
    for (let i = 0; i < GLOBAL_MAX_ATTEMPTS - 1; i++) await recordFailedLogin(`10.0.0.${i}`, T0)
    await clearLoginAttempts('10.0.0.250')

    for (let i = 0; i < GLOBAL_MAX_ATTEMPTS - 1; i++) await recordFailedLogin(`10.1.0.${i}`, T0)
    expect((await checkLoginRateLimit('10.0.0.250', T0)).allowed).toBe(true)
  })
})

describe('pruning', () => {
  it('does not let a spraying run grow the table without bound', async () => {
    // Every forged address creates a row. Once their window has passed and no
    // lockout is outstanding, the next failure sweeps them away.
    for (let i = 0; i < 20; i++) await recordFailedLogin(`10.0.0.${i}`, T0)
    expect(await prisma.loginAttempt.count()).toBeGreaterThan(20)

    await recordFailedLogin('10.9.9.9', T0 + 2 * WINDOW_MS)

    // Only the sweeping attempt's own two buckets survive.
    expect(await prisma.loginAttempt.count()).toBe(2)
  })
})

describe('clientKey', () => {
  it('takes the first hop of x-forwarded-for', () => {
    expect(clientKey({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    expect(clientKey({ 'x-real-ip': '203.0.113.9' })).toBe('203.0.113.9')
  })

  it('buckets unidentifiable requests together rather than letting them through', () => {
    expect(clientKey(undefined)).toBe('unknown')
    expect(clientKey({})).toBe('unknown')
    expect(clientKey({ 'x-forwarded-for': '   ' })).toBe('unknown')
  })
})
