export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { buildInsights } from '@/lib/insights'

/**
 * Module 5 — strengths, areas for improvement and data-based recommendations
 * for one member, computed from stored results only.
 */
export const GET = route(z.object({ memberId: z.string().min(1) }), async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: {
      id: true,
      firstName: true,
      performanceRecords: {
        orderBy: { recordedAt: 'desc' },
        take: 300,
        select: {
          movementName: true,
          movementType: true,
          value: true,
          reps: true,
          sets: true,
          phase: true,
          recordedAt: true,
        },
      },
      forgeGameScores: {
        orderBy: { scoreMonth: 'asc' },
        select: { benchmarkName: true, value: true, scoreMonth: true },
      },
      assessments: {
        orderBy: { assessedAt: 'desc' },
        take: 1,
        select: { restrictionTags: true },
      },
    },
  })

  if (!member) throw notFound('Member not found')

  return buildInsights({
    records: member.performanceRecords,
    scores: member.forgeGameScores,
    restrictionTags: member.assessments[0]?.restrictionTags ?? [],
    hasAssessment: member.assessments.length > 0,
  })
})
