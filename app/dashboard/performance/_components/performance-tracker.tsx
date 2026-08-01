'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Plus, TrendingUp, TrendingDown, Minus, Wind } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiGet, apiSend, query } from '@/lib/client'
import { MemberPicker, useMembers } from '@/components/member-picker'
import {
  CARDIO_BENCHMARKS,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  STRENGTH_MOVEMENTS,
  formatSeconds,
  type SessionType,
} from '@/lib/forge'
import type { Suggestion } from '@/lib/progression'

type Record_ = {
  id: string
  movementName: string
  value: number
  reps: number | null
  sets: number | null
  rpe: number | null
  phase: string
  unit: string
  recordedAt: string
}

const EMPTY_FORM = {
  movementType: 'strength' as 'strength' | 'cardio',
  movementName: '',
  phase: 'progression' as 'calibration' | 'progression',
  value: '',
  reps: '',
  sets: '3',
  rpe: '',
  notes: '',
}

export function PerformancePage() {
  const { members } = useMembers()
  const [memberId, setMemberId] = useState('')
  const [records, setRecords] = useState<Record_[]>([])
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [flowForm, setFlowForm] = useState({ sessionType: 'full' as SessionType, notes: '' })

  const member = members.find((m) => m.id === memberId)

  const load = useCallback(async () => {
    if (!memberId) {
      setRecords([])
      setSuggestions({})
      return
    }
    try {
      // One request for history and one for all eight suggestions, rather than
      // the eight separate suggestion calls this page used to fire.
      const [recordData, suggestionData] = await Promise.all([
        apiGet<Record_[]>(`/api/performance${query({ memberId })}`),
        apiGet<Record<string, Suggestion>>(`/api/performance/suggest${query({ memberId })}`),
      ])
      setRecords(recordData)
      setSuggestions(suggestionData)
    } catch (error) {
      toast.error((error as Error).message)
    }
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  const latestByMovement = useMemo(() => {
    const map = new Map<string, Record_>()
    for (const record of records) {
      if (!map.has(record.movementName)) map.set(record.movementName, record)
    }
    return map
  }, [records])

  const handleSubmit = async () => {
    if (!form.movementName || !form.value) {
      toast.error('Pick a movement and enter a result')
      return
    }

    setSubmitting(true)
    try {
      await apiSend('/api/performance', 'POST', {
        memberId,
        movementName: form.movementName,
        phase: form.phase,
        value: Number(form.value),
        reps: form.movementType === 'strength' ? Number(form.reps) : null,
        sets: form.movementType === 'strength' ? Number(form.sets) : null,
        rpe: form.movementType === 'strength' && form.rpe ? Number(form.rpe) : null,
        notes: form.notes || null,
      })
      toast.success('Result recorded')
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      load()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFlowSession = async () => {
    setSubmitting(true)
    try {
      await apiSend('/api/sessions', 'POST', {
        memberId,
        sessionType: flowForm.sessionType,
        flowSession: true,
        notes: flowForm.notes || null,
      })
      toast.success('Flow session logged — no data required')
      setFlowOpen(false)
      setFlowForm({ sessionType: 'full', notes: '' })
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const activeSuggestion = form.movementName ? suggestions[form.movementName] : undefined

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Module 3 — Performance Tracking
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Five compounds and three cardio benchmarks only. Everything else runs at RPE.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12" disabled={!memberId} onClick={() => setFlowOpen(true)}>
              <Wind className="w-4 h-4 mr-2" /> Flow Session
            </Button>
            <Button className="h-12 px-6" disabled={!memberId} onClick={() => setDialogOpen(true)}>
              <Plus className="w-5 h-5 mr-2" /> Log Result
            </Button>
          </div>
        </div>
      </FadeIn>

      <MemberPicker members={members} value={memberId} onChange={setMemberId} placeholder="Select a member to track" />

      {!memberId ? (
        <p className="text-center text-muted-foreground py-16">
          Pick a member to see their next-session recommendations.
        </p>
      ) : (
        <Tabs defaultValue="strength">
          <TabsList className="w-full grid grid-cols-2 h-12">
            <TabsTrigger value="strength">5 Strength Movements</TabsTrigger>
            <TabsTrigger value="cardio">3 Cardio Benchmarks</TabsTrigger>
          </TabsList>

          <TabsContent value="strength" className="mt-4">
            <Stagger className="space-y-3">
              {STRENGTH_MOVEMENTS.map((movement) => (
                <StaggerItem key={movement}>
                  <MovementCard
                    movement={movement}
                    latest={latestByMovement.get(movement)}
                    suggestion={suggestions[movement]}
                    onLog={() => {
                      setForm({ ...EMPTY_FORM, movementType: 'strength', movementName: movement })
                      setDialogOpen(true)
                    }}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </TabsContent>

          <TabsContent value="cardio" className="mt-4">
            <Stagger className="space-y-3">
              {CARDIO_BENCHMARKS.map((movement) => (
                <StaggerItem key={movement}>
                  <MovementCard
                    movement={movement}
                    latest={latestByMovement.get(movement)}
                    suggestion={suggestions[movement]}
                    onLog={() => {
                      setForm({ ...EMPTY_FORM, movementType: 'cardio', movementName: movement })
                      setDialogOpen(true)
                    }}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          </TabsContent>
        </Tabs>
      )}

      {/* Log a tracked result */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Core Movement{member ? ` — ${member.firstName}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              {(['strength', 'cardio'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...EMPTY_FORM, movementType: type })}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium text-sm capitalize transition-colors',
                    form.movementType === type ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Movement</Label>
              <div className="flex flex-wrap gap-2">
                {(form.movementType === 'strength' ? STRENGTH_MOVEMENTS : CARDIO_BENCHMARKS).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({ ...form, movementName: m })}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-sm transition-colors',
                      form.movementName === m
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {form.movementType === 'strength' && (
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['calibration', 'progression'] as const).map((phase) => (
                    <button
                      key={phase}
                      type="button"
                      onClick={() => setForm({ ...form, phase })}
                      className={cn(
                        'py-3 rounded-xl text-sm capitalize transition-colors',
                        form.phase === phase ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      {phase}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Week 1 of a cycle is calibration — the load you log becomes the reference weight.
                </p>
              </div>
            )}

            {activeSuggestion && (
              <div className="p-3 rounded-lg bg-muted/60 text-sm space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <TrendIcon trend={activeSuggestion.trend} />
                  Recommendation
                </div>
                <p className="text-muted-foreground">{activeSuggestion.message}</p>
                {activeSuggestion.suggestion != null && (
                  <p className="font-mono text-primary">
                    {activeSuggestion.unit === 'kg'
                      ? `${activeSuggestion.suggestion}kg`
                      : formatSeconds(activeSuggestion.suggestion)}
                    {activeSuggestion.targetSets
                      ? ` · ${activeSuggestion.targetSets}×${activeSuggestion.targetReps}`
                      : ''}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>{form.movementType === 'strength' ? 'Weight (kg)' : 'Time (seconds)'}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  className="h-12"
                />
              </div>
              {form.movementType === 'strength' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Sets</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={form.sets}
                      onChange={(e) => setForm({ ...form, sets: e.target.value })}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reps</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={form.reps}
                      onChange={(e) => setForm({ ...form, reps: e.target.value })}
                      className="h-12"
                    />
                  </div>
                </>
              )}
            </div>

            {form.movementType === 'strength' && (
              <div className="space-y-1.5">
                <Label>RPE {form.phase === 'calibration' ? '(target 7-8)' : '(optional)'}</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.rpe}
                  onChange={(e) => setForm({ ...form, rpe: e.target.value })}
                  className="h-12"
                  min="1"
                  max="10"
                  step="0.5"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[60px]"
              />
            </div>

            <Button className="w-full h-12" onClick={handleSubmit} loading={submitting}>
              Save Result
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flow session — brief: log the session with no forced data entry */}
      <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Flow Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              No tracking today. This records that {member?.firstName ?? 'the member'} trained,
              nothing more.
            </p>

            <div className="space-y-1.5">
              <Label>Session Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFlowForm({ ...flowForm, sessionType: type })}
                    className={cn(
                      'py-3 rounded-xl text-sm transition-colors',
                      flowForm.sessionType === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {SESSION_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={flowForm.notes}
                onChange={(e) => setFlowForm({ ...flowForm, notes: e.target.value })}
                className="min-h-[60px]"
              />
            </div>

            <Button className="w-full h-12" onClick={handleFlowSession} loading={submitting}>
              Log Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MovementCard({
  movement,
  latest,
  suggestion,
  onLog,
}: {
  movement: string
  latest: Record_ | undefined
  suggestion: Suggestion | undefined
  onLog: () => void
}) {
  return (
    <Card className="border-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{movement}</p>
            {latest ? (
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {latest.unit === 'kg'
                  ? `${latest.value}kg · ${latest.sets}×${latest.reps} · ${latest.phase}`
                  : formatSeconds(latest.value)}
                {' · '}
                {new Date(latest.recordedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No data yet</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {suggestion && <TrendIcon trend={suggestion.trend} />}
            {suggestion?.suggestion != null && (
              <Badge variant="secondary" className="font-mono">
                →{' '}
                {suggestion.unit === 'kg'
                  ? `${suggestion.suggestion}kg`
                  : formatSeconds(suggestion.suggestion)}
                {suggestion.targetSets ? ` ${suggestion.targetSets}×${suggestion.targetReps}` : ''}
              </Badge>
            )}
            <Button variant="outline" size="sm" data-compact onClick={onLog}>
              Log
            </Button>
          </div>
        </div>
        {suggestion && <p className="text-xs text-muted-foreground">{suggestion.message}</p>}
      </CardContent>
    </Card>
  )
}

function TrendIcon({ trend }: { trend: Suggestion['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-500" />
  if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-muted-foreground" />
}
