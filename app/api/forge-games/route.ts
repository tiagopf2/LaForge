export const dynamic = 'force-dynamic'

import { badRequest, notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { FORGE_GAMES_BENCHMARKS, getBenchmark, monthKey, shiftMonth } from '@/lib/forge'
import { createForgeScoreSchema, forgeGamesQuerySchema } from '@/lib/validation'

/**
 * Module 4 — Monthly Forge Games.
 *
 * The point of this module is the comparison, so the read endpoint returns the
 * last N months already lined up per benchmark with the month-over-month delta
 * computed server-side (direction depends on whether lower is better).
 */
export const GET = route(forgeGamesQuerySchema, async ({ input }) => {
  const earliest = shiftMonth(monthKey(), -(input.months - 1))

  const scores = await prisma.forgeGameScore.findMany({
    where: { memberId: input.memberId, scoreMonth: { gte: earliest } },
    orderBy: [{ scoreMonth: 'asc' }, { benchmarkName: 'asc' }],
  })

  const months = [...new Set(scores.map((s) => s.scoreMonth))].sort()
  const currentMonth = months[months.length - 1] ?? monthKey()
  const previousMonth = months[months.length - 2] ?? null

  const benchmarks = FORGE_GAMES_BENCHMARKS.map((benchmark) => {
    const history = scores
      .filter((s) => s.benchmarkName === benchmark.name)
      .map((s) => ({ scoreMonth: s.scoreMonth, value: s.value, notes: s.notes }))

    const current = history.find((h) => h.scoreMonth === currentMonth) ?? null
    const previous = previousMonth
      ? (history.find((h) => h.scoreMonth === previousMonth) ?? null)
      : null

    let changePct: number | null = null
    let direction: 'improved' | 'regressed' | 'unchanged' | null = null

    if (current && previous && previous.value !== 0) {
      const raw = ((current.value - previous.value) / previous.value) * 100
      // Flip timed benchmarks so a positive number always means progress.
      changePct = Math.round((benchmark.lowerIsBetter ? -raw : raw) * 10) / 10
      direction = changePct > 0.5 ? 'improved' : changePct < -0.5 ? 'regressed' : 'unchanged'
    }

    const best = history.length
      ? history.reduce((acc, h) =>
          benchmark.lowerIsBetter
            ? h.value < acc.value
              ? h
              : acc
            : h.value > acc.value
              ? h
              : acc
        )
      : null

    return {
      name: benchmark.name,
      unit: benchmark.unit,
      lowerIsBetter: benchmark.lowerIsBetter,
      history,
      current,
      previous,
      best,
      changePct,
      direction,
    }
  })

  return { months, currentMonth, previousMonth, benchmarks }
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
