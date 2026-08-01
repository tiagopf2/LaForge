import {
  CALIBRATION_REPS,
  CALIBRATION_SETS,
  MAX_WORKING_REPS,
  MIN_WORKING_REPS,
  TARGET_RPE,
  WORKING_SETS,
} from '@/lib/progression'
import {
  getStrengthIncrement,
  type ContraindicationArea,
  type Difficulty,
  type MemberLevel,
  type MovementPattern,
  type SessionType,
  type StrengthMovement,
} from '@/lib/forge'

/**
 * Module 6B — Program Generator.
 *
 * Rule-based on purpose. The brief wants deterministic periodisation the coach
 * can predict and override: Block A follows the linear-progression rules
 * exactly, and Blocks B and C are *selected* from the coach's own library
 * rather than invented.
 */

export type LibraryExercise = {
  id: string
  name: string
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  movementPattern: string
  difficulty: string
  equipment: string[]
  contraindications: string[]
  loadingScheme: string | null
  coachNotes: string | null
  tier: string
  active: boolean
}

export type BlockAWeek = {
  movement: StrengthMovement
  phase: 'calibration' | 'progression'
  sets: number
  reps: number
  /** Load relative to the cycle reference weight, in kg. */
  loadOffsetKg: number
  loadHint: string
  note: string
}

export type PrescribedExercise = {
  name: string
  sets: number
  reps: string
  rpe: string | null
  note: string | null
}

export type CycleWeek = {
  week: number
  focus: string
  blockA: BlockAWeek
  blockB: {
    format: string
    durationMin: string
    exercises: PrescribedExercise[]
  }
  blockC: {
    format: string
    durationMin: string
    movements: PrescribedExercise[]
    avoids: string[]
  }
}

export type CyclePlan = {
  templateName: string
  goal: string
  level: MemberLevel
  sessionType: SessionType
  cycleLength: number
  mainMovement: StrengthMovement
  referenceWeightKg: number | null
  incrementKg: number
  warnings: string[]
  weeks: CycleWeek[]
}

/** Default main lift per session type; the coach can override it. */
const DEFAULT_MAIN_MOVEMENT: Record<SessionType, StrengthMovement> = {
  upper: 'Bench Press',
  lower: 'Back Squat',
  full: 'Deadlift',
  conditioning: 'Overhead Press',
}

const MOVEMENT_PATTERN: Record<StrengthMovement, MovementPattern> = {
  'Back Squat': 'squat',
  Deadlift: 'hinge',
  'Bench Press': 'push',
  'Overhead Press': 'push',
  'Barbell Row': 'pull',
}

/** Block B should balance Block A rather than pile onto it. */
const COMPLEMENTARY_PATTERNS: Record<MovementPattern, MovementPattern[]> = {
  push: ['pull', 'core', 'push'],
  pull: ['push', 'core', 'pull'],
  squat: ['hinge', 'lunge', 'core'],
  hinge: ['squat', 'lunge', 'core'],
  lunge: ['hinge', 'core', 'squat'],
  carry: ['core', 'pull', 'squat'],
  core: ['pull', 'push', 'core'],
  rotation: ['core', 'pull', 'push'],
  cardio: ['core', 'pull', 'squat'],
}

const LEVEL_ALLOWS: Record<MemberLevel, Difficulty[]> = {
  beginner: ['all', 'beginner'],
  intermediate: ['all', 'beginner', 'intermediate'],
  advanced: ['all', 'beginner', 'intermediate', 'advanced'],
}

/** Goal shapes the accessory/conditioning dose, never Block A's rules. */
type GoalProfile = {
  accessorySets: number
  accessoryReps: string
  accessoryRpe: string
  accessoryCount: number
  blockBFormat: string
  blockCFormat: (week: number) => string
  conditioningCount: number
}

const GOAL_PROFILES: Record<string, GoalProfile> = {
  Strength: {
    accessorySets: 4,
    accessoryReps: '6-8',
    accessoryRpe: 'RPE 7',
    accessoryCount: 3,
    blockBFormat: 'Superset — 4 rounds, 90s rest between rounds',
    blockCFormat: (w) => (w % 2 === 1 ? 'For Time — 2 rounds' : 'EMOM 10 min'),
    conditioningCount: 2,
  },
  Performance: {
    accessorySets: 4,
    accessoryReps: '6-10',
    accessoryRpe: 'RPE 7-8',
    accessoryCount: 3,
    blockBFormat: 'Triset — 4 rounds, 75s rest between rounds',
    blockCFormat: (w) => (w % 2 === 1 ? 'AMRAP 10 min' : 'For Time — 3 rounds'),
    conditioningCount: 3,
  },
  'Fat Loss': {
    accessorySets: 3,
    accessoryReps: '12-15',
    accessoryRpe: 'RPE 7',
    accessoryCount: 3,
    blockBFormat: 'Circuit — 3 rounds, 45s rest between rounds',
    blockCFormat: () => 'AMRAP 10 min',
    conditioningCount: 3,
  },
  Conditioning: {
    accessorySets: 3,
    accessoryReps: '10-12',
    accessoryRpe: 'RPE 7-8',
    accessoryCount: 3,
    blockBFormat: 'Circuit — 3 rounds, 60s rest between rounds',
    blockCFormat: (w) => (w % 2 === 1 ? 'EMOM 10 min' : 'AMRAP 10 min'),
    conditioningCount: 3,
  },
  'Muscle Gain': {
    accessorySets: 4,
    accessoryReps: '8-12',
    accessoryRpe: 'RPE 8',
    accessoryCount: 3,
    blockBFormat: 'Superset — 4 rounds, 75s rest between rounds',
    blockCFormat: () => 'EMOM 10 min',
    conditioningCount: 2,
  },
  Flexibility: {
    accessorySets: 3,
    accessoryReps: '10-12',
    accessoryRpe: 'RPE 6-7',
    accessoryCount: 3,
    blockBFormat: 'Circuit — 3 rounds, 60s rest, hold end range 2s',
    blockCFormat: () => 'EMOM 10 min',
    conditioningCount: 2,
  },
}

