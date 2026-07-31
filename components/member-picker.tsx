'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { apiGet } from '@/lib/client'
import { cn } from '@/lib/utils'

export type PickerMember = {
  id: string
  firstName: string
  lastName: string
  active: boolean
  assessments: { id: string; assessedAt: string; trainingLevel: string; restrictionTags: string[] }[]
  _count?: { performanceRecords: number }
}

/**
 * Loads the member list once per screen. Four pages needed the same picker, so
 * the fetch and the dropdown live here rather than being copy-pasted.
 */
export function useMembers() {
  const [members, setMembers] = useState<PickerMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<PickerMember[]>('/api/members')
      .then((data) => {
        if (!cancelled) setMembers(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { members, loading, error }
}

export function initials(member: { firstName: string; lastName: string } | undefined) {
  if (!member) return ''
  return `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`
}

export function MemberPicker({
  members,
  value,
  onChange,
  placeholder = 'Select a member',
}: {
  members: PickerMember[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = members.find((m) => m.id === value)

  // With 160 members the list needs filtering, and tapping outside should
  // close it — both easy to get wrong on a touch screen.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return members
    return members.filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(term))
  }, [members, search])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-card hover:bg-muted/50 transition-colors text-left"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        {selected ? (
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary text-sm">
              {initials(selected)}
            </span>
            <span className="font-medium">
              {selected.firstName} {selected.lastName}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" /> {placeholder}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-card rounded-xl border border-border z-30 overflow-hidden"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          {members.length > 8 && (
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full px-4 py-3 border-b border-border bg-transparent outline-none text-sm"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No members match.</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted text-left text-sm"
                >
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary text-xs">
                    {initials(m)}
                  </span>
                  <span className="flex-1">
                    {m.firstName} {m.lastName}
                  </span>
                  {m.assessments.length === 0 && (
                    <span className="text-xs text-amber-600">no assessment</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
