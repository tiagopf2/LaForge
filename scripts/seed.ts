import fs from 'fs'
import path from 'path'
import { PrismaClient, type Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Idempotent seed: upserts the coach account and imports the coach's exercise
 * library from data/exercise_library.csv. Safe to re-run — nothing is deleted,
 * and re-running refreshes library rows from the CSV.
 */

/**
 * The coach password comes from the environment, never from this file — the
 * repository is public and seed scripts get read by anyone.
 */
const COACH = {
  email: process.env.SEED_COACH_EMAIL ?? 'octavehesloin@laforge.local',
  name: process.env.SEED_COACH_NAME ?? 'OctaveHesloin',
  password: process.env.SEED_COACH_PASSWORD,
}

/** CSV exercise names that *are* one of the tracked movements/benchmarks. */
const TRACKED_ALIASES: Record<string, string> = {
  'Rowing (Erg)': '500m Row',
  'Bike Erg': '1km Bike Erg',
  Run: '400m Run',
  'Barbell Back Squat': 'Back Squat',
  Deadlift: 'Deadlift',
  'Barbell Bench Press': 'Bench Press',
  'Barbell Overhead Press': 'Overhead Press',
  'Barbell Row': 'Barbell Row',
}

const VALID_CATEGORIES = new Set(['compound', 'accessory', 'cardio', 'mobility', 'conditioning'])
const VALID_PATTERNS = new Set([
  'push', 'pull', 'hinge', 'squat', 'lunge', 'carry', 'core', 'rotation', 'cardio',
])
const VALID_DIFFICULTIES = new Set(['all', 'beginner', 'intermediate', 'advanced'])
const VALID_AREAS = new Set([
  'shoulder', 'elbow', 'wrist', 'lower_back', 'hip', 'knee', 'ankle', 'neck', 'adductor',
])

/** Minimal RFC-4180 reader: handles quoted fields containing commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows
  return body
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .map((cells) => Object.fromEntries(header.map((key, i) => [key.trim(), (cells[i] ?? '').trim()])))
}

const list = (value: string) =>
  value
    .split(';')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)

async function seedCoach() {
  const existing = await prisma.user.findUnique({ where: { email: COACH.email } })

  // An account that already exists keeps its current password, so re-seeding to
  // refresh the exercise library never needs the secret to be present.
  if (existing) {
    console.log(`Coach account already present: ${existing.name}`)
    return
  }

  if (!COACH.password) {
    console.warn(
      'SEED_COACH_PASSWORD is not set — skipping coach account creation.\n' +
        'Add it to .env (see .env.example) and re-run to create the login.'
    )
    return
  }

  const hashedPassword = await bcrypt.hash(COACH.password, 12)
  await prisma.user.create({
    data: {
      email: COACH.email,
      name: COACH.name,
      hashedPassword,
      role: 'coach',
    },
  })
  console.log(`Coach account created: ${COACH.name}`)
}

async function seedExerciseLibrary() {
  const csvPath = path.resolve(process.cwd(), 'data/exercise_library.csv')
  if (!fs.existsSync(csvPath)) {
    console.warn('No data/exercise_library.csv found — skipping exercise import.')
    return
  }

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'))
  const skipped: string[] = []
  let imported = 0

  for (const row of rows) {
    const name = row.name?.trim()
    const category = row.category?.trim().toLowerCase()
    const movementPattern = row.movement_pattern?.trim().toLowerCase()
    const difficulty = (row.difficulty?.trim().toLowerCase() || 'all')

    if (!name || !VALID_CATEGORIES.has(category) || !VALID_PATTERNS.has(movementPattern)) {
      skipped.push(name || '(unnamed row)')
      continue
    }

    const data = {
      category: category as Prisma.ExerciseCreateInput['category'],
      primaryMuscles: list(row.primary_muscles ?? ''),
      secondaryMuscles: list(row.secondary_muscles ?? ''),
      movementPattern: movementPattern as Prisma.ExerciseCreateInput['movementPattern'],
      difficulty: (VALID_DIFFICULTIES.has(difficulty)
        ? difficulty
        : 'all') as Prisma.ExerciseCreateInput['difficulty'],
      equipment: list(row.equipment ?? ''),
      contraindications: list(row.contraindication_tags ?? '').filter((c) => VALID_AREAS.has(c)),
      loadingScheme: row.loading_scheme || null,
      coachNotes: row.coach_notes || null,
      trackedMovement: row.is_tracked === 'yes' ? (TRACKED_ALIASES[name] ?? null) : null,
      tier: row.tier === 'advanced' ? 'advanced' : 'studio',
      active: row.active !== 'no',
    }

    await prisma.exercise.upsert({
      where: { name },
      update: data,
      create: { name, ...data },
    })
    imported += 1
  }

  console.log(`Exercise library: ${imported} exercises imported/refreshed.`)
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} row(s) with an unknown category or pattern: ${skipped.join(', ')}`)
  }
}

async function main() {
  await seedCoach()
  await seedExerciseLibrary()
  console.log('Seed completed successfully.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
