export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { createSessionLogSchema } from '@/lib/validation'

/**
 * Module 3 — "flow" sessions.
 *
 * The brief requires a session to be recorded as done without forcing any
 * numbers in. Everything except member and session type is optional.
 */
export const POST = route(createSessionLogSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true },
  })
  if (!member) throw notFound('Member not found')

  return prisma.sessionLog.create({
    data: {
      memberId: input.memberId,
      sessionType: input.sessionType,
      flowSession: input.flowSession,
      notes: input.notes,
      sessionDate: input.sessionDate ?? new Date(),
    },
  })
})

export const GET = route(z.object({ memberId: z.string().min(1) }), async ({ input }) => {
  return prisma.sessionLog.findMany({
    where: { memberId: input.memberId },
    orderBy: { sessionDate: 'desc' },
    take: 50,
  })
})
