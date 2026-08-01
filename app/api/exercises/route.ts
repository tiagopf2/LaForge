export const dynamic = 'force-dynamic'

import { route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { createExerciseSchema, exerciseQuerySchema } from '@/lib/validation'
import type { Prisma } from '@prisma/client'

/**
 * Module 6A — the coach's exercise library. Coach-owned CRUD; the program
 * generator only reads from it.
 */
export const GET = route(exerciseQuerySchema, async ({ input }) => {
  const where: Prisma.ExerciseWhereInput = {
    ...(input.includeInactive ? {} : { active: true }),
    ...(input.category ? { category: input.category } : {}),
    ...(input.movementPattern ? { movementPattern: input.movementPattern } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { primaryMuscles: { has: input.search.toLowerCase() } },
            { equipment: { has: input.search.toLowerCase() } },
          ],
        }
      : {}),
  }

  return prisma.exercise.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] })
})

export const POST = route(createExerciseSchema, async ({ input }) => {
  return prisma.exercise.create({ data: input })
})
