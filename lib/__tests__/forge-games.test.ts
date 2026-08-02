import { describe, expect, it } from 'vitest'
import { buildForgeGamesView, type ScoreRow } from '@/lib/forge-games'

const ROW = '500m Row' // lowerIsBetter
const BURPEES = 'Burpee Test (2 min)' // higherIsBetter

const score = (benchmarkName: string, scoreMonth: string, value: number): ScoreRow => ({
  benchmarkName,
  scoreMonth,
  value,
  notes: null,
})

const find = (view: ReturnType<typeof buildForgeGamesView>, name: string) => {
  const row = view.benchmarks.find((b) => b.name === name)
  if (!row) throw new Error(`benchmark ${name} missing from view`)
  return row
}

describe('buildForgeGamesView — per-benchmark comparison', () => {
  it('compares a benchmark against its own history, not the studio-wide latest month', () => {
    // The regression this guards: the Row was last tested in June, but another
    // benchmark was tested in August. Deriving the compared pair from the newest
    // months across all benchmarks left the Row with no delta at all.
    const view = buildForgeGamesView(
      [
        score(ROW, '2026-05', 120),
        score(ROW, '2026-06', 110),
        score(BURPEES, '2026-08', 60),
      ],
      '2026-08'
    )

    const row = find(view, ROW)
    expect(row.latest?.scoreMonth).toBe('2026-06')
    expect(row.previous?.scoreMonth).toBe('2026-05')
    // 120s -> 110s on a timed benchmark is progress, so the sign is flipped.
    expect(row.changePct).toBe(8.3)
    expect(row.direction).toBe('improved')
  })

  it('still reports no delta for a benchmark with a single score', () => {
    const view = buildForgeGamesView([score(BURPEES, '2026-08', 60)], '2026-08')

    const burpees = find(view, BURPEES)
    expect(burpees.previous).toBeNull()
    expect(burpees.changePct).toBeNull()
    expect(burpees.direction).toBeNull()
  })

  it('does not flip the sign for a benchmark where higher is better', () => {
    const view = buildForgeGamesView(
      [score(BURPEES, '2026-07', 50), score(BURPEES, '2026-08', 60)],
      '2026-08'
    )

    expect(find(view, BURPEES).changePct).toBe(20)
    expect(find(view, BURPEES).direction).toBe('improved')
  })

  it('marks a small change as unchanged rather than progress', () => {
    const view = buildForgeGamesView(
      [score(BURPEES, '2026-07', 1000), score(BURPEES, '2026-08', 1003)],
      '2026-08'
    )

    expect(find(view, BURPEES).direction).toBe('unchanged')
  })

  it('reads rows correctly regardless of the order they arrive in', () => {
    const view = buildForgeGamesView(
      [score(ROW, '2026-08', 100), score(ROW, '2026-06', 120), score(ROW, '2026-07', 110)],
      '2026-08'
    )

    const row = find(view, ROW)
    expect(row.history.map((h) => h.scoreMonth)).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(row.latest?.value).toBe(100)
    expect(row.previous?.value).toBe(110)
  })
})

describe('buildForgeGamesView — current month', () => {
  it('counts a score as current only inside the calendar month', () => {
    const view = buildForgeGamesView(
      [score(ROW, '2026-06', 110), score(BURPEES, '2026-08', 60)],
      '2026-08'
    )

    // The Row has a latest score, but it is not this month's.
    expect(find(view, ROW).latest).not.toBeNull()
    expect(find(view, ROW).current).toBeNull()
    expect(find(view, BURPEES).current?.value).toBe(60)

    // Drives the "x/5 logged" counter, so stale months must not inflate it.
    expect(view.benchmarks.filter((b) => b.current).length).toBe(1)
  })

  it('reports the calendar month even when nothing was logged in it', () => {
    const view = buildForgeGamesView([score(ROW, '2026-06', 110)], '2026-08')

    expect(view.currentMonth).toBe('2026-08')
    expect(view.benchmarks.every((b) => b.current === null)).toBe(true)
  })
})

describe('buildForgeGamesView — hasComparison', () => {
  it('is true once any single benchmark has two scores', () => {
    const view = buildForgeGamesView(
      [score(ROW, '2026-05', 120), score(ROW, '2026-06', 110)],
      '2026-08'
    )

    expect(view.hasComparison).toBe(true)
  })

  it('is false when every benchmark has at most one score', () => {
    const view = buildForgeGamesView(
      [score(ROW, '2026-08', 120), score(BURPEES, '2026-08', 60)],
      '2026-08'
    )

    expect(view.hasComparison).toBe(false)
  })
})

describe('buildForgeGamesView — best', () => {
  it('picks the lowest value for a timed benchmark', () => {
    const view = buildForgeGamesView(
      [score(ROW, '2026-06', 120), score(ROW, '2026-07', 105), score(ROW, '2026-08', 118)],
      '2026-08'
    )

    expect(find(view, ROW).best?.value).toBe(105)
  })

  it('picks the highest value for a counted benchmark', () => {
    const view = buildForgeGamesView(
      [score(BURPEES, '2026-07', 72), score(BURPEES, '2026-08', 61)],
      '2026-08'
    )

    expect(find(view, BURPEES).best?.value).toBe(72)
  })

  it('leaves best null when the benchmark has never been scored', () => {
    const view = buildForgeGamesView([], '2026-08')

    expect(view.benchmarks).toHaveLength(5)
    expect(view.benchmarks.every((b) => b.best === null)).toBe(true)
    expect(view.months).toEqual([])
  })
})
