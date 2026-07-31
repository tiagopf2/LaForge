'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Search, UserCheck, UserX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'
import { apiGet, apiSend } from '@/lib/client'
import { MAX_MEMBERS } from '@/lib/forge'

interface Member {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  active: boolean
  joinDate: string
  assessments: any[]
  _count: { performanceRecords: number }
}

export function MembersListPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchMembers = () => {
    apiGet<Member[]>('/api/members')
      .then(setMembers)
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchMembers() }, [])

  const filtered = (members ?? []).filter((m: Member) => {
    const term = search?.toLowerCase() ?? ''
    return (
      (m?.firstName?.toLowerCase() ?? '').includes(term) ||
      (m?.lastName?.toLowerCase() ?? '').includes(term) ||
      (m?.email?.toLowerCase() ?? '').includes(term)
    )
  })

  const handleAdd = async () => {
    if (!form.firstName || !form.lastName) {
      toast.error('First and last name required')
      return
    }
    setSubmitting(true)
    try {
      await apiSend('/api/members', 'POST', form)
      toast.success('Member added')
      setForm({ firstName: '', lastName: '', email: '', phone: '' })
      setDialogOpen(false)
      fetchMembers()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Members
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {members.length} registered · {members.filter((m) => m.active).length}/{MAX_MEMBERS} active
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 px-6 text-base">
                <Plus className="w-5 h-5 mr-2" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>New Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, firstName: e.target.value })}
                      placeholder="Jean"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, lastName: e.target.value })}
                      placeholder="Dupont"
                      className="h-12"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
                    placeholder="jean@email.com"
                    className="h-12"
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+33 6 12 34 56 78"
                    className="h-12"
                  />
                </div>
                <Button className="w-full h-12" onClick={handleAdd} loading={submitting}>
                  Add Member
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </FadeIn>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i: number) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (filtered?.length ?? 0) === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No members found</p>
        </div>
      ) : (
        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(filtered ?? []).map((m: Member) => (
            <StaggerItem key={m?.id}>
              <Link href={`/dashboard/members/${m?.id}`}>
                <Card className="border-0 hover:scale-[1.02] transition-transform cursor-pointer" style={{ boxShadow: 'var(--shadow-md)' }}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                          {m?.firstName?.[0] ?? ''}{m?.lastName?.[0] ?? ''}
                        </div>
                        <div>
                          <p className="font-medium">{m?.firstName} {m?.lastName}</p>
                          <p className="text-xs text-muted-foreground">{m?.email ?? 'No email'}</p>
                        </div>
                      </div>
                      {m?.active ? (
                        <UserCheck className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <UserX className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                      <span>{(m?.assessments?.length ?? 0) > 0 ? '✅ Assessed' : '⚠️ Needs assessment'}</span>
                      <span className="font-mono">{m?._count?.performanceRecords ?? 0} logs</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}
