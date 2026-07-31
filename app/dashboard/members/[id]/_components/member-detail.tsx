'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Activity, TrendingUp, Clock, Target, Trophy, Sparkles,
  Lightbulb, AlertCircle, CheckCircle2, Wind,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import dynamic from 'next/dynamic'
import { apiGet, query } from '@/lib/client'
import { formatMonth, formatSeconds } from '@/lib/forge'
import type { Insights } from '@/lib/insights'

const PerformanceChart = dynamic(() => import('./performance-chart'), {
  ssr: false,
  loading: () => <div className="h-48 bg-muted animate-pulse rounded-lg" />,
})

export function MemberDetailPage({ memberId }: { memberId: string }) {
  const [member, setMember] = useState<any>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!memberId) return
    try {
      const [memberData, insightData] = await Promise.all([
        apiGet<any>(`/api/members/${memberId}`),
        apiGet<Insights>(`/api/insights${query({ memberId })}`),
      ])
      setMember(memberData)
      setInsights(insightData)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    load()
  }, [load])

  const movementGroups = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const record of member?.performanceRecords ?? []) {
      const name = record.movementName ?? 'Unknown'
      ;(groups[name] ??= []).push(record)
    }
    return groups
  }, [member])

  const forgeByMonth = useMemo(() => {
    const months = new Map<string, any[]>()
    for (const score of member?.forgeGameScores ?? []) {
      const list = months.get(score.scoreMonth) ?? []
      list.push(score)
      months.set(score.scoreMonth, list)
    }
    return [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [member])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Member not found</p>
        <Link href="/dashboard/members">
          <Button variant="ghost" className="mt-4">
            Back to Members
          </Button>
        </Link>
      </div>
    )
  }

  const latestAssessment = member.assessments?.[0]
  const goals: string[] = latestAssessment?.goals ?? []

  return (
    <div className="space-y-6">
      <FadeIn>
        <Link
          href="/dashboard/members"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Members
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
            {member.firstName?.[0]}
            {member.lastName?.[0]}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {member.firstName} {member.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {member.email ?? 'No email'}
              {member.phone ? ` • ${member.phone}` : ''}
              {latestAssessment ? ` • ${latestAssessment.trainingLevel}` : ''}
            </p>
          </div>
        </div>
      </FadeIn>

      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-12">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ---------------- Progress (Module 5) ---------------- */}
        <TabsContent value="progress" className="space-y-4 mt-4">
          {insights && (
            <div className="grid md:grid-cols-3 gap-4">
              <InsightList
                title="Strengths"
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                items={insights.strengths}
                tone="bg-emerald-50/60"
              />
              <InsightList
                title="Areas to Improve"
                icon={<AlertCircle className="w-4 h-4 text-amber-600" />}
                items={insights.improvements}
                tone="bg-amber-50/60"
                empty="Nothing flagged right now."
              />
              <InsightList
                title="Recommendations"
                icon={<Lightbulb className="w-4 h-4 text-primary" />}
                items={insights.recommendations}
                tone="bg-primary/5"
              />
            </div>
          )}

          {Object.keys(movementGroups).length === 0 ? (
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No performance data yet</p>
                <Link href={`/dashboard/performance?memberId=${memberId}`}>
                  <Button className="mt-4">Log First Session</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            Object.entries(movementGroups).map(([name, records]) => {
              const summary = insights?.movementSummaries.find((s) => s.movementName === name)
              return (
                <Card key={name} className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">{name}</CardTitle>
                      {summary && summary.direction !== 'none' && (
                        <Badge
                          variant="secondary"
                          className={
                            summary.direction === 'up'
                              ? 'text-emerald-700'
                              : summary.direction === 'down'
                                ? 'text-red-700'
                                : ''
                          }
                        >
                          {summary.direction === 'up' ? '↑' : summary.direction === 'down' ? '↓' : '→'}{' '}
                          {summary.display}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart records={records} movementName={name} />
                  </CardContent>
                </Card>
              )
            })
          )}

          <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" /> Monthly Forge Games
              </CardTitle>
            </CardHeader>
            <CardContent>
              {forgeByMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Forge Games scores yet.{' '}
                  <Link href="/dashboard/forge-games" className="text-primary underline">
                    Record this month
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-4">
                  {forgeByMonth.slice(0, 4).map(([month, scores]) => (
                    <div key={month}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {formatMonth(month)}
                      </p>
                      <div className="space-y-1.5">
                        {scores.map((score: any) => (
                          <div
                            key={score.id}
                            className="flex justify-between text-sm p-2.5 rounded-lg bg-muted/50"
                          >
                            <span>{score.benchmarkName}</span>
                            <span className="font-mono">
                              {score.unit === 'seconds'
                                ? formatSeconds(score.value)
                                : `${score.value} ${score.unit}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Profile (Module 1) ---------------- */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          {!latestAssessment ? (
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
              <CardContent className="p-6 text-center">
                <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No assessment yet</p>
                <Link href={`/dashboard/assessment?memberId=${memberId}`}>
                  <Button className="mt-4">Start Assessment</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> Mobility Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <MobilityItem label="Shoulder L" value={latestAssessment.shoulderMobilityLeft} />
                  <MobilityItem label="Shoulder R" value={latestAssessment.shoulderMobilityRight} />
                  <MobilityItem label="Hip L" value={latestAssessment.hipMobilityLeft} />
                  <MobilityItem label="Hip R" value={latestAssessment.hipMobilityRight} />
                  <MobilityItem label="Ankle L" value={latestAssessment.ankleMobilityLeft} />
                  <MobilityItem label="Ankle R" value={latestAssessment.ankleMobilityRight} />
                  <MobilityItem label="T-Spine" value={latestAssessment.thoracicMobility} />
                  <MobilityItem label="Cardio" value={latestAssessment.cardioLevel} />
                </CardContent>
              </Card>

              {latestAssessment.avoidAreas?.length > 0 && (
                <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Avoid</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {latestAssessment.avoidAreas.map((area: string) => (
                      <Badge key={area} variant="outline" className="border-amber-300 text-amber-700 capitalize">
                        {area.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}

              {goals.length > 0 && (
                <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Goals</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {goals.map((goal) => (
                      <Badge key={goal}>{goal}</Badge>
                    ))}
                  </CardContent>
                </Card>
              )}

              {latestAssessment.restrictionTags?.length > 0 && (
                <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Warm-Up Targets</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {latestAssessment.restrictionTags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="capitalize">
                        {tag.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ---------------- History ---------------- */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wind className="w-4 h-4 text-primary" /> Session Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(member.sessionLogs?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No flow sessions logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {member.sessionLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg bg-muted/50 flex items-center justify-between text-sm"
                    >
                      <span className="capitalize">
                        {log.sessionType} {log.flowSession ? '· flow' : ''}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(log.sessionDate).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Recent Warm-Ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(member.warmupSessions?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No warm-ups generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {member.warmupSessions.map((session: any) => (
                    <div key={session.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{session.sessionType} Day</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(session.generatedAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{session.coachNote}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Program Cycles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(member.trainingCycles?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No generated cycles yet.</p>
              ) : (
                <div className="space-y-2">
                  {member.trainingCycles.map((cycle: any) => (
                    <div
                      key={cycle.id}
                      className="p-3 rounded-lg bg-muted/50 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <p>{cycle.templateName}</p>
                        <p className="text-xs text-muted-foreground">
                          {cycle.mainMovement} · {cycle.cycleLength} weeks
                        </p>
                      </div>
                      <Badge variant={cycle.status === 'validated' ? 'default' : 'secondary'}>
                        {cycle.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InsightList({
  title,
  icon,
  items,
  tone,
  empty = 'Nothing yet.',
}: {
  title: string
  icon: React.ReactNode
  items: string[]
  tone: string
  empty?: string
}) {
  return (
    <Card className={`border-0 ${tone}`} style={{ boxShadow: 'var(--shadow-sm)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item, i) => (
              <li key={i} className="leading-snug">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function MobilityItem({ label, value }: { label: string; value: string | null | undefined }) {
  const colorMap: Record<string, string> = {
    good: 'text-emerald-600 bg-emerald-50',
    normal: 'text-blue-600 bg-blue-50',
    limited: 'text-amber-600 bg-amber-50',
    stiff: 'text-red-600 bg-red-50',
    beginner: 'text-amber-600 bg-amber-50',
    intermediate: 'text-blue-600 bg-blue-50',
    advanced: 'text-emerald-600 bg-emerald-50',
  }
  const color = colorMap[value?.toLowerCase() ?? ''] ?? 'text-muted-foreground bg-muted'
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${color}`}>
        {value ?? 'N/A'}
      </span>
    </div>
  )
}
