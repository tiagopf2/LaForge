import { beforeEach, describe, expect, it } from 'vitest'
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

// Time is injected rather than mocked so each case states its own clock.
const T0 = 1_700_000_000_000

const failTimes = (key: string, times: number, now = T0) => {
  for (let i = 0; i < times; i++) recordFailedLogin(key, now)
}

beforeEach(() => {
  resetLoginRateLimit()
})

describe('checkLoginRateLimit', () => {
  it('allows a key that has never been seen', () => {
    expect(checkLoginRateLimit('10.0.0.1', T0)).toEqual({ allowed: true })
  })

  it('allows attempts right up to the limit', () => {
    failTimes('10.0.0.1', MAX_ATTEMPTS - 1)
    expect(checkLoginRateLimit('10.0.0.1', T0).allowed).toBe(true)
  })

  it('blocks once the limit is reached', () => {
    failTimes('10.0.0.1', MAX_ATTEMPTS)

    const result = checkLoginRateLimit('10.0.0.1', T0)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBe(WINDOW_MS / 1000)
    }
  })

  it('keeps the block for the whole window, then releases it', () => {
    failTimes('10.0.0.1', MAX_ATTEMPTS)

    expect(checkLoginRateLimit('10.0.0.1', T0 + WINDOW_MS - 1).allowed).toBe(false)
    expect(checkLoginRateLimit('10.0.0.1', T0 + WINDOW_MS + 1).allowed).toBe(true)
  })

  it('throttles each key independently', () => {
    failTimes('10.0.0.1', MAX_ATTEMPTS)

    expect(checkLoginRateLimit('10.0.0.1', T0).allowed).toBe(false)
    expect(checkLoginRateLimit('10.0.0.2', T0).allowed).toBe(true)
  })
})

describe('recordFailedLogin', () => {
  it('starts a fresh count when failures are spread beyond the window', () => {
    // Slow guessing must not accumulate into a lockout.
    for (let i = 0; i < MAX_ATTEMPTS * 3; i++) {
      const now = T0 + i * (WINDOW_MS + 1)
      recordFailedLogin('10.0.0.1', now)
      expect(checkLoginRateLimit('10.0.0.1', now).allowed).toBe(true)
    }
  })

  it('still blocks when attempts sit just inside the window', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailedLogin('10.0.0.1', T0 + i * 1000)
    }
    expect(checkLoginRateLimit('10.0.0.1', T0 + MAX_ATTEMPTS * 1000).allowed).toBe(false)
  })
})

describe('all-sources limit', () => {
  // `x-forwarded-for` is attacker-controlled, so a per-key limit alone is
  // bypassed by sending a different address on every request. These cases pin
  // the counter that has no key to rotate.
  const spray = (attempts: number, now = T0) => {
    for (let i = 0; i < attempts; i++) recordFailedLogin(`10.0.0.${i}`, now)
  }

  it('does not fire before the global limit is reached', () => {
    spray(GLOBAL_MAX_ATTEMPTS - 1)
    expect(checkLoginRateLimit('10.0.0.250', T0).allowed).toBe(true)
  })

  it('blocks a never-before-seen address once the global limit is reached', () => {
    spray(GLOBAL_MAX_ATTEMPTS)

    const result = checkLoginRateLimit('10.0.0.250', T0)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.retryAfterSeconds).toBe(WINDOW_MS / 1000)
  })

  it('releases the global block after the window', () => {
    spray(GLOBAL_MAX_ATTEMPTS)

    expect(checkLoginRateLimit('10.0.0.250', T0 + WINDOW_MS - 1).allowed).toBe(false)
    expect(checkLoginRateLimit('10.0.0.250', T0 + WINDOW_MS + 1).allowed).toBe(true)
  })

  it('reports the longer of the two lockouts', () => {
    // Per-key lockout starts at T0, global lockout ten minutes later.
    failTimes('10.0.0.1', MAX_ATTEMPTS)
    const later = T0 + 10 * 60 * 1000
    spray(GLOBAL_MAX_ATTEMPTS, later)

    const result = checkLoginRateLimit('10.0.0.1', later)
    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.retryAfterSeconds).toBe(WINDOW_MS / 1000)
  })
})

describe('clearLoginAttempts', () => {
  it('resets the count after a successful sign-in', () => {
    failTimes('10.0.0.1', MAX_ATTEMPTS - 1)
    clearLoginAttempts('10.0.0.1')

    // The earlier near-miss is forgotten, so the next typo does not lock out.
    failTimes('10.0.0.1', 1)
    expect(checkLoginRateLimit('10.0.0.1', T0).allowed).toBe(true)
  })

  it('clears the all-sources counter too, so noise cannot lock the coach out', () => {
    for (let i = 0; i < GLOBAL_MAX_ATTEMPTS - 1; i++) recordFailedLogin(`10.0.0.${i}`, T0)
    clearLoginAttempts('10.0.0.250')

    for (let i = 0; i < GLOBAL_MAX_ATTEMPTS - 1; i++) recordFailedLogin(`10.1.0.${i}`, T0)
    expect(checkLoginRateLimit('10.0.0.250', T0).allowed).toBe(true)
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
