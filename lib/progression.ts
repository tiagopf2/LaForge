import { getStrengthIncrement, isCardioBenchmark, roundLoad, formatSeconds } from '@/lib/forge'

/**
 * Module 3/6C — the rule-based progression engine.
 *
 * Deliberately deterministic: the brief's progression rules are the scientific
 * foundation of the studio, so nothing here estimates or extrapolates.
 *
 *   Week 1  — calibration: 4 sets of 5, raise the load until set 4 sits at
 *             RPE 7-8. That load is the cycle's reference weight.
 *   Later   — 3 sets of 3-5 reps at the reference weight. Add reps before
 *             weight. Only after 3 clean sets of 5 does the load go up, and
 *             the next session restarts at 3x3.
 */

export type ProgressionPhase = 'calibration' | 'progression'

export type StrengthRecord = {
  value: number
  reps: number | null
  sets: number | null
  rpe: number | null
  phase: ProgressionPhase
  recordedAt: Date | string
}

export type CardioRecord = {
  value: number
  recordedAt: Date | string
}

export type Suggestion = {
  phase: ProgressionPhase
  /** kg for lifts, seconds for benchmarks. */
  suggestion: number | null
  unit: 'kg' | 'seconds'
  targetSets: number | null
  targetReps: number | null
  trend: 'new' | 'improving' | 'plateau' | 'declining' | 'holding'
  message: string
}

export const CALIBRATION_SETS = 4
export const CALIBRATION_REPS = 5
export const WORKING_SETS = 3
export const MIN_WORKING_REPS = 3
export const MAX_WORKING_REPS = 5
/** Brief: the calibration set should land here, not at a true max. */
export const TARGET_RPE = { min: 7, max: 8 } as const

const NEW_MOVEMENT: Suggestion = {
  phase: 'calibration',
  suggestion: null,
  unit: 'kg',
  targetSets: CALIBRATION_SETS,
  targetReps: CALIBRATION_REPS,
  trend: 'new',
  message: `Week 1 calibration: ${CALIBRATION_SETS} sets of ${CALIBRATION_REPS}. Add load each set until set ${CALIBRATION_SETS} sits at RPE ${TARGET_RPE.min}-${TARGET_RPE.max}, then log that load as the calibration result.`,
}

const time = (r: { recordedAt: Date | string }) => new Date(r.recordedAt).getTime()

/**
 * `records` may arrive in any order. Everything below works on a copy sorted
 * newest-first so callers do not have to care.
 */
