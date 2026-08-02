import { FORGE_GAMES_BENCHMARKS } from '@/lib/forge'

/**
 * Module 4 — shaping stored Forge Games scores into the month-over-month view.
 *
 * Kept out of the route handler for the same reason as `lib/insights.ts`: the
 * comparison rules are domain logic and deserve tests that do not need a
 * database.
 */

export type ScoreRow = {
  benchmarkName: string
  scoreMonth: string
  value: number
  notes: string | null
}

export type ScorePoint = { scoreMonth: string; value: number; notes: string | null }

export type BenchmarkView = {
  name: string
  unit: string
  lowerIsBetter: boolean
  history: ScorePoint[]
  /** Scored in `currentMonth`, or null when not tested yet this month. */
  current: ScorePoint | null
  /** Most recent score whenever it happened — what the delta measures from. */
  latest: ScorePoint | null
  previous: ScorePoint | null
  best: ScorePoint | null
  changePct: number | null
  direction: 'improved' | 'regressed' | 'unchanged' | null
}

export type ForgeGamesView = {
  months: string[]
  currentMonth: string
  hasComparison: boolean
  benchmarks: BenchmarkView[]
}

/** Below this, a change is noise rather than progress. */
const SIGNIFICANT_PCT = 0.5

export function buildForgeGamesView(scores: ScoreRow[], currentMonth: string): ForgeGamesView {
  // Callers may pass rows in any order; every rule below assumes ascending months.
  const ordered = [...scores].sort((a, b) => a.scoreMonth.localeCompare(b.scoreMonth))
  const months = [...new Set(ordered.map((s) => s.scoreMonth))].sort()

  const benchmarks = FORGE_GAMES_BENCHMARKS.map<BenchmarkView>((benchmark) => {
    const history: ScorePoint[] = ordered
      .filter((s) => s.benchmarkName === benchmark.name)
      .map((s) => ({ scoreMonth: s.scoreMonth, value: s.value, notes: s.notes }))

    // This benchmark's own most recent pair. Deriving the pair from the months
    // that *all* benchmarks share would silently drop the delta for anything
    // not tested on the studio's latest test date — which is the whole point
    // of the module.
    const latest = history[history.length - 1] ?? null
    const previous = history[history.length - 2] ?? null

    // `current` stays strictly "scored in the calendar month": it drives the
    // "x/5 logged" counter, which must not count a score from three months ago.
    const current = latest && latest.scoreMonth === currentMonth ? latest : null

    let changePct: number | null = null
    let direction: BenchmarkView['direction'] = null

    if (latest && previous && previous.value !== 0) {
      const raw = ((latest.value - previous.value) / previous.value) * 100
      // Flip timed benchmarks so a positive number always means progress.
      changePct = Math.round((benchmark.lowerIsBetter ? -raw : raw) * 10) / 10
      direction =
        changePct > SIGNIFICANT_PCT
          ? 'improved'
          : changePct < -SIGNIFICANT_PCT
            ? 'regressed'
            : 'unchanged'
    }

    const best = history.length
      ? history.reduce((acc, h) =>
          benchmark.lowerIsBetter ? (h.value < acc.value ? h : acc) : h.value > acc.value ? h : acc
        )
      : null

    return {
      name: benchmark.name,
      unit: benchmark.unit,
      lowerIsBetter: benchmark.lowerIsBetter,
      history,
      current,
      latest,
      previous,
      best,
      changePct,
      direction,
    }
  })

  return {
    months,
    currentMonth,
    // A comparison exists as soon as any single benchmark has two scores; it no
    // longer requires the member to have two fully-tested months.
    hasComparison: benchmarks.some((b) => b.previous !== null),
    benchmarks,
  }
}
