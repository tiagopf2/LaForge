import { beforeEach, describe, expect, it } from 'vitest'
import {
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

describe('clearLoginAttempts', () => {
  it('resets the count after a successful sign-in', () => {
    failTimes('10.0.0.1', MAX_ATTEMPTS - 1)
    clearLoginAttempts('10.0.0.1')

    // The earlier near-miss is forgotten, so the next typo does not lock out.
    failTimes('10.0.0.1', 1)
    expect(checkLoginRateLimit('10.0.0.1', T0).allowed).toBe(true)
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
