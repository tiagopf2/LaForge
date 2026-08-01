'use client'

import Link from 'next/link'
import { Users, ClipboardList, TrendingUp, Gauge, ArrowRight, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { useMembers, initials } from '@/components/member-picker'
import { MAX_MEMBERS } from '@/lib/forge'

const QUICK_ACTIONS = [
  { href: '/dashboard/assessment', label: 'Run intake assessment', module: 'Module 1' },
  { href: '/dashboard/warmup', label: 'Generate a warm-up', module: 'Module 2' },
  { href: '/dashboard/performance', label: 'Log a session result', module: 'Module 3' },
  { href: '/dashboard/forge-games', label: 'Record Forge Games', module: 'Module 4' },
  { href: '/dashboard/generator', label: 'Build a training cycle', module: 'Module 6B' },
]

export function DashboardOverview() {
  const { members, loading, error } = useMembers()

  const active = members.filter((m) => m.active)
  const assessed = members.filter((m) => m.assessments.length > 0)
  const needsAssessment = active.filter((m) => m.assessments.length === 0)
  const totalRecords = members.reduce((sum, m) => sum + (m._count?.performanceRecords ?? 0), 0)
  const capacityPct = Math.round((active.length / MAX_MEMBERS) * 100)

  const stats = [
    { label: 'Active members', value: active.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Assessed profiles', value: assessed.length, icon: ClipboardList, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Results logged', value: totalRecords, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Studio capacity', value: `${active.length}/${MAX_MEMBERS}`, icon: Gauge, color: 'text-purple-500', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="font-display text-3xl font-bold tracking-tight">Coach Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          La Forge — assessment, warm-ups, tracking, Forge Games and programming in one place.
        </p>
      </FadeIn>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <StaggerItem key={stat.label}>
              <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
                <CardContent className="p-5">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="font-mono text-2xl font-bold">{loading ? '—' : stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          )
        })}
      </Stagger>

      <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Capacity</span>
            <span className="font-mono text-muted-foreground">{capacityPct}% of {MAX_MEMBERS}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, capacityPct)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {needsAssessment.length > 0 && (
        <Card className="border-0 bg-amber-50/70" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <CardContent className="p-5">
            <p className="flex items-center gap-2 font-medium text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              {needsAssessment.length} active member{needsAssessment.length === 1 ? '' : 's'} without an
              assessment
            </p>
            <p className="text-sm text-amber-700/80 mt-1">
              Warm-ups and programs cannot be personalised until Module 1 is done.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {needsAssessment.slice(0, 6).map((m) => (
                <Link key={m.id} href={`/dashboard/assessment?memberId=${m.id}`}>
                  <Button variant="outline" size="sm" className="bg-white/60">
                    {m.firstName} {m.lastName}
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href} className="block">
                <Button variant="ghost" className="w-full justify-between h-14 text-base">
                  <span className="flex flex-col items-start">
                    <span>{action.label}</span>
                    <span className="text-xs text-muted-foreground font-normal">{action.module}</span>
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0" style={{ boxShadow: 'var(--shadow-md)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Members</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">No members yet.</p>
                <Link href="/dashboard/members">
                  <Button className="mt-3">Add the first member</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {members.slice(0, 6).map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/members/${m.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary text-sm">
                        {initials(m)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {m.firstName} {m.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.assessments.length > 0 ? 'Assessed' : 'Needs assessment'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {m._count?.performanceRecords ?? 0} logs
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
