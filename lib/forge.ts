/**
 * La Forge domain vocabulary.
 *
 * Everything the brief calls "non-negotiable" lives here: the five tracked
 * compound lifts, the three cardio benchmarks, the monthly Forge Games
 * benchmarks, and the shared tag vocabularies that let assessments, warm-ups
 * and the program generator talk to each other.
 */

export const STRENGTH_MOVEMENTS = [
  'Back Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
] as const

export const CARDIO_BENCHMARKS = ['500m Row', '1km Bike Erg', '400m Run'] as const

export type StrengthMovement = (typeof STRENGTH_MOVEMENTS)[number]
export type CardioBenchmark = (typeof CARDIO_BENCHMARKS)[number]

export const TRACKED_MOVEMENTS = [...STRENGTH_MOVEMENTS, ...CARDIO_BENCHMARKS] as const

export function isStrengthMovement(name: string): name is StrengthMovement {
  return (STRENGTH_MOVEMENTS as readonly string[]).includes(name)
}

export function isCardioBenchmark(name: string): name is CardioBenchmark {
  return (CARDIO_BENCHMARKS as readonly string[]).includes(name)
}

/**
 * Module 4 — the same five benchmarks every month.
 * `lowerIsBetter` drives month-over-month comparison: a faster row is an
 * improvement, more burpees is an improvement.
 */
export const FORGE_GAMES_BENCHMARKS = [
  { name: '500m Row', unit: 'seconds', lowerIsBetter: true },
  { name: '1km Bike Erg', unit: 'seconds', lowerIsBetter: true },
  { name: '400m Run', unit: 'seconds', lowerIsBetter: true },
  { name: 'Burpee Test (2 min)', unit: 'reps', lowerIsBetter: false },
  { name: 'Plank Hold', unit: 'seconds', lowerIsBetter: false },
] as const

export type ForgeGamesBenchmark = (typeof FORGE_GAMES_BENCHMARKS)[number]['name']

export function getBenchmark(name: string) {
  return FORGE_GAMES_BENCHMARKS.find((b) => b.name === name)
}

export const SESSION_TYPES = ['upper', 'lower', 'full', 'conditioning'] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  upper: 'Upper Body',
  lower: 'Lower Body',
  full: 'Full Body',
  conditioning: 'Conditioning',
}

export const MEMBER_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type MemberLevel = (typeof MEMBER_LEVELS)[number]

export const GOALS = [
  'Strength',
  'Fat Loss',
  'Conditioning',
  'Performance',
  'General Fitness',
  'Muscle Gain',
  'Flexibility',
] as const

/** Module 6 exercise-library vocabularies. */
export const EXERCISE_CATEGORIES = [
  'compound',
  'accessory',
  'cardio',
  'mobility',
  'conditioning',
] as const
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number]

export const MOVEMENT_PATTERNS = [
  'push',
  'pull',
  'hinge',
  'squat',
  'lunge',
  'carry',
  'core',
  'rotation',
  'cardio',
] as const
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

export const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/**
 * Body areas a member can be told to avoid. Assessment free text is normalised
 * into these, and exercise/drill contraindications are expressed with the same
 * words so filtering is a plain set intersection.
 */
export const CONTRAINDICATION_AREAS = [
  'shoulder',
  'elbow',
  'wrist',
  'lower_back',
  'hip',
  'knee',
  'ankle',
  'neck',
  'adductor',
] as const
export type ContraindicationArea = (typeof CONTRAINDICATION_AREAS)[number]

/**
 * Words a coach actually types in the "areas to avoid" / injury fields, mapped
 * to the canonical area. Order matters: longer, more specific phrases first.
 */
const AREA_SYNONYMS: Array<[ContraindicationArea, string[]]> = [
  ['lower_back', ['lower back', 'low back', 'lumbar', 'l4', 'l5', 'disc', 'sciatic', 'hernia']],
  ['shoulder', ['shoulder', 'rotator', 'cuff', 'ac joint', 'impingement', 'labrum', 'epaule']],
  ['elbow', ['elbow', 'tricep tendon', 'tennis elbow', 'coude']],
  ['wrist', ['wrist', 'carpal', 'poignet']],
  ['hip', ['hip', 'glute med', 'piriformis', 'hanche']],
  ['knee', ['knee', 'acl', 'mcl', 'meniscus', 'patell', 'genou']],
  ['ankle', ['ankle', 'achilles', 'calf strain', 'cheville']],
  ['neck', ['neck', 'cervical', 'nuque']],
  ['adductor', ['adductor', 'groin', 'adducteur']],
]

/** Normalises free-text injury notes into canonical contraindication areas. */
export function toContraindicationAreas(values: string[]): ContraindicationArea[] {
  const haystack = values.join(' ').toLowerCase()
  const found = AREA_SYNONYMS.filter(([, words]) => words.some((w) => haystack.includes(w))).map(
    ([area]) => area
  )
  return [...new Set(found)]
}

/**
 * Mobility/activation needs produced by an assessment and consumed by the
 * warm-up selector. Keep this in sync with the drill library tags.
 */
export const RESTRICTION_TAGS = [
  'shoulder_mobility_limited',
  'overhead_restriction',
  'thoracic_stiffness',
  'posture_correction',
  'tight_hips',
  'hip_internal_rotation_limited',
  'glute_activation_needed',
  'asymmetry_shoulder',
  'asymmetry_hip',
  'asymmetry_ankle',
  'ankle_dorsiflexion_limited',
  'calf_tightness',
  'core_stability_needed',
  'lumbar_control_needed',
] as const
export type RestrictionTag = (typeof RESTRICTION_TAGS)[number]

/**
 * Brief, Module 6: "add reps before adding weight", then increase load. Lower
 * body lifts move in 5 kg steps, upper body in 2.5 kg — the smallest jump most
 * studios can plate.
 */
export function getStrengthIncrement(movementName: string): number {
  return movementName === 'Back Squat' || movementName === 'Deadlift' ? 5 : 2.5
}

/** Rounds to the nearest 0.5 kg so the number matches real plate maths. */
export function roundLoad(kg: number): number {
  return Math.round(kg * 2) / 2
}

export function monthKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** "2026-07" -> "July 2026", for headings a non-analyst can read at a glance. */
export function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

/** Shifts a "YYYY-MM" key by `delta` months. */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + delta, 1))
}

/** Seconds -> "1:52" for row/bike/run benchmarks. */
export function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.round(total))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Studio capacity ceiling from the brief. */
export const MAX_MEMBERS = 160
