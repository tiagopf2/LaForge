'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ClipboardList, ChevronRight, ChevronLeft, Check, User,
  Target, Dumbbell, Heart, AlertTriangle, Medal, Flag, Clock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiGet, apiSend } from '@/lib/client'
import { MEMBER_LEVELS } from '@/lib/forge'

interface Member {
  id: string
  firstName: string
  lastName: string
}

const MOBILITY_OPTIONS = ['good', 'normal', 'limited'] as const
const CARDIO_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
const GOAL_OPTIONS = ['Strength', 'Fat Loss', 'Conditioning', 'Performance', 'General Fitness', 'Muscle Gain', 'Flexibility'] as const
const WEAK_POINTS = ['Core', 'Glutes', 'Posture', 'Lumbar/Lower Back', 'Hip Flexors', 'Overhead Mobility', 'Grip Strength', 'Balance'] as const

const steps = [
  { id: 'member', label: 'Member', icon: User },
  { id: 'mobility', label: 'Mobility', icon: Target },
  { id: 'strength', label: 'Strength', icon: Dumbbell },
  { id: 'cardio', label: 'Level', icon: Heart },
  { id: 'injuries', label: 'Injuries', icon: AlertTriangle },
  { id: 'background', label: 'Background', icon: Medal },
  { id: 'goals', label: 'Goals', icon: Flag },
  { id: 'constraints', label: 'Constraints', icon: Clock },
]

const emptyForm = (memberId = '') => ({
  memberId,
  shoulderMobilityLeft: '',
  shoulderMobilityRight: '',
  shoulderNotes: '',
  hipMobilityLeft: '',
  hipMobilityRight: '',
  hipNotes: '',
  ankleMobilityLeft: '',
  ankleMobilityRight: '',
  ankleNotes: '',
  thoracicMobility: '',
  thoracicNotes: '',
  strengthAsymmetries: '',
  weakPoints: [] as string[],
  cardioLevel: '',
  trainingLevel: 'beginner',
  injuryHistory: [] as string[],
  injuryInput: '',
  areasToAvoid: [] as string[],
  avoidInput: '',
  sportsBackground: '',
  goals: [] as string[],
  constraints: '',
})

