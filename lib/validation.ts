import { z } from 'zod'
import {
  CONTRAINDICATION_AREAS,
  DIFFICULTIES,
  EXERCISE_CATEGORIES,
  FORGE_GAMES_BENCHMARKS,
  MEMBER_LEVELS,
  MOVEMENT_PATTERNS,
  SESSION_TYPES,
  STRENGTH_MOVEMENTS,
  CARDIO_BENCHMARKS,
} from '@/lib/forge'

const id = z.string().min(1, 'required')
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))

const stringList = z.array(z.string().trim().min(1).max(200)).max(50).default([])

const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must look like 2026-07')

/** Members ------------------------------------------------------------- */

export const createMemberSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
  phone: optionalText,
  dateOfBirth: z.coerce.date().optional().nullable(),
  notes: optionalText,
})

export const updateMemberSchema = createMemberSchema.partial().extend({
  id,
  active: z.boolean().optional(),
})

export const memberIdSchema = z.object({ id })

/** Assessments --------------------------------------------------------- */

const mobilityRating = z.enum(['good', 'normal', 'limited']).optional().nullable()

export const createAssessmentSchema = z.object({
  memberId: id,
  shoulderMobilityLeft: mobilityRating,
  shoulderMobilityRight: mobilityRating,
  shoulderNotes: optionalText,
  hipMobilityLeft: mobilityRating,
  hipMobilityRight: mobilityRating,
  hipNotes: optionalText,
  ankleMobilityLeft: mobilityRating,
  ankleMobilityRight: mobilityRating,
  ankleNotes: optionalText,
  thoracicMobility: z.enum(['good', 'normal', 'limited', 'stiff']).optional().nullable(),
  thoracicNotes: optionalText,
  strengthAsymmetries: optionalText,
  weakPoints: stringList,
  cardioLevel: z.enum(MEMBER_LEVELS).optional().nullable(),
  trainingLevel: z.enum(MEMBER_LEVELS).default('beginner'),
  injuryHistory: stringList,
  areasToAvoid: stringList,
  sportsBackground: optionalText,
  goals: stringList,
  constraints: optionalText,
})

/** Performance (Module 3) ---------------------------------------------- */

const trackedMovement = z.enum([...STRENGTH_MOVEMENTS, ...CARDIO_BENCHMARKS] as [
  string,
  ...string[],
])

export const createPerformanceSchema = z
  .object({
    memberId: id,
    movementName: trackedMovement,
    phase: z.enum(['calibration', 'progression']).default('progression'),
    value: z.coerce.number().positive('Must be greater than 0').max(1000),
    reps: z.coerce.number().int().min(1).max(100).optional().nullable(),
    sets: z.coerce.number().int().min(1).max(20).optional().nullable(),
    rpe: z.coerce.number().min(1).max(10).optional().nullable(),
    notes: optionalText,
    cycleId: id.optional().nullable(),
    recordedAt: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    const isStrength = (STRENGTH_MOVEMENTS as readonly string[]).includes(data.movementName)
    if (isStrength && (data.reps == null || data.sets == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sets and reps are required for the tracked lifts',
        path: ['reps'],
      })
    }
  })

export const performanceQuerySchema = z.object({
  memberId: id.optional(),
  movementName: z.string().optional(),
})

export const suggestQuerySchema = z.object({ memberId: id })

/** Flow sessions ------------------------------------------------------- */

export const createSessionLogSchema = z.object({
  memberId: id,
  sessionType: z.enum(SESSION_TYPES),
  flowSession: z.coerce.boolean().default(true),
  notes: optionalText,
  sessionDate: z.coerce.date().optional(),
})

/** Warm-up (Module 2) -------------------------------------------------- */

export const generateWarmupSchema = z.object({
  memberId: id,
  sessionType: z.enum(SESSION_TYPES),
  generalWarmup: optionalText,
})

/** Forge Games (Module 4) ---------------------------------------------- */

export const createForgeScoreSchema = z.object({
  memberId: id,
  benchmarkName: z.enum(
    FORGE_GAMES_BENCHMARKS.map((b) => b.name) as unknown as [string, ...string[]]
  ),
  value: z.coerce.number().positive('Must be greater than 0').max(10000),
  scoreMonth: monthKeySchema,
  notes: optionalText,
  recordedAt: z.coerce.date().optional(),
})

export const forgeGamesQuerySchema = z.object({
  memberId: id,
  months: z.coerce.number().int().min(2).max(24).default(6),
})

/** Program generator (Module 6B) --------------------------------------- */

export const generateProgramSchema = z.object({
  memberId: id,
  goal: z.string().trim().min(1, 'Pick a goal').max(60),
  sessionType: z.enum(SESSION_TYPES),
  cycleLength: z.coerce.number().int().min(4, 'Minimum 4 weeks').max(8, 'Maximum 8 weeks'),
  level: z.enum(MEMBER_LEVELS).optional(),
  mainMovement: z.enum(STRENGTH_MOVEMENTS).optional(),
})

export const updateCycleSchema = z.object({
  id,
  status: z.enum(['draft', 'validated', 'archived']).optional(),
  coachNotes: optionalText,
  planJson: z.string().max(200_000).optional(),
})

/** Exercise library (Module 6A) ---------------------------------------- */

const contraindicationList = z.array(z.enum(CONTRAINDICATION_AREAS)).max(20).default([])

export const createExerciseSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  category: z.enum(EXERCISE_CATEGORIES),
  primaryMuscles: stringList,
  secondaryMuscles: stringList,
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  difficulty: z.enum(DIFFICULTIES).default('all'),
  equipment: stringList,
  contraindications: contraindicationList,
  loadingScheme: optionalText,
  coachNotes: optionalText,
  trackedMovement: optionalText,
  tier: z.enum(['studio', 'advanced']).default('studio'),
  active: z.boolean().default(true),
})

export const updateExerciseSchema = createExerciseSchema.partial().extend({ id })

export const exerciseQuerySchema = z.object({
  category: z.enum(EXERCISE_CATEGORIES).optional(),
  movementPattern: z.enum(MOVEMENT_PATTERNS).optional(),
  search: z.string().trim().max(120).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export const exerciseIdSchema = z.object({ id })
