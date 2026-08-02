export const dynamic = 'force-dynamic'

import { badRequest, notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { getBenchmark, monthKey, shiftMonth } from '@/lib/forge'
import { buildForgeGamesView } from '@/lib/forge-games'
import { createForgeScoreSchema, forgeGamesQuerySchema } from '@/lib/validation'

/**
 * Module 4 — Monthly Forge Games.
 *
 * The point of this module is the comparison, so the read endpoint returns the
 * last N months already lined up per benchmark with the month-over-month delta
 * computed server-side (direction depends on whether lower is better).
 */
export const GET = route(forgeGamesQuerySchema, async ({ input }) => {
  // The real calendar month, not "the newest month with any score on file" —
  // otherwise a stale month gets labelled as the current one all through the
  // next month, and the "logged this month" count comes out wrong.
  const currentMonth = monthKey()
  const earliest = shiftMonth(currentMonth, -(input.months - 1))

  const scores = await prisma.forgeGameScore.findMany({
    where: { memberId: input.memberId, scoreMonth: { gte: earliest } },
    orderBy: [{ scoreMonth: 'asc' }, { benchmarkName: 'asc' }],
    select: { benchmarkName: true, scoreMonth: true, value: true, notes: true },
  })

  return buildForgeGamesView(scores, currentMonth)
})

export const POST = route(createForgeScoreSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true },
  })
  if (!member) throw notFound('Member not found')

  const benchmark = getBenchmark(input.benchmarkName)
  if (!benchmark) throw badRequest('Unknown benchmark')

  // A month holds one score per benchmark: re-testing corrects it in place
  // rather than leaving two conflicting numbers in the comparison.
  return prisma.forgeGameScore.upsert({
    where: {
      memberId_benchmarkName_scoreMonth: {
        memberId: input.memberId,
        benchmarkName: input.benchmarkName,
        scoreMonth: input.scoreMonth,
      },
    },
    update: {
      value: input.value,
      notes: input.notes,
      recordedAt: input.recordedAt ?? new Date(),
    },
    create: {
      memberId: input.memberId,
      benchmarkName: input.benchmarkName,
      value: input.value,
      unit: benchmark.unit,
      scoreMonth: input.scoreMonth,
      notes: input.notes,
      recordedAt: input.recordedAt ?? new Date(),
    },
  })
})
