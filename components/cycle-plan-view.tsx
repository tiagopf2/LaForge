'use client'

import { useState } from 'react'
import { AlertTriangle, Dumbbell, Printer, Repeat, Flame } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CyclePlan } from '@/lib/program'

/**
 * The read-only view of a generated cycle: header, week picker and the three
 * blocks. Shared so a saved cycle opened from a member file looks exactly like
 * the one the generator just produced — the coach reads one layout, not two.
 */
export function CyclePlanView({
  plan,
  title,
  status,
  meta,
}: {
  plan: CyclePlan
  title: string
  status: string
  /** Extra line under the title — start date, validation date, and so on. */
  meta?: React.ReactNode
}) {
  const [activeWeek, setActiveWeek] = useState(1)
  const week = plan.weeks.find((w) => w.week === activeWeek) ?? plan.weeks[0]

  if (!week) {
    return (
      <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
        <CardContent className="p-6 text-sm text-muted-foreground">
          This cycle has no weeks recorded.
        </CardContent>
      </Card>
    )
  }

  const referenceLabel = (offset: number) => {
    const reference = plan.referenceWeightKg
    if (reference == null) return offset === 0 ? 'reference weight' : `reference +${offset}kg`
    return `${reference + offset}kg`
  }

  return (
    <div className="space-y-4">
      <Card className="border-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Main movement: <strong>{plan.mainMovement}</strong> · {plan.level} · progression
                steps of {plan.incrementKg}kg
                {plan.referenceWeightKg != null
                  ? ` · reference ${plan.referenceWeightKg}kg on file`
                  : ' · no reference weight yet (Week 1 sets it)'}
              </p>
              {meta && <p className="text-sm text-muted-foreground mt-1">{meta}</p>}
            </div>
            <div className="flex items-center gap-2 print-hidden">
              <Badge variant={status === 'validated' ? 'default' : 'secondary'}>
                {status === 'validated' ? 'Validated' : status === 'archived' ? 'Archived' : 'Draft'}
              </Badge>
              <Button variant="outline" size="sm" data-compact onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print
              </Button>
            </div>
          </div>
        </CardHeader>

        {plan.warnings.length > 0 && (
          <CardContent className="pt-0">
            {plan.warnings.map((warning, i) => (
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
        {plan.weeks.map((w) => (
          <button
            key={w.week}
            type="button"
            onClick={() => setActiveWeek(w.week)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
              w.week === week.week
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