const DEFAULT_GOAL_PROFILE: GoalProfile = {
  accessorySets: 3,
  accessoryReps: '8-12',
  accessoryRpe: 'RPE 7-8',
  accessoryCount: 3,
  blockBFormat: 'Superset — 3 rounds, 60s rest between rounds',
  blockCFormat: (w) => (w % 2 === 1 ? 'EMOM 10 min' : 'AMRAP 10 min'),
  conditioningCount: 3,
}

export function buildCycle({
  goal,
  level,
  sessionType,
  cycleLength,
  mainMovement,
  avoidAreas,
  referenceWeightKg,
  library,
}: {
  goal: string
  level: MemberLevel
  sessionType: SessionType
  cycleLength: number
  mainMovement?: StrengthMovement
  avoidAreas: ContraindicationArea[]
  referenceWeightKg: number | null
  library: LibraryExercise[]
}): CyclePlan {
  const warnings: string[] = []
  const main = mainMovement ?? DEFAULT_MAIN_MOVEMENT[sessionType]
  const mainPattern = MOVEMENT_PATTERN[main]
  const increment = getStrengthIncrement(main)
  const profile = GOAL_PROFILES[goal] ?? DEFAULT_GOAL_PROFILE

  if (avoidAreas.length > 0 && mainLiftIsRisky(main, avoidAreas)) {
    warnings.push(
      `${main} loads an area this member is told to avoid (${avoidAreas.join(', ')}). Confirm or swap the main movement before assigning.`
    )
  }

  const usable = library.filter(
    (ex) =>
      ex.active &&
      LEVEL_ALLOWS[level].includes(ex.difficulty as Difficulty) &&
      (level === 'advanced' || ex.tier === 'studio') &&
      !ex.contraindications.some((c) => avoidAreas.includes(c as ContraindicationArea))
  )

  const accessoryPool = buildAccessoryPool(usable, mainPattern)
  const conditioningPool = usable.filter((ex) => ex.category === 'conditioning' || ex.category === 'cardio')

  if (accessoryPool.length === 0) {
    warnings.push(
      'No accessory exercises in the library match this level and restriction set — Block B is left for the coach to fill.'
    )
  }
  if (conditioningPool.length === 0) {
    warnings.push(
      'No conditioning exercises match this level and restriction set — Block C is left for the coach to fill.'
    )
  }

  const weeks: CycleWeek[] = []

  for (let week = 1; week <= cycleLength; week += 1) {
    const blockA = buildBlockA(main, week, increment)
    const loadedMuscles = new Set(musclesOf(main))

    const blockBExercises = pickRotating(
      accessoryPool,
      profile.accessoryCount,
      week
    ).map((ex) => {
      ex.primaryMuscles.forEach((m) => loadedMuscles.add(m))
      return {
        name: ex.name,
        sets: profile.accessorySets,
        reps: profile.accessoryReps,
        rpe: profile.accessoryRpe,
        note: ex.coachNotes,
      }
    })

    // Block C must not re-hit what A and B already hammered.
    const freshConditioning = conditioningPool.filter(
      (ex) => !ex.primaryMuscles.some((m) => loadedMuscles.has(m))
    )
    const conditioningSource =
      freshConditioning.length >= profile.conditioningCount ? freshConditioning : conditioningPool

    const blockCMovements = pickRotating(conditioningSource, profile.conditioningCount, week).map(
      (ex) => ({
        name: ex.name,
        sets: 1,
        reps: ex.loadingScheme ?? 'Coach-set reps',
        rpe: null,
        note: ex.coachNotes,
      })
    )

    weeks.push({
      week,
      focus:
        week === 1
          ? 'Calibration week — find the reference load, no performance target'
          : `Linear progression — ${blockA.sets}x${blockA.reps} at ${blockA.loadHint}`,
      blockA,
      blockB: {
        format: profile.blockBFormat,
        durationMin: '10-15',
        exercises: blockBExercises,
      },
      blockC: {
        format: profile.blockCFormat(week),
        durationMin: '10',
        movements: blockCMovements,
        avoids: [...loadedMuscles].sort(),
      },
    })
  }

  return {
    templateName: `${goal} · ${sessionType} · ${cycleLength} weeks`,
    goal,
    level,
    sessionType,
    cycleLength,
    mainMovement: main,
    referenceWeightKg,
    incrementKg: increment,
    warnings,
    weeks,
  }
}

