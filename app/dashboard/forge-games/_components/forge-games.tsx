'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trophy, Plus, TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiGet, apiSend, query } from '@/lib/client'
import { MemberPicker, useMembers } from '@/components/member-picker'
import { FORGE_GAMES_BENCHMARKS, formatMonth, formatSeconds, monthKey } from '@/lib/forge'

type BenchmarkRow = {
  name: string
  unit: string
  lowerIsBetter: boolean
  history: { scoreMonth: string; value: number; notes: string | null }[]
  /** Scored in the current calendar month, or null if not tested yet. */
  current: { scoreMonth: string; value: number } | null
  /** Most recent score whenever it happened — what the delta is measured from. */
  latest: { scoreMonth: string; value: number } | null
  previous: { scoreMonth: string; value: number } | null
  best: { scoreMonth: string; value: number } | null
  changePct: number | null
  direction: 'improved' | 'regressed' | 'unchanged' | null
}

type ForgeGamesResponse = {
  months: string[]
  currentMonth: string
  hasComparison: boolean
  benchmarks: BenchmarkRow[]
}

const formatValue = (value: number, unit: string) =>
  unit === 'seconds' ? formatSeconds(value) : `${value} ${unit}`

export function ForgeGamesPage() {
  const { members } = useMembers()
  const [memberId, setMemberId] = useState('')
  const [data, setData] = useState<ForgeGamesResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    benchmarkName: '',
    value: '',
    scoreMonth: monthKey(),
    notes: '',
  })

  const member = members.find((m) => m.id === memberId)

  const load = useCallback(async () => {
    if (!memberId) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      setData(await apiGet<ForgeGamesResponse>(`/api/forge-games${query({ memberId, months: 12 })}`))
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async () => {
    if (!form.benchmarkName || !form.value) {
      toast.error('Pick a benchmark and enter a score')
      return
    }

    setSubmitting(true)
    try {
      await apiSend('/api/forge-games', 'POST', {
        memberId,
        benchmarkName: form.benchmarkName,
        value: Number(form.value),
        scoreMonth: form.scoreMonth,
        notes: form.notes || null,
      })
      toast.success('Score saved')
      setDialogOpen(false)
      setForm({ benchmarkName: '', value: '', scoreMonth: form.scoreMonth, notes: '' })
      load()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const logged = data?.benchmarks.filter((b) => b.current).length ?? 0

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" /> Module 4 — Monthly Forge Games
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              The same five benchmarks every month, compared month over month.
            </p>
          </div>
          <Button className="h-12 px-6" disabled={!memberId} onClick={() => setDialogOpen(true)}>
            <Plus className="w-5 h-5 mr-2" /> Log Score
          </Button>
        </div>
      </FadeIn>

      <MemberPicker members={members} value={memberId} onChange={setMemberId} />

      {!memberId ? (
        <p className="text-center text-muted-foreground py-16">
          Select a member to see their Forge Games progression.
        </p>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
            <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">Current month</p>
                <p className="font-display text-xl font-bold">
                  {formatMonth(data?.currentMonth ?? monthKey())}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-bold">{logged}/5</p>
                <p className="text-sm text-muted-foreground">benchmarks logged</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {(data?.benchmarks ?? []).map((benchmark) => (
              <BenchmarkCard key={benchmark.name} benchmark={benchmark} />
            ))}
          </div>

          {data && !data.hasComparison && (
            <p className="text-sm text-muted-foreground text-center">
              Month-over-month comparison appears once a second month of scores is on file.
            </p>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Log Forge Games Score{member ? ` — ${member.firstName}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Benchmark</Label>
              <div className="flex flex-wrap gap-2">
                {FORGE_GAMES_BENCHMARKS.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => setForm({ ...form, benchmarkName: b.name })}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-sm transition-colors',
                      form.benchmarkName === b.name
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Value
                  {form.benchmarkName
                    ? ` (${FORGE_GAMES_BENCHMARKS.find((b) => b.name === form.benchmarkName)?.unit})`
                    : ''}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Input
                  type="month"
                  value={form.scoreMonth}
                  onChange={(e) => setForm({ ...form, scoreMonth: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="h-12"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Re-testing the same benchmark in the same month replaces the score rather than adding
              a second one.
            </p>

            <Button className="w-full h-12" onClick={handleSubmit} loading={submitting}>
              Save Score
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BenchmarkCard({ benchmark }: { benchmark: BenchmarkRow }) {
  const { current, latest, previous, best, changePct, direction } = benchmark

  const Icon =
    direction === 'improved' ? TrendingUp : direction === 'regressed' ? TrendingDown : Minus
  const tone =
    direction === 'improved'
      ? 'text-emerald-600 bg-emerald-50'
      : direction === 'regressed'
        ? 'text-red-600 bg-red-50'
        : 'text-muted-foreground bg-muted'

  return (
    <Card className="border-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{benchmark.name}</CardTitle>
          {changePct != null && (
            <span
              className={cn(
                'flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full',
                tone
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {changePct > 0 ? '+' : ''}
              {changePct}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {current ? (
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono text-2xl font-bold">
              {formatValue(current.value, benchmark.unit)}
            </span>
            {previous && (
              <span className="text-sm text-muted-foreground">
                was {formatValue(previous.value, benchmark.unit)} in {formatMonth(previous.scoreMonth)}
              </span>
            )}
          </div>
        ) : latest ? (
          // Untested this month, but the earlier scores still carry a real
          // comparison — show what the percentage badge above is measuring
          // rather than leaving it floating over an empty card.
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono text-2xl font-bold text-muted-foreground">
              {formatValue(latest.value, benchmark.unit)}
            </span>
            <span className="text-sm text-muted-foreground">
              not tested this month — last in {formatMonth(latest.scoreMonth)}
              {previous &&
                `, was ${formatValue(previous.value, benchmark.unit)} in ${formatMonth(previous.scoreMonth)}`}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No scores on file.</p>
        )}

        {best && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Medal className="w-3.5 h-3.5 text-amber-500" />
            Best: {formatValue(best.value, benchmark.unit)} ({formatMonth(best.scoreMonth)})
          </p>
        )}

        {benchmark.history.length > 1 && <Sparkline benchmark={benchmark} />}
      </CardContent>
    </Card>
  )
}

/**
 * A deliberately plain bar strip rather than a full chart — the brief asks for
 * something readable by someone who is not a data analyst.
 */
function Sparkline({ benchmark }: { benchmark: BenchmarkRow }) {
  const values = benchmark.history.map((h) => h.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  return (
    <div className="flex items-end gap-1.5 h-14 pt-2">
      {benchmark.history.map((point) => {
        const ratio = (point.value - min) / span
        // Taller always means better, whichever direction the metric runs.
        const height = 20 + (benchmark.lowerIsBetter ? 1 - ratio : ratio) * 80
        return (
          <div key={point.scoreMonth} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className="w-full rounded-t bg-primary/70"
              style={{ height: `${height}%` }}
              title={`${formatMonth(point.scoreMonth)}: ${formatValue(point.value, benchmark.unit)}`}
            />
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {point.scoreMonth.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