export function AssessmentPage() {
  const searchParams = useSearchParams()
  const preselectedId = searchParams?.get('memberId') ?? ''

  const [currentStep, setCurrentStep] = useState(0)
  const [members, setMembers] = useState<Member[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm(preselectedId))

  useEffect(() => {
    apiGet<Member[]>('/api/members')
      .then(setMembers)
      .catch((error: Error) => toast.error(error.message))
  }, [])

  useEffect(() => {
    if (preselectedId) setForm((prev) => ({ ...prev, memberId: preselectedId }))
  }, [preselectedId])

  const updateForm = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

  const toggleArray = (key: string, value: string) => {
    setForm((prev) => {
      const arr = (prev as any)[key] ?? []
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value] }
    })
  }

  const addToArray = (key: string, inputKey: string) => {
    const val = ((form as any)[inputKey] ?? '').trim()
    if (!val) return
    setForm((prev) => {
      const arr = (prev as any)[key] ?? []
      return { ...prev, [key]: [...arr, val], [inputKey]: '' }
    })
  }

  const handleSubmit = async () => {
    if (!form.memberId) { toast.error('Select a member'); return }
    setSubmitting(true)
    try {
      // Arrays go over the wire as arrays — the API stores real Postgres
      // text[] columns, no JSON-in-a-string round trip.
      const payload = {
        memberId: form.memberId,
        shoulderMobilityLeft: form.shoulderMobilityLeft || null,
        shoulderMobilityRight: form.shoulderMobilityRight || null,
        shoulderNotes: form.shoulderNotes || null,
        hipMobilityLeft: form.hipMobilityLeft || null,
        hipMobilityRight: form.hipMobilityRight || null,
        hipNotes: form.hipNotes || null,
        ankleMobilityLeft: form.ankleMobilityLeft || null,
        ankleMobilityRight: form.ankleMobilityRight || null,
        ankleNotes: form.ankleNotes || null,
        thoracicMobility: form.thoracicMobility || null,
        thoracicNotes: form.thoracicNotes || null,
        strengthAsymmetries: form.strengthAsymmetries || null,
        weakPoints: form.weakPoints,
        cardioLevel: form.cardioLevel || null,
        trainingLevel: form.trainingLevel || 'beginner',
        injuryHistory: form.injuryHistory,
        areasToAvoid: form.areasToAvoid,
        sportsBackground: form.sportsBackground || null,
        goals: form.goals,
        constraints: form.constraints || null,
      }
      await apiSend('/api/assessments', 'POST', payload)
      toast.success('Assessment saved — the profile now drives warm-ups and programs.')
      setCurrentStep(0)
      setForm(emptyForm())
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedMember = (members ?? []).find((m: Member) => m?.id === form.memberId)

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" /> Body Assessment
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Record mobility, strength, and health data for a member</p>
      </FadeIn>

      {/* Step indicator */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {steps.map((step: any, i: number) => {
          const Icon = step?.icon
          return (
            <button
              key={step?.id}
              onClick={() => setCurrentStep(i)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                i === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : i < currentStep
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {i < currentStep ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{step?.label}</span>
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <Card className="border-0" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <CardContent className="p-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <CardTitle className="text-lg">Select Member</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                {(members ?? []).map((m: Member) => (
                  <button
                    key={m?.id}
                    onClick={() => updateForm('memberId', m?.id)}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl text-left transition-all',
                      form.memberId === m?.id
                        ? 'bg-primary/10 ring-2 ring-primary'
                        : 'bg-muted/50 hover:bg-muted'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary text-sm">
                      {m?.firstName?.[0] ?? ''}{m?.lastName?.[0] ?? ''}
                    </div>
                    <span className="font-medium">{m?.firstName} {m?.lastName}</span>
                  </button>
                ))}
              </div>
              {(members?.length ?? 0) === 0 && (
                <p className="text-muted-foreground text-sm text-center py-6">No members yet. Add members first.</p>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <CardTitle className="text-lg">Mobility Assessment {selectedMember ? `— ${selectedMember?.firstName}` : ''}</CardTitle>
              
              <div className="space-y-5">
                <MobilitySection
                  label="Shoulders"
                  leftValue={form.shoulderMobilityLeft}
                  rightValue={form.shoulderMobilityRight}
                  onLeftChange={(v: string) => updateForm('shoulderMobilityLeft', v)}
                  onRightChange={(v: string) => updateForm('shoulderMobilityRight', v)}
                  notes={form.shoulderNotes}
                  onNotesChange={(v: string) => updateForm('shoulderNotes', v)}
                />
                <MobilitySection
                  label="Hips"
                  leftValue={form.hipMobilityLeft}
                  rightValue={form.hipMobilityRight}
                  onLeftChange={(v: string) => updateForm('hipMobilityLeft', v)}
                  onRightChange={(v: string) => updateForm('hipMobilityRight', v)}
                  notes={form.hipNotes}
                  onNotesChange={(v: string) => updateForm('hipNotes', v)}
                />
                <MobilitySection
                  label="Ankles"
                  leftValue={form.ankleMobilityLeft}
                  rightValue={form.ankleMobilityRight}
                  onLeftChange={(v: string) => updateForm('ankleMobilityLeft', v)}
                  onRightChange={(v: string) => updateForm('ankleMobilityRight', v)}
                  notes={form.ankleNotes}
                  onNotesChange={(v: string) => updateForm('ankleNotes', v)}
                />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Thoracic Spine</Label>
                  <div className="flex gap-2">
                    {[...MOBILITY_OPTIONS, 'stiff' as const].map((opt: string) => (
                      <button
                        key={opt}
                        onClick={() => updateForm('thoracicMobility', opt)}
                        className={cn(
                          'px-4 py-3 rounded-xl text-sm font-medium capitalize flex-1 transition-colors',
                          form.thoracicMobility === opt
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Notes on thoracic mobility..."
                    value={form.thoracicNotes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm('thoracicNotes', e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5">
              <CardTitle className="text-lg">Strength Assessment</CardTitle>
              <div className="space-y-2">
                <Label>Strength Asymmetries / Imbalances</Label>
                <Textarea
                  placeholder="Describe any left/right imbalances, e.g. 'Left hip shift during squat, right shoulder compensates on press'..."
                  value={form.strengthAsymmetries}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm('strengthAsymmetries', e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Weak Points (select all that apply)</Label>
                <div className="flex flex-wrap gap-2">
                  {WEAK_POINTS.map((wp: string) => (
                    <button
                      key={wp}
                      onClick={() => toggleArray('weakPoints', wp)}
                      className={cn(
                        'px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                        (form.weakPoints ?? []).includes(wp)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      {wp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <CardTitle className="text-lg">Cardio Baseline</CardTitle>
                <div className="grid grid-cols-3 gap-3">
                  {CARDIO_LEVELS.map((level: string) => (
                    <button
                      key={level}
                      onClick={() => updateForm('cardioLevel', level)}
                      className={cn(
                        'p-6 rounded-xl text-center font-medium capitalize transition-colors',
                        form.cardioLevel === level
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      <Heart className={cn('w-8 h-8 mx-auto mb-2', form.cardioLevel === level ? 'text-primary-foreground' : 'text-muted-foreground')} />
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <CardTitle className="text-lg">Training Level</CardTitle>
                <p className="text-sm text-muted-foreground -mt-2">
                  Sets which exercises the program generator is allowed to pick from.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {MEMBER_LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => updateForm('trainingLevel', level)}
                      className={cn(
                        'p-5 rounded-xl text-center font-medium capitalize transition-colors',
                        form.trainingLevel === level
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      <Dumbbell className={cn('w-7 h-7 mx-auto mb-2', form.trainingLevel === level ? 'text-primary-foreground' : 'text-muted-foreground')} />
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-5">
              <CardTitle className="text-lg">Injury History</CardTitle>
              <div className="space-y-2">
                <Label>Past injuries & chronic issues</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. ACL tear 2019, chronic shoulder impingement..."
                    value={form.injuryInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateForm('injuryInput', e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addToArray('injuryHistory', 'injuryInput') } }}
                    className="h-12 flex-1"
                  />
                  <Button onClick={() => addToArray('injuryHistory', 'injuryInput')} className="h-12 px-6">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.injuryHistory ?? []).map((inj: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-sm py-1.5 px-3">
                      {inj}
                      <button onClick={() => setForm((prev) => ({ ...prev, injuryHistory: prev.injuryHistory.filter((_: string, idx: number) => idx !== i) }))} data-compact aria-label="Remove" className="ml-2 text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Areas to Avoid</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. left knee, right shoulder overhead..."
                    value={form.avoidInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateForm('avoidInput', e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addToArray('areasToAvoid', 'avoidInput') } }}
                    className="h-12 flex-1"
                  />
                  <Button onClick={() => addToArray('areasToAvoid', 'avoidInput')} className="h-12 px-6">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.areasToAvoid ?? []).map((area: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-sm py-1.5 px-3 border-amber-200 text-amber-700">
                      {area}
                      <button onClick={() => setForm((prev) => ({ ...prev, areasToAvoid: prev.areasToAvoid.filter((_: string, idx: number) => idx !== i) }))} data-compact aria-label="Remove" className="ml-2 text-destructive">×</button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-5">
              <CardTitle className="text-lg">Sports Background</CardTitle>
              <Textarea
                placeholder="Describe previous sports experience, duration, level. e.g. '5 years CrossFit (intermediate), 2 years martial arts, recreational runner'..."
                value={form.sportsBackground}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm('sportsBackground', e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-5">
              <CardTitle className="text-lg">Goals</CardTitle>
              <div className="flex flex-wrap gap-3">
                {GOAL_OPTIONS.map((goal: string) => (
                  <button
                    key={goal}
                    onClick={() => toggleArray('goals', goal)}
                    className={cn(
                      'px-5 py-4 rounded-xl text-sm font-medium transition-colors',
                      (form.goals ?? []).includes(goal)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-5">
              <CardTitle className="text-lg">Constraints</CardTitle>
              <Textarea
                placeholder="Time availability, schedule limitations, physical constraints... e.g. 'Available 3x/week, morning only, cannot do impact exercises due to knee'..."
                value={form.constraints}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateForm('constraints', e.target.value)}
                className="min-h-[120px]"
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="h-12 px-6"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => {
                  if (currentStep === 0 && !form.memberId) {
                    toast.error('Please select a member')
                    return
                  }
                  setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))
                }}
                className="h-12 px-6"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting} className="h-12 px-8">
                <Check className="w-4 h-4 mr-1" /> Save Assessment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MobilitySection({ label, leftValue, rightValue, onLeftChange, onRightChange, notes, onNotesChange }: {
  label: string
  leftValue: string
  rightValue: string
  onLeftChange: (v: string) => void
  onRightChange: (v: string) => void
  notes: string
  onNotesChange: (v: string) => void
}) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Left</span>
          <div className="flex gap-1.5">
            {MOBILITY_OPTIONS.map((opt: string) => (
              <button
                key={opt}
                onClick={() => onLeftChange(opt)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-xs font-medium capitalize transition-colors',
                  leftValue === opt ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Right</span>
          <div className="flex gap-1.5">
            {MOBILITY_OPTIONS.map((opt: string) => (
              <button
                key={opt}
                onClick={() => onRightChange(opt)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-xs font-medium capitalize transition-colors',
                  rightValue === opt ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Textarea
        placeholder={`${label} notes - compensation patterns, limitations...`}
        value={notes}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNotesChange(e.target.value)}
        className="min-h-[50px] text-sm"
      />
    </div>
  )
}
