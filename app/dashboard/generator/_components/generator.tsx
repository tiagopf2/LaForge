'use client'

import { useMemo, useState } from 'react'
import { Sparkles, AlertTriangle, Check, Printer, Dumbbell, Repeat, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiSend } from '@/lib/client'
import { MemberPicker, useMembers } from '@/components/member-picker'
import {
  GOALS,
  MEMBER_LEVELS,
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  STRENGTH_MOVEMENTS,
  type MemberLevel,
  type SessionType,
} from '@/lib/forge'
import type { CyclePlan } from '@/lib/program'

type GenerateResponse = {
  cycleId: string
  status: string
  plan: CyclePlan
  message: string
}

export function GeneratorPage() {
  const { members } = useMembers()
  const [memberId, setMemberId] = useState('')
  const [goal, setGoal] = useState<string>('General Fitness')
  const [sessionType, setSessionType] = useState<SessionType>('full')
  const [cycleLength, setCycleLength] = useState(6)
  const [level, setLevel] = useState<MemberLevel | ''>('')
  const [mainMovement, setMainMovement] = useState<string>('')

  const [generating, setGenerating] = useState(false)
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [coachNotes, setCoachNotes] = useState('')
  const [activeWeek, setActiveWeek] = useState(1)

  const member = members.find((m) => m.id === memberId)
  const assessment = member?.assessments[0]

  // Level defaults to whatever the assessment recorded, but the coach can
  // override it for this cycle.
  const effectiveLevel = (level || assessment?.trainingLevel || 'beginner') as MemberLevel

  const week = useMemo(
    () => result?.plan.weeks.find((w) => w.week === activeWeek) ?? result?.plan.weeks[0],
    [result, activeWeek]
  )

  const handleGenerate = async () => {
    if (!memberId) {
      toast.error('Select a member first')
      return
    }

    setGenerating(true)
    try {
      const data = await apiSend<GenerateResponse>('/api/program-generator', 'POST', {
        memberId,
        goal,
        sessionType,
        cycleLength,
        level: effectiveLevel,
        ...(mainMovement ? { mainMovement } : {}),
      })
      setResult(data)
      setActiveWeek(1)
      setCoachNotes('')
      toast.success('Draft cycle generated — review before assigning')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const handleValidate = async () => {
    if (!result) return
    setValidating(true)
    try {
      await apiSend(`/api/cycles/${result.cycleId}`, 'PATCH', {
        status: 'validated',
        coachNotes: coachNotes || null,
      })
      setResult({ ...result, status: 'validated' })
      toast.success('Cycle validated and ready to assign')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setValidating(false)
    }
  }

  const referenceLabel = (offset: number) => {
    const reference = result?.plan.referenceWeightKg
    if (reference == null) return offset === 0 ? 'reference weight' : `reference +${offset}kg`
    return `${reference + offset}kg`
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Module 6B — Program Generator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Builds a 4-8 week cycle from your exercise library. Every cycle starts as a draft — you
          are the final validator.
        </p>
      </FadeIn>

      <Card className="border-0 print-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cycle Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Member</Label>
            <MemberPicker members={members} value={memberId} onChange={setMemberId} />
            {member && !assessment && (
              <p className="text-xs text-amber-600 flex items-center gap-1 pt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                No assessment on file — restrictions cannot be applied to this cycle.
              </p>
            )}
            {assessment && assessment.restrictionTags.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                Assessment flags: {assessment.restrictionTags.slice(0, 4).join(', ').replace(/_/g, ' ')}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Goal</Label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((option) => (
                <Chip key={option} label={option} active={goal === option} onClick={() => setGoal(option)} />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SESSION_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={SESSION_TYPE_LABELS[type]}
                  active={sessionType === type}
                  onClick={() => setSessionType(type)}
                />
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label>Cycle Length</Label>
              <div className="flex flex-wrap gap-2">
                {[4, 5, 6, 7, 8].map((weeks) => (
                  <Chip
                    key={weeks}
                    label={`${weeks} wk`}
                    active={cycleLength === weeks}
                    onClick={() => setCycleLength(weeks)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Level {level === '' && assessment ? '(from assessment)' : ''}</Label>
              <div className="flex flex-wrap gap-2">
                {MEMBER_LEVELS.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    active={effectiveLevel === option}
                    onClick={() => setLevel(option)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Main Movement — leave blank to use the default for this session type</Label>
            <div className="flex flex-wrap gap-2">
              <Chip label="Auto" active={mainMovement === ''} onClick={() => setMainMovement('')} />
              {STRENGTH_MOVEMENTS.map((movement) => (
                <Chip
                  key={movement}
                  label={movement}
                  active={mainMovement === movement}
                  onClick={() => setMainMovement(movement)}
                />
              ))}
            </div>
          </div>

          <Button className="h-12 px-8" onClick={handleGenerate} loading={generating} disabled={!memberId}>
            Generate Draft Cycle
          </Button>
        </CardContent>
      </Card>

      {result && week && (
        <FadeIn>
          <div className="space-y-4">
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">
                      {member?.firstName} {member?.lastName} — {result.plan.templateName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Main movement: <strong>{result.plan.mainMovement}</strong> ·{' '}
                      {result.plan.level} · progression steps of {result.plan.incrementKg}kg
                      {result.plan.referenceWeightKg != null
                        ? ` · reference ${result.plan.referenceWeightKg}kg on file`
                        : ' · no reference weight yet (Week 1 sets it)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 print-hidden">
                    <Badge variant={result.status === 'validated' ? 'default' : 'secondary'}>
                      {result.status === 'validated' ? 'Validated' : 'Draft'}
                    </Badge>
                    <Button variant="outline" size="sm" data-compact onClick={() => window.print()}>
                      <Printer className="w-3.5 h-3.5 mr-1" /> Print
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {result.plan.warnings.length > 0 && (
                <CardContent className="pt-0">
                  {result.plan.warnings.map((warning, i) => (
                    <p
                      key={i}
                      className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-2"
                    >
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      {warning}
                    </p>
                  ))}
                </CardContent>
              )}
            </Card>

            <div className="flex gap-2 overflow-x-auto pb-1 print-hidden">
              {result.plan.weeks.map((w) => (
                <button
                  key={w.week}
                  type="button"
                  onClick={() => setActiveWeek(w.week)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                    w.week === activeWeek
                      ? 'bg-primary text-primary-foreground'
                      : w.blockA.phase === 'calibration'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Week {w.week}
                </button>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">{week.focus}</p>

            <BlockCard
              icon={<Dumbbell className="w-4 h-4" />}
              title="Block A — Main Movement"
              subtitle="15-20 min · tracked and progressive"
              accent="bg-orange-50"
            >
              <p className="text-xl font-display font-bold">{week.blockA.movement}</p>
              <p className="font-mono text-primary text-lg mt-1">
                {week.blockA.sets} × {week.blockA.reps} @ {referenceLabel(week.blockA.loadOffsetKg)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">{week.blockA.note}</p>
            </BlockCard>

            <BlockCard
              icon={<Repeat className="w-4 h-4" />}
              title="Block B — Structured Accessory Work"
              subtitle={`10-15 min · ${week.blockB.format} · RPE only, no tracking`}
              accent="bg-blue-50"
            >
              {week.blockB.exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No library match — add accessories for this level and restriction set.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {week.blockB.exercises.map((exercise, i) => (
                    <li key={i} className="border-b border-border/60 last:border-0 pb-2.5 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{exercise.name}</span>
                        <span className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                          {exercise.sets} × {exercise.reps} {exercise.rpe ? `· ${exercise.rpe}` : ''}
                        </span>
                      </div>
                      {exercise.note && (
                        <p className="text-xs text-muted-foreground mt-0.5">{exercise.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </BlockCard>

            <BlockCard
              icon={<Flame className="w-4 h-4" />}
              title="Block C — Conditioning Finisher"
              subtitle={`10 min · ${week.blockC.format} · flow, no tracking`}
              accent="bg-purple-50"
            >
              {week.blockC.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No library match — add conditioning movements for this level.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {week.blockC.movements.map((movement, i) => (
                    <li key={i} className="border-b border-border/60 last:border-0 pb-2.5 last:pb-0">
                      <p className="font-medium">{movement.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{movement.reps}</p>
                    </li>
                  ))}
                </ul>
              )}
              {week.blockC.avoids.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Avoiding muscles already loaded today: {week.blockC.avoids.join(', ')}
                </p>
              )}
            </BlockCard>

            <Card className="border-0 print-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Coach Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Changes you made, things to watch during the cycle…"
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button
                  className="h-12"
                  onClick={handleValidate}
                  loading={validating}
                  disabled={result.status === 'validated'}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {result.status === 'validated' ? 'Validated' : 'Validate & Assign'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </FadeIn>
      )}
    </div>
  )
}

function BlockCard({
  icon,
  title,
  subtitle,
  accent,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-0 overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
      <CardHeader className={cn('pb-3', accent)}>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
      )}
    >
      {label}
    </button>
  )
}
