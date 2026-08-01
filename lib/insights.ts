import {
  CARDIO_BENCHMARKS,
  STRENGTH_MOVEMENTS,
  formatMonth,
  formatSeconds,
  getBenchmark,
  isCardioBenchmark,
} from '@/lib/forge'

/**
 * Module 5 — the "strengths, areas for improvement, data-based
 * recommendations" the brief asks for, phrased for someone who is not a data
 * analyst. Every line is derived from stored results; nothing is guessed.
 */

export type InsightRecord = {
  movementName: string
  movementType: 'strength' | 'cardio'
  value: number
  reps: number | null
  sets: number | null
  phase: 'calibration' | 'progression'
  recordedAt: Date | string
}

export type InsightScore = {
  benchmarkName: string
  value: number
  scoreMonth: string
}

export type Insights = {
  strengths: string[]
  improvements: string[]
  recommendations: string[]
  movementSummaries: MovementSummary[]
}

export type MovementSummary = {
  movementName: string
  sessions: number
  first: number | null
  latest: number | null
  changePct: number | null
  direction: 'up' | 'down' | 'flat' | 'none'
  display: string
}

const DAY = 24 * 60 * 60 * 1000
/** A tracked lift untouched for this long counts as neglected, not plateaued. */
const STALE_DAYS = 28

export function buildInsights({
  records,
  scores,
  restrictionTags = [],
  hasAssessment,
}: {
  records: InsightRecord[]
  scores: InsightScore[]
  restrictionTags?: string[]
  hasAssessment: boolean
}): Insights {
  const strengths: string[] = []
  const improvements: string[] = []
  const recommendations: string[] = []

  const summaries = summariseMovements(records)
  const now = Date.now()

  // --- Strength lifts -------------------------------------------------
  const withProgress = summaries.filter((s) => s.changePct != null && s.sessions >= 2)

  for (const summary of withProgress) {
    if (summary.direction === 'up') {
      strengths.push(`${summary.movementName} is up ${summary.display} since the first logged session.`)
    } else if (summary.direction === 'down') {
      improvements.push(`${summary.movementName} has slipped ${summary.display}. Review technique and recovery before adding load.`)
    } else {
      improvements.push(`${summary.movementName} has been flat across ${summary.sessions} sessions — a plateau.`)
      recommendations.push(`Break the ${summary.movementName} plateau: hold the load and chase 3 clean sets of 5 before touching the weight again.`)
    }
  }

  // --- Coverage gaps --------------------------------------------------
  const logged = new Set(records.map((r) => r.movementName))

  const neverLogged = STRENGTH_MOVEMENTS.filter((m) => !logged.has(m))
  if (neverLogged.length > 0) {
    improvements.push(`No data yet for ${listOf(neverLogged)}.`)
    recommendations.push(`Run a calibration set on ${listOf(neverLogged)} to get a reference weight on file.`)
  }

  const missingCardio = CARDIO_BENCHMARKS.filter((m) => !logged.has(m))
  if (missingCardio.length > 0 && missingCardio.length < CARDIO_BENCHMARKS.length) {
    recommendations.push(`Add a baseline for ${listOf(missingCardio)} to complete the cardio picture.`)
  }

  const stale = summaries.filter((s) => {
    const last = records
      .filter((r) => r.movementName === s.movementName)
      .reduce((max, r) => Math.max(max, new Date(r.recordedAt).getTime()), 0)
    return last > 0 && now - last > STALE_DAYS * DAY
  })
  if (stale.length > 0) {
    improvements.push(`${listOf(stale.map((s) => s.movementName))} not trained in over ${STALE_DAYS} days.`)
  }

  // --- Monthly Forge Games -------------------------------------------
  const forge = compareForgeGames(scores)
  for (const line of forge.improved) strengths.push(line)
  for (const line of forge.regressed) improvements.push(line)
  if (forge.note) recommendations.push(forge.note)

  // --- Assessment-driven ----------------------------------------------
  if (!hasAssessment) {
    improvements.push('No body assessment on file, so warm-ups and programs cannot be personalised.')
    recommendations.push('Run the Module 1 intake assessment — every other module depends on it.')
  } else if (restrictionTags.length > 0) {
    const top = restrictionTags.slice(0, 3).map(humanTag)
    improvements.push(`Assessment flags: ${listOf(top)}.`)
    recommendations.push(`Keep the personalised warm-up in every session — it is what addresses ${listOf(top)}.`)
  }

  if (strengths.length === 0) {
    strengths.push('Not enough history yet. Log a few sessions and the wins will show up here.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Everything on track — keep following the current progression.')
  }

  return { strengths, improvements, recommendations, movementSummaries: summaries }
}

