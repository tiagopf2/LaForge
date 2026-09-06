'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Archive, ArchiveRestore, Check, Sparkles, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  _count: { records: number }
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const router = useRouter()

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

  /**
   * Archiving is the reversible counterpart to deleting: the plan stays on the
   * member's file and out of the way. Coming back out, a cycle that was ever
   * validated returns to validated -- `validatedAt` survives archiving, so the
   * status it had before is recoverable without storing it separately.
   */
  const handleArchiveToggle = async () => {
    if (!cycle) return
    const next = cycle.status === 'archived' ? (cycle.validatedAt ? 'validated' : 'draft') : 'archived'
    setArchiving(true)
    try {
      await apiSend(`/api/cycles/${cycle.id}`, 'PATCH', { status: next })
      toast.success(next === 'archived' ? 'Cycle archived' : 'Cycle restored')
      load()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = async () => {
    if (!cycle) return
    setDeleting(true)
    try {
      await apiSend(`/api/cycles/${cycle.id}`, 'DELETE')
      toast.success('Cycle deleted')
      // The cycle this page is about is gone, so there is nothing left to show.
      router.push(`/dashboard/members/${memberId}`)
      router.refresh()
    } catch (error) {
      toast.error((error as Error).message)
      setDeleting(false)
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
          {/* Only a draft is still awaiting the coach. A validated cycle shows what
              they signed off, and an archived one is not assignable until it is
              restored, so neither offers the button again. */}
          {cycle.status !== 'draft' ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {cycle.coachNotes ||
                (cycle.status === 'archived'
                  ? 'Archived. Restore it to assign it again.'
                  : 'Validated with no notes.')}
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

      <Card className="border-0 print-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium">
                {cycle.status === 'archived' ? 'Restore this cycle' : 'Archive this cycle'}
              </p>
              <p className="text-xs text-muted-foreground">
                {cycle.status === 'archived'
                  ? 'Puts it back among the active cycles on the member file.'
                  : 'Keeps the plan on file but out of the way. Reversible at any time.'}
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={handleArchiveToggle}
              loading={archiving}
            >
              {cycle.status === 'archived' ? (
                <>
                  <ArchiveRestore className="w-4 h-4 mr-2" /> Restore Cycle
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" /> Archive Cycle
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border/60 pt-4">
            <div>
              <p className="text-sm font-medium">Delete this cycle</p>
              <p className="text-xs text-muted-foreground">
                Removes the plan from {cycle.member.firstName}&apos;s file for good. Logged results
                are kept.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Cycle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this cycle?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">{cycle.templateName}</p>
              <p className="text-sm text-muted-foreground">
                {cycle.mainMovement} · {cycle.cycleLength} weeks · {cycle.status} · generated{' '}
                {formatDate(cycle.createdAt)}
              </p>
            </div>
            {cycle.status === 'validated' && (
              <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                This cycle was validated, so it may be the plan {cycle.member.firstName} is training
                right now.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {cycle._count.records > 0
                ? `The ${cycle._count.records} result${cycle._count.records === 1 ? '' : 's'} logged against this cycle are kept — they just stop being linked to it. The plan itself cannot be recovered.`
                : 'No results are logged against this cycle. This cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Keep it
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12"
                onClick={handleDelete}
                loading={deleting}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
            {cycle.status !== 'archived' && (
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => {
                  setConfirmDelete(false)
                  handleArchiveToggle()
                }}
              >
                Archive it instead — keeps the plan, just out of the way
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
