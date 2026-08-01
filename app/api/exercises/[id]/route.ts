export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { exerciseIdSchema, updateExerciseSchema } from '@/lib/validation'

export const PATCH = route(updateExerciseSchema, async ({ input }) => {
  const { id, ...data } = input
  const exists = await prisma.exercise.findUnique({ where: { id }, select: { id: true } })
  if (!exists) throw notFound('Exercise not found')

  return prisma.exercise.update({ where: { id }, data })
})

/**
 * Soft delete. Programs already generated reference exercises by name, and the
 * coach's own library is the studio's accumulated knowledge — nothing here
 * removes a row outright.
 */
export const DELETE = route(exerciseIdSchema, async ({ input }) => {
  const exists = await prisma.exercise.findUnique({
    where: { id: input.id },
    select: { id: true },
  })
  if (!exists) throw notFound('Exercise not found')

  return prisma.exercise.update({ where: { id: input.id }, data: { active: false } })
})
