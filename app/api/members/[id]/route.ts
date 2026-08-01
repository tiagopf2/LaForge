export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { memberIdSchema, updateMemberSchema } from '@/lib/validation'

export const GET = route(memberIdSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.id },
    include: {
      assessments: { orderBy: { assessedAt: 'desc' } },
      performanceRecords: { orderBy: { recordedAt: 'desc' }, take: 200 },
      warmupSessions: { orderBy: { generatedAt: 'desc' }, take: 10 },
      sessionLogs: { orderBy: { sessionDate: 'desc' }, take: 20 },
      forgeGameScores: { orderBy: [{ scoreMonth: 'desc' }, { benchmarkName: 'asc' }], take: 60 },
      trainingCycles: { orderBy: { createdAt: 'desc' }, take: 8 },
    },
  })

  if (!member) throw notFound('Member not found')
  return member
})

export const PATCH = route(updateMemberSchema, async ({ input }) => {
  const { id, ...data } = input
  const exists = await prisma.member.findUnique({ where: { id }, select: { id: true } })
  if (!exists) throw notFound('Member not found')

  return prisma.member.update({ where: { id }, data })
})
