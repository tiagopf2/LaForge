export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { createMemberSchema } from '@/lib/validation'

export const GET = route(z.object({}), async () => {
  // The member picker is on nearly every screen, so this stays deliberately
  // slim: no full assessment payloads, just what the list renders.
  const members = await prisma.member.findMany({
    orderBy: [{ active: 'desc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      active: true,
      joinDate: true,
      assessments: {
        orderBy: { assessedAt: 'desc' },
        take: 1,
        select: { id: true, assessedAt: true, trainingLevel: true, restrictionTags: true },
      },
      _count: { select: { performanceRecords: true } },
    },
  })

  return members
})

export const POST = route(createMemberSchema, async ({ input }) => {
  return prisma.member.create({ data: input })
})