export function getStrengthSuggestion(
  movementName: string,
  records: StrengthRecord[]
): Suggestion {
  const history = [...(records ?? [])].sort((a, b) => time(b) - time(a))
  if (history.length === 0) return NEW_MOVEMENT

  const calibration = history.find((r) => r.phase === 'calibration')

  // No reference weight yet — still in Week 1.
  if (!calibration) {
    const last = history[0]
    return {
      ...NEW_MOVEMENT,
      suggestion: roundLoad(last.value),
      trend: 'holding',
      message: `Still calibrating. Work up from ${roundLoad(last.value)}kg until ${CALIBRATION_REPS} reps land at RPE ${TARGET_RPE.min}-${TARGET_RPE.max}, then log it as calibration.`,
    }
  }

  const referenceWeight = roundLoad(calibration.value)

  // Only progression work done *after* the current reference weight counts;
  // a re-calibration starts the cycle over.
  const working = history.filter(
    (r) => r.phase === 'progression' && time(r) >= time(calibration)
  )

  if (working.length === 0) {
    return {
      phase: 'progression',
      suggestion: referenceWeight,
      unit: 'kg',
      targetSets: WORKING_SETS,
      targetReps: MIN_WORKING_REPS,
      trend: 'new',
      message: `Calibration complete at ${referenceWeight}kg. Start the cycle at ${WORKING_SETS}x${MIN_WORKING_REPS} with that reference load.`,
    }
  }

  const latest = working[0]
  const latestWeight = roundLoad(latest.value)
  const latestReps = latest.reps ?? 0
  const latestSets = latest.sets ?? 0

  // 3 clean sets of 5 is the only thing that unlocks more weight.
  if (latestSets >= WORKING_SETS && latestReps >= MAX_WORKING_REPS) {
    const nextWeight = roundLoad(latestWeight + getStrengthIncrement(movementName))
    return {
      phase: 'progression',
      suggestion: nextWeight,
      unit: 'kg',
      targetSets: WORKING_SETS,
      targetReps: MIN_WORKING_REPS,
      trend: 'improving',
      message: `${WORKING_SETS}x${MAX_WORKING_REPS} achieved at ${latestWeight}kg. Move up to ${nextWeight}kg and restart at ${WORKING_SETS}x${MIN_WORKING_REPS}.`,
    }
  }

  // Same load, one more rep per set — reps before weight.
  if (latestSets >= WORKING_SETS) {
    const targetReps = Math.min(MAX_WORKING_REPS, latestReps + 1)
    return {
      phase: 'progression',
      suggestion: latestWeight,
      unit: 'kg',
      targetSets: WORKING_SETS,
      targetReps,
      trend: detectTrend(working),
      message: `Hold ${latestWeight}kg and add reps: target ${WORKING_SETS}x${targetReps} today.`,
    }
  }

  // Did not complete all three sets — repeat the same target before advancing.
  return {
    phase: 'progression',
    suggestion: latestWeight,
    unit: 'kg',
    targetSets: WORKING_SETS,
    targetReps: Math.max(MIN_WORKING_REPS, latestReps),
    trend: 'holding',
    message: `Only ${latestSets} set${latestSets === 1 ? '' : 's'} completed last time. Repeat ${WORKING_SETS}x${Math.max(MIN_WORKING_REPS, latestReps)} at ${latestWeight}kg before progressing.`,
  }
}

/**
 * Cardio benchmarks are timed, so lower is better and the target is set from
 * the member's personal best rather than their most recent attempt.
 */
export function getCardioSuggestion(movementName: string, records: CardioRecord[]): Suggestion {
  const history = [...(records ?? [])].sort((a, b) => time(b) - time(a))

  if (history.length === 0) {
    return {
      phase: 'progression',
      suggestion: null,
      unit: 'seconds',
      targetSets: null,
      targetReps: null,
      trend: 'new',
      message: `No ${movementName} on file. Log a baseline effort first.`,
    }
  }

  const best = Math.min(...history.map((r) => r.value))
  const latest = history[0].value
  // A 1% trim off the personal best is a realistic session-to-session target.
  const target = Math.max(1, Math.round(best * 0.99))

  if (history.length === 1) {
    return {
      phase: 'progression',
      suggestion: target,
      unit: 'seconds',
      targetSets: null,
      targetReps: null,
      trend: 'new',
      message: `Baseline ${formatSeconds(latest)}. Aim for ${formatSeconds(target)} next time.`,
    }
  }

  const previous = history[1].value
  const trend: Suggestion['trend'] =
    latest < previous ? 'improving' : latest > previous ? 'declining' : 'plateau'

  const message =
    latest <= best
      ? `New personal best at ${formatSeconds(latest)}. Target ${formatSeconds(target)}.`
      : `Personal best is ${formatSeconds(best)} (last effort ${formatSeconds(latest)}). Pace for ${formatSeconds(target)} and hold it.`

  return {
    phase: 'progression',
    suggestion: target,
    unit: 'seconds',
    targetSets: null,
    targetReps: null,
    trend,
    message,
  }
}

/** Dispatches on the movement name so callers do not branch themselves. */
export function getSuggestion(
  movementName: string,
  records: Array<StrengthRecord & CardioRecord>
): Suggestion {
  return isCardioBenchmark(movementName)
    ? getCardioSuggestion(movementName, records)
    : getStrengthSuggestion(movementName, records)
}

function detectTrend(working: StrengthRecord[]): Suggestion['trend'] {
  const [latest, previous] = working
  if (!previous) return 'new'

  const volume = (r: StrengthRecord) => r.value * (r.reps ?? 0) * (r.sets ?? 0)
  const now = volume(latest)
  const before = volume(previous)

  if (now > before) return 'improving'
  if (now < before) return 'declining'
  return 'plateau'
}
