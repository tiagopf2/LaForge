import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as forge from '@/lib/forge'
import {
  getStrengthSuggestion,
  getCardioSuggestion,
  getSuggestion,
  CALIBRATION_SETS,
  CALIBRATION_REPS,
  WORKING_SETS,
  MIN_WORKING_REPS,
  MAX_WORKING_REPS,
  type StrengthRecord,
  type CardioRecord,
} from '@/lib/progression'

/**
 * `lib/progression.ts` depends on four helpers from `@/lib/forge`. We mock the
 * whole module so these tests exercise only the progression logic and never the
 * real forge internals.
 *
 *  - roundLoad          -> rounds to the nearest 2.5kg (deterministic, easy asserts)
 *  - getStrengthIncrement -> flat 2.5kg jump
 *  - isCardioBenchmark  -> false by default; overridden per test where needed
 *  - formatSeconds      -> compact "<n>s" string
 */
vi.mock('@/lib/forge', () => ({
  roundLoad: vi.fn((kg: number) => Math.round(kg / 2.5) * 2.5),
  getStrengthIncrement: vi.fn(() => 2.5),
  isCardioBenchmark: vi.fn(() => false),
  formatSeconds: vi.fn((n: number) => `${Math.max(0, Math.round(n))}s`),
}))

// Typed handles to the mocked functions for per-test overrides / assertions.
const mockedForge = vi.mocked(forge)

// ---- fixture helpers --------------------------------------------------------

let clock = 0
/** Monotonically increasing timestamps so "newest" is unambiguous per call. */
function nextTime(): string {
  clock += 1
  return new Date(2026, 0, clock).toISOString()
}

function strengthRecord(overrides: Partial<StrengthRecord> = {}): StrengthRecord {
  return {
    value: 100,
    reps: 5,
    sets: 3,
    rpe: 8,
    phase: 'progression',
    recordedAt: nextTime(),
    ...overrides,
  }
}

function cardioRecord(value: number, recordedAt?: string): CardioRecord {
  return { value, recordedAt: recordedAt ?? nextTime() }
}

beforeEach(() => {
  vi.clearAllMocks()
  clock = 0
  // Restore default implementations after clearAllMocks wiped them.
  mockedForge.roundLoad.mockImplementation((kg: number) => Math.round(kg / 2.5) * 2.5)
  mockedForge.getStrengthIncrement.mockImplementation(() => 2.5)
  mockedForge.isCardioBenchmark.mockImplementation(() => false)
  mockedForge.formatSeconds.mockImplementation((n: number) => `${Math.max(0, Math.round(n))}s`)
})

