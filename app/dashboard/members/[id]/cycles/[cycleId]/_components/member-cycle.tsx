'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Check, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { apiGet, apiSend } from '@/lib/client'
import { CyclePlanView } from '@/components/cycle-plan-view'
import { Badge } from '@/components/ui/badge'
import type { CyclePlan, LegacyPlan } from '@/lib/program'

type Cycle = {
  id: string
  status: string
  templateName: string
  goal: string
  sessionType: string
  cycleLength: number
  mainMovement: string
  coachNotes: string | null
  startDate: string
  createdAt: string
  validatedAt: string | null
  plan: CyclePlan | null
  legacyPlan: LegacyPlan | null
  member: { id: string; firstName: string; lastName: string }
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-GB')

/**
 * The saved program for one member, reached from their file. The generator page
 * only ever holds the cycle it just built, so without this the plan a coach
 * generated last month was in the database but nowhere on screen.
 */
export function MemberCyclePage({ memberId, cycleId }: { memberId: string; cycleId: string }) {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachNotes, setCoachNotes] = useState('')
  const [validating, setValidating] = useState(false)

  const load = useCallback(async () => {
    if (!cycleId) return
    try {
      const data = await apiGet<Cycle>(`/api/cycles/${cycleId}`)
      setCycle(data)
      setCoachNotes(data.coachNotes ?? '')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => {
    load()
  }, [load])

  const handleValidate = async () => {
    if (!cycle) return
    setValidating(true)
    try {
      await apiSend(`/api/cycles/${cycle.id}`, 'PATCH', {
        status: 'validated',
        coachNotes: coachNotes || null,
      })
      toast.success('Cycle validated and ready to assign')
      load()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setValidating(false)
    }
  }

  const backLink = (
    <Link
      href={`/dashboard/members/${memberId}`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 print-hidden"
    >
      <ArrowLeft className="w-4 h-4" /> Back to Member
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Cycle not found</p>
        <Link href={`/dashboard/members/${memberId}`}>
          <Button variant="ghost" className="mt-4">
            Back to Member
          </Button>
        </Link>
      </div>
    )
  }

  const title = `${cycle.member.firstName} ${cycle.member.lastName} — ${cycle.templateName}`

  return (
    <div className="space-y-6">
      <FadeIn>{backLink}</FadeIn>

      {cycle.plan ? (
        <CyclePlanView
          plan={cycle.plan}
          title={title}
          status={cycle.status}
          meta={
            <>
              Generated {formatDate(cycle.createdAt)} · starts {formatDate(cycle.startDate)}
              {cycle.validatedAt ? ` · validated ${formatDate(cycle.validatedAt)}` : ''}
            </>
          }
        />
      ) : cycle.legacyPlan ? (
        <LegacyCycleCard cycle={cycle} title={title} />
      ) : (
        <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
          <CardContent className="p-6 space-y-1">
            <p className="font-medium">{cycle.templateName}</p>
            <p className="text-sm text-muted-foreground">
              The saved plan for this cycle could not be read. Generate a new cycle for{' '}
              {cycle.member.firstName} to replace it.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Coach Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cycle.status === 'validated' ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {cycle.coachNotes || 'Validated with no notes.'}
            </p>
          ) : (
            <>
              <Textarea
                placeholder="Changes you made, things to watch during the cycle…"
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                className="min-h-[80px] print-hidden"
              />
              <Button className="h-12 print-hidden" onClick={handleValidate} loading={validating}>
                <Check className="w-4 h-4 mr-2" /> Validate &amp; Assign
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const BLOCK_LABELS: Record<string, string> = {
  blockA: 'Block A — Main Movement',
  blockB: 'Block B — Structured Accessory Work',
  blockC: 'Block C — Conditioning Finisher',
}

/**
 * A cycle saved by the earlier generator. It has no weeks to page through, so
 * this shows the block summary it does carry and points at the generator, which
 * is the only way to get a week-by-week plan for this member.
 */
function LegacyCycleCard({ cycle, title }: { cycle: Cycle; title: string }) {
  const blocks = Object.entries(cycle.legacyPlan?.blocks ?? {})

  return (
    <div className="space-y-4">
      <Card className="border-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {cycle.mainMovement} · {cycle.goal} · {cycle.sessionType} · {cycle.cycleLength} weeks
                · generated {formatDate(cycle.createdAt)}
              </p>
            </div>
            <Badge variant="secondary">{cycle.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            This cycle was saved before the current generator, so it has a single block summary
            rather than a week-by-week plan. Generate a new cycle to get one.
          </p>
        </CardContent>
      </Card>

      {blocks.map(([key, block]) => (
        <Card key={key} className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{BLOCK_LABELS[key] ?? key}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {block.movement && <p className="font-display font-bold text-lg">{block.movement}</p>}
            {block.format && <p className="text-sm">{block.format}</p>}
            {block.logic && <p className="text-sm text-muted-foreground">{block.logic}</p>}
            {block.template && block.template.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
                {block.template.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      <Link href={`/dashboard/generator?memberId=${cycle.member.id}`}>
        <Button className="h-12">
          <Sparkles className="w-4 h-4 mr-2" /> Generate a new cycle
        </Button>
      </Link>
    </div>
  )
}