function summariseMovements(records: InsightRecord[]): MovementSummary[] {
  const byMovement = new Map<string, InsightRecord[]>()
  for (const record of records) {
    const list = byMovement.get(record.movementName) ?? []
    list.push(record)
    byMovement.set(record.movementName, list)
  }

  return [...byMovement.entries()].map(([movementName, list]) => {
    const ordered = [...list].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    )
    const first = ordered[0]?.value ?? null
    const latest = ordered[ordered.length - 1]?.value ?? null

    if (first == null || latest == null || ordered.length < 2 || first === 0) {
      return {
        movementName,
        sessions: ordered.length,
        first,
        latest,
        changePct: null,
        direction: 'none' as const,
        display: '—',
      }
    }

    const rawPct = ((latest - first) / first) * 100
    // For timed benchmarks a smaller number is better, so flip the sign to
    // make "up" always mean "better".
    const changePct = isCardioBenchmark(movementName) ? -rawPct : rawPct
    const rounded = Math.round(changePct * 10) / 10

    const direction = rounded > 1 ? 'up' : rounded < -1 ? 'down' : 'flat'
    const display = isCardioBenchmark(movementName)
      ? `${Math.abs(rounded)}% (${formatSeconds(first)} → ${formatSeconds(latest)})`
      : `${Math.abs(rounded)}% (${first}kg → ${latest}kg)`

    return { movementName, sessions: ordered.length, first, latest, changePct: rounded, direction, display }
  })
}

/** Compares the two most recent months present in the score set. */
export function compareForgeGames(scores: InsightScore[]) {
  const months = [...new Set(scores.map((s) => s.scoreMonth))].sort()
  const current = months[months.length - 1]
  const previous = months[months.length - 2]

  if (!current || !previous) {
    return {
      improved: [] as string[],
      regressed: [] as string[],
      note: months.length === 0
        ? 'No Forge Games scores yet. Run the five benchmarks this month to start the month-over-month comparison.'
        : 'Only one month of Forge Games on file — next month unlocks the comparison.',
    }
  }

  const improved: string[] = []
  const regressed: string[] = []

  for (const benchmark of new Set(scores.map((s) => s.benchmarkName))) {
    const now = scores.find((s) => s.benchmarkName === benchmark && s.scoreMonth === current)
    const before = scores.find((s) => s.benchmarkName === benchmark && s.scoreMonth === previous)
    if (!now || !before || before.value === 0) continue

    const meta = getBenchmark(benchmark)
    const rawPct = ((now.value - before.value) / before.value) * 100
    const gainPct = Math.round((meta?.lowerIsBetter ? -rawPct : rawPct) * 10) / 10
    if (Math.abs(gainPct) < 1) continue

    const line = `${benchmark}: ${gainPct > 0 ? '+' : ''}${gainPct}% vs ${formatMonth(previous)}.`
    if (gainPct > 0) improved.push(line)
    else regressed.push(line)
  }

  return {
    improved,
    regressed,
    note:
      regressed.length > 0
        ? `Forge Games dipped on ${regressed.length} benchmark${regressed.length === 1 ? '' : 's'} — check sleep, load and testing conditions before changing the program.`
        : null,
  }
}

function listOf(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function humanTag(tag: string): string {
  return tag.replace(/_/g, ' ')
}