/**
 * Week 1 calibrates. From week 2 the cycle walks 3x3 -> 3x4 -> 3x5, then adds
 * one increment and restarts at 3x3 — the brief's rule, laid out in advance so
 * the coach can see the whole cycle before assigning it.
 */
function buildBlockA(
  movement: StrengthMovement,
  week: number,
  increment: number
): BlockAWeek {
  if (week === 1) {
    return {
      movement,
      phase: 'calibration',
      sets: CALIBRATION_SETS,
      reps: CALIBRATION_REPS,
      loadOffsetKg: 0,
      loadHint: 'work up',
      note: `Technical focus. Add load each set until set ${CALIBRATION_SETS} lands at RPE ${TARGET_RPE.min}-${TARGET_RPE.max} for ${CALIBRATION_REPS} reps. That load is the reference weight for the cycle.`,
    }
  }

  const repRange = MAX_WORKING_REPS - MIN_WORKING_REPS + 1 // 3, 4, 5
  const stepsSinceCalibration = week - 2
  const blocksCompleted = Math.floor(stepsSinceCalibration / repRange)
  const reps = MIN_WORKING_REPS + (stepsSinceCalibration % repRange)
  const loadOffsetKg = blocksCompleted * increment

  return {
    movement,
    phase: 'progression',
    sets: WORKING_SETS,
    reps,
    loadOffsetKg,
    loadHint: loadOffsetKg === 0 ? 'reference weight' : `reference +${loadOffsetKg}kg`,
    note:
      reps === MIN_WORKING_REPS && loadOffsetKg > 0
        ? `Load went up by ${increment}kg after a clean ${WORKING_SETS}x${MAX_WORKING_REPS}. Restart the rep ladder.`
        : reps === MAX_WORKING_REPS
          ? `Target ${WORKING_SETS} clean sets of ${MAX_WORKING_REPS}. Only then does the load go up.`
          : 'Same load as last week, one more rep per set. Reps before weight.',
  }
}

/**
 * Accessories that balance the main lift, ordered so the most complementary
 * pattern comes first.
 */
function buildAccessoryPool(library: LibraryExercise[], mainPattern: MovementPattern) {
  const wanted = COMPLEMENTARY_PATTERNS[mainPattern] ?? ['core']
  return library
    .filter(
      (ex) =>
        (ex.category === 'accessory' || ex.category === 'mobility') &&
        wanted.includes(ex.movementPattern as MovementPattern)
    )
    .sort((a, b) => {
      const rank =
        wanted.indexOf(a.movementPattern as MovementPattern) -
        wanted.indexOf(b.movementPattern as MovementPattern)
      return rank !== 0 ? rank : a.name.localeCompare(b.name)
    })
}

/**
 * Deterministic rotation: week N takes a different slice of the pool than week
 * N-1, so an 8-week cycle stays varied without any randomness. Re-generating
 * the same cycle always produces the same plan.
 */
function pickRotating<T>(pool: T[], count: number, week: number): T[] {
  if (pool.length === 0) return []
  const take = Math.min(count, pool.length)
  const offset = ((week - 1) * take) % pool.length
  return Array.from({ length: take }, (_, i) => pool[(offset + i) % pool.length])
}

const MAIN_LIFT_MUSCLES: Record<StrengthMovement, string[]> = {
  'Back Squat': ['quadriceps', 'glutes', 'core'],
  Deadlift: ['hamstrings', 'glutes', 'back', 'core'],
  'Bench Press': ['chest', 'triceps', 'shoulders'],
  'Overhead Press': ['shoulders', 'triceps', 'core'],
  'Barbell Row': ['back', 'biceps', 'rear_shoulders'],
}

const MAIN_LIFT_RISKS: Record<StrengthMovement, ContraindicationArea[]> = {
  'Back Squat': ['knee', 'lower_back'],
  Deadlift: ['lower_back'],
  'Bench Press': ['shoulder'],
  'Overhead Press': ['shoulder'],
  'Barbell Row': ['lower_back'],
}

function musclesOf(movement: StrengthMovement): string[] {
  return MAIN_LIFT_MUSCLES[movement] ?? []
}

function mainLiftIsRisky(movement: StrengthMovement, avoidAreas: ContraindicationArea[]): boolean {
  return MAIN_LIFT_RISKS[movement].some((area) => avoidAreas.includes(area))
}
