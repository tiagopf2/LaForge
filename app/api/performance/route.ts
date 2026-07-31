export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { isStrengthMovement } from '@/lib/forge'
import { createPerformanceSchema, performanceQuerySchema } from '@/lib/validation'

export const GET = route(performanceQuerySchema, async ({ input }) => {
  return prisma.performanceRecord.findMany({
    where: {
      ...(input.memberId ? { memberId: input.memberId } : {}),
      ...(input.movementName ? { movementName: input.movementName } : {}),
    },
    orderBy: { recordedAt: 'desc' },
    take: 200,
    include: { member: { select: { firstName: true, lastName: true } } },
  })
})

export const POST = route(createPerformanceSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true },
  })
  if (!member) throw notFound('Member not found')

  const strength = isStrengthMovement(input.movementName)

  return prisma.performanceRecord.create({
    data: {
      memberId: input.memberId,
      movementType: strength ? 'strength' : 'cardio',
      movementName: input.movementName,
      // Cardio benchmarks have no calibration phase.
      phase: strength ? input.phase : 'progression',
      value: input.value,
      unit: strength ? 'kg' : 'seconds',
      reps: strength ? (input.reps ?? null) : null,
      sets: strength ? (input.sets ?? null) : null,
      rpe: strength ? (input.rpe ?? null) : null,
      notes: input.notes,
      cycleId: input.cycleId ?? null,
      recordedAt: input.recordedAt ?? new Date(),
    },
  })
})
