'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { apiGet, apiSend } from '@/lib/client'
import { CyclePlanView } from '@/components/cycle-plan-view'
import type { CyclePlan } from '@/lib/program'

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

  return (
    <div className="space-y-6">
      <FadeIn>{backLink}</FadeIn>

      {cycle.plan === null ? (
        <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
          <CardContent className="p-6 space-y-1">
            <p className="font-medium">{cycle.templateName}</p>
            <p className="text-sm text-muted-foreground">
              The saved plan for this cycle could not be read. Generate a new cycle for{' '}
              {cycle.member.firstName} to replace it.
            </p>
          </CardContent>
        </Card>
      ) : (
        <CyclePlanView
          plan={cycle.plan}
          title={`${cycle.member.firstName} ${cycle.member.lastName} — ${cycle.templateName}`}
          status={cycle.status}
          meta={
            <>
              Generated {formatDate(cycle.createdAt)} · starts {formatDate(cycle.startDate)}
              {cycle.validatedAt ? ` · validated ${formatDate(cycle.validatedAt)}` : ''}
            </>
          }
        />
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
