'use client'

import { useState } from 'react'
import { Zap, User, Flame, Clock, RotateCcw, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { FadeIn, SlideIn } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiSend } from '@/lib/client'
import { MemberPicker, useMembers } from '@/components/member-picker'
import { SESSION_TYPES, type SessionType } from '@/lib/forge'

const SESSION_TYPE_META: Record<SessionType, { label: string; emoji: string }> = {
  upper: { label: 'Upper Body', emoji: '💪' },
  lower: { label: 'Lower Body', emoji: '🦵' },
  full: { label: 'Full Body', emoji: '🏋️' },
  conditioning: { label: 'Conditioning', emoji: '❤️‍🔥' },
}

interface GeneratedDrill {
  drillCode: string
  name: string
  instructions: string
  durationSec: number
  reason: string
}

interface WarmupResult {
  drills: GeneratedDrill[]
  totalDurationSec: number
  coachNote: string
  avoidAreas: string[]
  restrictionTags: string[]
}

export function WarmupPage() {
  const { members } = useMembers()
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [sessionType, setSessionType] = useState<SessionType | ''>('')
  const [generalWarmup, setGeneralWarmup] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<WarmupResult | null>(null)

  const member = members.find((m) => m.id === selectedMember)
  const hasAssessment = (member?.assessments.length ?? 0) > 0

  const handleGenerate = async () => {
    if (!selectedMember) return toast.error('Select a member')
    if (!sessionType) return toast.error('Select a session type')

    setGenerating(true)
    setResult(null)

    try {
      const data = await apiSend<WarmupResult>('/api/warmup/generate', 'POST', {
        memberId: selectedMember,
        sessionType,
        generalWarmup: generalWarmup || null,
      })
      setResult(data)
      toast.success('Warm-up generated')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" /> Module 2 — Warm-Up Generator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Template-based, assessment-driven warm-up for iPad floor coaching.</p>
      </FadeIn>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <SlideIn from="left">
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Select Member
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <MemberPicker members={members} value={selectedMember} onChange={setSelectedMember} />
                {member && !hasAssessment && (
                  <p className="text-xs text-amber-600">
                    ⚠️ No assessment on file — run Module 1 first, the personalised block needs it.
                  </p>
                )}
              </CardContent>
            </Card>
          </SlideIn>

          <SlideIn from="left" delay={0.08}>
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" /> Session Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {SESSION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSessionType(type)}
                      className={cn(
                        'p-4 rounded-xl text-center transition-all min-h-[64px]',
                        sessionType === type ? 'bg-primary text-primary-foreground scale-[1.02]' : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      <span className="text-2xl block mb-1">{SESSION_TYPE_META[type].emoji}</span>
                      <span className="text-sm font-medium">{SESSION_TYPE_META[type].label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </SlideIn>

          <SlideIn from="left" delay={0.16}>
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Part 1 — General Activation</CardTitle>
              </CardHeader>
              <CardContent>
                <Label className="text-xs text-muted-foreground mb-2 block">Optional coach note shown to members before personalized drills</Label>
                <Textarea
                  placeholder="Example: 2 min bike + 10 jumping jacks + 10 arm circles"
                  value={generalWarmup}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setGeneralWarmup(e.target.value)}
                  className="min-h-[90px]"
                />
              </CardContent>
            </Card>
          </SlideIn>

          <Button onClick={handleGenerate} disabled={generating || !selectedMember || !sessionType} className="w-full h-14 text-base">
            {generating ? 'Generating...' : 'Generate Personal Warm-Up'}
          </Button>
        </div>

        <div>
          {result ? (
            <FadeIn>
              <Card className="border-0 bg-gradient-to-br from-orange-50 to-amber-50" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">🔥 {member?.firstName}&apos;s Warm-Up</CardTitle>
                    <div className="flex gap-2 print-hidden">
                      <Button variant="outline" size="sm" data-compact onClick={() => setResult(null)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                      </Button>
                      <Button variant="outline" size="sm" data-compact onClick={() => window.print()}>
                        <Printer className="w-3.5 h-3.5 mr-1" /> Print
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <Badge variant="secondary" className="capitalize">
                      {sessionType} Day
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {Math.round((result.totalDurationSec / 60) * 10) / 10} min of a 5 min budget
                    </span>
                    {result.avoidAreas.length > 0 && (
                      <span className="text-xs text-amber-700">
                        avoiding {result.avoidAreas.join(', ').replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generalWarmup && (
                    <div className="p-4 rounded-xl bg-white/60">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Part 1 — Group Activation</p>
                      <p className="text-sm whitespace-pre-wrap">{generalWarmup}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Part 2 — Personal Mobility</p>
                    <div className="space-y-3">
                      {(result?.drills ?? []).map((drill, i) => (
                        <div key={drill.drillCode + i} className="p-4 rounded-xl bg-white/80" style={{ boxShadow: 'var(--shadow-sm)' }}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</span>
                              <div>
                                <p className="font-medium text-sm">{drill?.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {drill?.drillCode} • {drill?.durationSec}s
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-foreground/80 mb-2">{drill?.instructions}</p>
                          <p className="text-xs text-primary/70 italic">→ {drill?.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {result?.coachNote && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs font-semibold text-primary mb-1">📝 Coach Note</p>
                      <p className="text-sm text-foreground/80">{result?.coachNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          ) : (
            <Card className="border-0 h-full flex items-center justify-center" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardContent className="text-center py-16">
                <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Generate a member-specific warm-up from the fixed drill templates.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
