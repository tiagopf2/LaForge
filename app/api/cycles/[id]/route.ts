export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { updateCycleSchema } from '@/lib/validation'

/**
 * The coach-validation step from the brief: a cycle only becomes assignable
 * once the coach marks it validated, and they can attach notes or an edited
 * plan at the same time.
 */
export const PATCH = route(updateCycleSchema, async ({ input }) => {
  const { id, status, ...rest } = input

  const cycle = await prisma.trainingCycle.findUnique({ where: { id }, select: { id: true } })
  if (!cycle) throw notFound('Cycle not found')

  return prisma.trainingCycle.update({
    where: { id },
    data: {
      ...rest,
      ...(status ? { status } : {}),
      ...(status === 'validated' ? { validatedAt: new Date() } : {}),
    },
  })
})