// ============================================================================
// getStrengthSuggestion
// ============================================================================
describe('getStrengthSuggestion', () => {
  it('a. returns the NEW_MOVEMENT calibration prescription when there are no records', () => {
    const result = getStrengthSuggestion('Bench Press', [])

    expect(result).toMatchObject({
      phase: 'calibration',
      suggestion: null,
      unit: 'kg',
      targetSets: CALIBRATION_SETS,
      targetReps: CALIBRATION_REPS,
      trend: 'new',
    })
    expect(result.message).toContain('calibration')
  })

  it('a. treats a null/undefined records list as empty', () => {
    // @ts-expect-error deliberately passing a nullish list to hit the `?? []` guard
    const result = getStrengthSuggestion('Bench Press', null)
    expect(result).toMatchObject({ phase: 'calibration', suggestion: null, trend: 'new' })
  })

  it('b. keeps calibrating (trend=holding) when records exist but none are calibration', () => {
    const records = [
      strengthRecord({ value: 60, phase: 'progression' }),
      strengthRecord({ value: 62.5, phase: 'progression' }), // newest -> history[0]
    ]

    const result = getStrengthSuggestion('Bench Press', records)

    expect(result).toMatchObject({
      phase: 'calibration',
      unit: 'kg',
      targetSets: CALIBRATION_SETS,
      targetReps: CALIBRATION_REPS,
      trend: 'holding',
    })
    // suggestion comes from roundLoad(latest.value) -> latest is the 62.5 record
    expect(result.suggestion).toBe(62.5)
    expect(mockedForge.roundLoad).toHaveBeenCalledWith(62.5)
  })

  it('c. starts the first working cycle when calibration exists but no progression records', () => {
    const records = [strengthRecord({ value: 80, phase: 'calibration' })]

    const result = getStrengthSuggestion('Bench Press', records)

    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: 80,
      unit: 'kg',
      targetSets: WORKING_SETS,
      targetReps: MIN_WORKING_REPS,
      trend: 'new',
    })
    expect(result.message).toContain(`${WORKING_SETS}x${MIN_WORKING_REPS}`)
  })

  it('d. repeats the same target (trend=holding) when the last session had too few sets', () => {
    const calibration = strengthRecord({ value: 80, phase: 'calibration' })
    const lastWorking = strengthRecord({
      value: 80,
      sets: WORKING_SETS - 1, // incomplete
      reps: 4,
      phase: 'progression',
    })

    const result = getStrengthSuggestion('Bench Press', [calibration, lastWorking])

    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: 80,
      unit: 'kg',
      targetSets: WORKING_SETS,
      targetReps: Math.max(MIN_WORKING_REPS, 4), // = 4
      trend: 'holding',
    })
    expect(result.message).toContain('set')
  })

  it('d. floors the repeat target at MIN_WORKING_REPS when reps were very low', () => {
    const calibration = strengthRecord({ value: 80, phase: 'calibration' })
    const lastWorking = strengthRecord({
      value: 80,
      sets: 1, // incomplete + singular "set" wording
      reps: 1,
      phase: 'progression',
    })

    const result = getStrengthSuggestion('Bench Press', [calibration, lastWorking])

    expect(result.targetReps).toBe(MIN_WORKING_REPS)
    expect(result.trend).toBe('holding')
    expect(result.message).toContain('1 set ') // singular, no trailing "s"
  })

  it('e. adds a rep and reports an improving trend when volume increased', () => {
    const calibration = strengthRecord({ value: 100, phase: 'calibration' })
    const previous = strengthRecord({ value: 100, reps: 3, sets: WORKING_SETS }) // vol 900
    const latest = strengthRecord({ value: 100, reps: 4, sets: WORKING_SETS }) // vol 1200 (newest)

    const result = getStrengthSuggestion('Bench Press', [calibration, previous, latest])

    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: 100,
      targetSets: WORKING_SETS,
      targetReps: Math.min(MAX_WORKING_REPS, 4 + 1), // 5
      trend: 'improving',
    })
  })

  it('e. reports a declining trend when volume dropped', () => {
    const calibration = strengthRecord({ value: 100, phase: 'calibration' })
    const previous = strengthRecord({ value: 100, reps: 5, sets: WORKING_SETS }) // vol 1500
    const latest = strengthRecord({ value: 100, reps: 4, sets: WORKING_SETS }) // vol 1200 (newest)

    const result = getStrengthSuggestion('Bench Press', [calibration, previous, latest])

    expect(result.trend).toBe('declining')
    expect(result.targetReps).toBe(5)
  })

  it('e. reports a plateau trend when volume is unchanged', () => {
    const calibration = strengthRecord({ value: 100, phase: 'calibration' })
    const previous = strengthRecord({ value: 100, reps: 4, sets: WORKING_SETS }) // vol 1200
    const latest = strengthRecord({ value: 100, reps: 4, sets: WORKING_SETS }) // vol 1200 (newest)

    const result = getStrengthSuggestion('Bench Press', [calibration, previous, latest])

    expect(result.trend).toBe('plateau')
  })

  it('e. reports trend=new when there is only a single progression record', () => {
    const calibration = strengthRecord({ value: 100, phase: 'calibration' })
    const latest = strengthRecord({ value: 100, reps: 4, sets: WORKING_SETS })

    const result = getStrengthSuggestion('Bench Press', [calibration, latest])

    expect(result.trend).toBe('new')
    expect(result.targetReps).toBe(5)
  })

  it('f. unlocks more weight after 3x5 is achieved and restarts at the min reps', () => {
    const calibration = strengthRecord({ value: 100, phase: 'calibration' })
    const latest = strengthRecord({
      value: 100,
      reps: MAX_WORKING_REPS,
      sets: WORKING_SETS,
      phase: 'progression',
    })

    const result = getStrengthSuggestion('Bench Press', [calibration, latest])

    expect(mockedForge.getStrengthIncrement).toHaveBeenCalledWith('Bench Press')
    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: 102.5, // roundLoad(100 + 2.5)
      unit: 'kg',
      targetSets: WORKING_SETS,
      targetReps: MIN_WORKING_REPS,
      trend: 'improving',
    })
    expect(result.message).toContain('102.5kg')
  })

  it('ignores progression records logged before the calibration record', () => {
    // A stale progression entry older than calibration must not count as working.
    const staleProgression = strengthRecord({ value: 70, reps: 5, sets: WORKING_SETS })
    const calibration = strengthRecord({ value: 100, phase: 'calibration' })

    const result = getStrengthSuggestion('Bench Press', [staleProgression, calibration])

    // No working record after calibration -> first-cycle start.
    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: 100,
      targetReps: MIN_WORKING_REPS,
      trend: 'new',
    })
  })

  it('treats null reps/sets on the latest record as zero (incomplete-sets branch)', () => {
    const calibration = strengthRecord({ value: 90, phase: 'calibration' })
    const latest = strengthRecord({ value: 90, reps: null, sets: null, phase: 'progression' })

    const result = getStrengthSuggestion('Bench Press', [calibration, latest])

    expect(result.trend).toBe('holding')
    expect(result.targetReps).toBe(MIN_WORKING_REPS)
  })
})

