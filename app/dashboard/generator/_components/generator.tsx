'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sparkles, AlertTriangle, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiSend } from '@/lib/client'
import { MemberPicker, useMembers } from '@/components/member-picker'
import { CyclePlanView } from '@/components/cycle-plan-view'
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
  // Reached with a member already in mind when the coach came from that
  // member's file rather than from the nav.
  const searchParams = useSearchParams()
  const [memberId, setMemberId] = useState(searchParams?.get('memberId') ?? '')
  const [goal, setGoal] = useState<string>('General Fitness')
  const [sessionType, setSessionType] = useState<SessionType>('full')
  const [cycleLength, setCycleLength] = useState(6)
  const [level, setLevel] = useState<MemberLevel | ''>('')
  const [mainMovement, setMainMovement] = useState<string>('')

  const [generating, setGenerating] = useState(false)
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [coachNotes, setCoachNotes] = useState('')

  const member = members.find((m) => m.id === memberId)
  const assessment = member?.assessments[0]

  // Level defaults to whatever the assessment recorded, but the coach can
  // override it for this cycle.
  const effectiveLevel = (level || assessment?.trainingLevel || 'beginner') as MemberLevel

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

      {result && (
        <FadeIn>
          <div className="space-y-4">
            <CyclePlanView
              plan={result.plan}
              title={`${member?.firstName ?? ''} ${member?.lastName ?? ''} — ${result.plan.templateName}`.trim()}
              status={result.status}
            />

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
