export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { performanceIdSchema } from '@/lib/validation'

/**
 * Removes one logged result outright.
 *
 * The exercise library soft-deletes because it is the studio's accumulated
 * knowledge and generated programs reference it. A performance record is the
 * opposite: it is a single measurement, and a mistyped one is not history worth
 * keeping. Left in place it would keep skewing the progress chart and the
 * next-session suggestion, which read every row for the movement.
 */
export const DELETE = route(performanceIdSchema, async ({ input }) => {
  const record = await prisma.performanceRecord.findUnique({
    where: { id: input.id },
    select: { id: true },
  })
  if (!record) throw notFound('Result not found')

  await prisma.performanceRecord.delete({ where: { id: input.id } })
  return { ok: true }
})