// ============================================================================
// getCardioSuggestion
// ============================================================================
describe('getCardioSuggestion', () => {
  it('a. asks for a baseline (trend=new, suggestion=null) when there are no records', () => {
    const result = getCardioSuggestion('500m Row', [])

    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: null,
      unit: 'seconds',
      targetSets: null,
      targetReps: null,
      trend: 'new',
    })
    expect(result.message).toContain('500m Row')
  })

  it('b. sets a 1% target off a single baseline effort (trend=new)', () => {
    const result = getCardioSuggestion('500m Row', [cardioRecord(120)])

    expect(result).toMatchObject({
      phase: 'progression',
      suggestion: Math.round(120 * 0.99), // 119
      unit: 'seconds',
      trend: 'new',
    })
    expect(result.message).toContain('Baseline')
    expect(mockedForge.formatSeconds).toHaveBeenCalled()
  })

  it('c. reports improving when the latest effort is faster than the previous one', () => {
    // newest first once sorted: latest=100 < previous=110
    const older = cardioRecord(110)
    const newer = cardioRecord(100)

    const result = getCardioSuggestion('500m Row', [older, newer])

    expect(result.trend).toBe('improving')
    expect(result.suggestion).toBe(Math.round(100 * 0.99)) // best=100
  })

  it('d. reports declining when the latest effort is slower than the previous one', () => {
    const older = cardioRecord(100)
    const newer = cardioRecord(120)

    const result = getCardioSuggestion('500m Row', [older, newer])

    expect(result.trend).toBe('declining')
  })

  it('e. reports a plateau when the latest and previous efforts are equal', () => {
    const older = cardioRecord(100)
    const newer = cardioRecord(100)

    const result = getCardioSuggestion('500m Row', [older, newer])

    expect(result.trend).toBe('plateau')
  })

  it('f. uses the "new personal best" message when the latest effort ties/beats the best', () => {
    const older = cardioRecord(110)
    const newer = cardioRecord(100) // also the best

    const result = getCardioSuggestion('500m Row', [older, newer])

    expect(result.message).toContain('New personal best')
  })

  it('f. uses the "pace for" message when the latest effort is off the personal best', () => {
    const best = cardioRecord(100)
    const latest = cardioRecord(120) // slower than the standing best

    const result = getCardioSuggestion('500m Row', [best, latest])

    expect(result.message).toContain('Personal best is')
    expect(result.message).toContain('Pace for')
  })

  it('never targets below 1 second even for tiny values', () => {
    const result = getCardioSuggestion('500m Row', [cardioRecord(0)])
    expect(result.suggestion).toBe(1)
  })
})

// ============================================================================
// getSuggestion (dispatcher)
// ============================================================================
describe('getSuggestion', () => {
  it('routes to the cardio engine when the movement is a cardio benchmark', () => {
    mockedForge.isCardioBenchmark.mockReturnValue(true)

    const result = getSuggestion('500m Row', [
      { value: 120, recordedAt: nextTime() } as StrengthRecord & CardioRecord,
    ])

    expect(mockedForge.isCardioBenchmark).toHaveBeenCalledWith('500m Row')
    expect(result.unit).toBe('seconds')
  })

  it('routes to the strength engine when the movement is not a cardio benchmark', () => {
    mockedForge.isCardioBenchmark.mockReturnValue(false)

    const result = getSuggestion('Bench Press', [])

    expect(mockedForge.isCardioBenchmark).toHaveBeenCalledWith('Bench Press')
    expect(result.unit).toBe('kg')
    expect(result.phase).toBe('calibration')
  })
})
