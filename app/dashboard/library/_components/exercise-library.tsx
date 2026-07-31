'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Pencil, Plus, Search, RotateCcw, Archive } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FadeIn } from '@/components/ui/animate'
import { cn } from '@/lib/utils'
import { apiGet, apiSend, query } from '@/lib/client'
import {
  CONTRAINDICATION_AREAS,
  DIFFICULTIES,
  EXERCISE_CATEGORIES,
  MOVEMENT_PATTERNS,
} from '@/lib/forge'

type Exercise = {
  id: string
  name: string
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  movementPattern: string
  difficulty: string
  equipment: string[]
  contraindications: string[]
  loadingScheme: string | null
  coachNotes: string | null
  trackedMovement: string | null
  tier: string
  active: boolean
}

const EMPTY_FORM = {
  name: '',
  category: 'accessory',
  primaryMuscles: '',
  secondaryMuscles: '',
  movementPattern: 'push',
  difficulty: 'all',
  equipment: '',
  contraindications: [] as string[],
  loadingScheme: '',
  coachNotes: '',
  tier: 'studio',
  active: true,
}

const CATEGORY_COLORS: Record<string, string> = {
  compound: 'bg-orange-100 text-orange-700',
  accessory: 'bg-blue-100 text-blue-700',
  cardio: 'bg-rose-100 text-rose-700',
  mobility: 'bg-emerald-100 text-emerald-700',
  conditioning: 'bg-purple-100 text-purple-700',
}

const toList = (value: string) =>
  value
    .split(/[;,]/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)

export function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('')
  const [showInactive, setShowInactive] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<Exercise[]>(
        `/api/exercises${query({ category, includeInactive: showInactive ? 'true' : undefined })}`
      )
      setExercises(data)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [category, showInactive])

  useEffect(() => {
    load()
  }, [load])

  // Filtering by name happens client-side: the whole library is a few dozen
  // rows and the coach types with one hand mid-session.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return exercises
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(term) ||
        ex.primaryMuscles.some((m) => m.includes(term)) ||
        ex.equipment.some((m) => m.includes(term))
    )
  }, [exercises, search])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (exercise: Exercise) => {
    setEditingId(exercise.id)
    setForm({
      name: exercise.name,
      category: exercise.category,
      primaryMuscles: exercise.primaryMuscles.join(', '),
      secondaryMuscles: exercise.secondaryMuscles.join(', '),
      movementPattern: exercise.movementPattern,
      difficulty: exercise.difficulty,
      equipment: exercise.equipment.join(', '),
      contraindications: exercise.contraindications,
      loadingScheme: exercise.loadingScheme ?? '',
      coachNotes: exercise.coachNotes ?? '',
      tier: exercise.tier,
      active: exercise.active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (form.name.trim().length < 2) {
      toast.error('Give the exercise a name')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        primaryMuscles: toList(form.primaryMuscles),
        secondaryMuscles: toList(form.secondaryMuscles),
        movementPattern: form.movementPattern,
        difficulty: form.difficulty,
        equipment: toList(form.equipment),
        contraindications: form.contraindications,
        loadingScheme: form.loadingScheme || null,
        coachNotes: form.coachNotes || null,
        tier: form.tier,
        active: form.active,
      }

      if (editingId) await apiSend(`/api/exercises/${editingId}`, 'PATCH', payload)
      else await apiSend('/api/exercises', 'POST', payload)

      toast.success(editingId ? 'Exercise updated' : 'Exercise added')
      setDialogOpen(false)
      load()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (exercise: Exercise) => {
    try {
      if (exercise.active) {
        await apiSend(`/api/exercises/${exercise.id}`, 'DELETE')
        toast.success(`${exercise.name} archived`)
      } else {
        await apiSend(`/api/exercises/${exercise.id}`, 'PATCH', { active: true })
        toast.success(`${exercise.name} restored`)
      }
      load()
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Module 6A — Exercise Library
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {exercises.length} exercises. Coach-owned: only you add, edit or archive here.
            </p>
          </div>
          <Button className="h-12 px-6" onClick={openCreate}>
            <Plus className="w-5 h-5 mr-2" /> Add Exercise
          </Button>
        </div>
      </FadeIn>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, muscle or equipment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip label="All" active={category === ''} onClick={() => setCategory('')} />
          {EXERCISE_CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              label={cat}
              active={category === cat}
              onClick={() => setCategory(category === cat ? '' : cat)}
            />
          ))}
          <FilterChip
            label={showInactive ? 'Hiding nothing' : 'Show archived'}
            active={showInactive}
            onClick={() => setShowInactive((prev) => !prev)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">No exercises match this filter.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((exercise) => (
            <Card
              key={exercise.id}
              className={cn('border-0', !exercise.active && 'opacity-60')}
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{exercise.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full capitalize',
                          CATEGORY_COLORS[exercise.category] ?? 'bg-muted'
                        )}
                      >
                        {exercise.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                        {exercise.movementPattern}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                        {exercise.difficulty}
                      </span>
                      {exercise.trackedMovement && (
                        <Badge variant="secondary" className="text-xs">
                          tracked: {exercise.trackedMovement}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-compact
                      aria-label={`Edit ${exercise.name}`}
                      onClick={() => openEdit(exercise)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      data-compact
                      aria-label={exercise.active ? `Archive ${exercise.name}` : `Restore ${exercise.name}`}
                      onClick={() => toggleActive(exercise)}
                    >
                      {exercise.active ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">Muscles:</span>{' '}
                  {exercise.primaryMuscles.join(', ') || '—'}
                  {exercise.secondaryMuscles.length > 0 && ` (+ ${exercise.secondaryMuscles.join(', ')})`}
                </p>
                {exercise.equipment.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">Equipment:</span>{' '}
                    {exercise.equipment.join(', ')}
                  </p>
                )}
                {exercise.contraindications.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Avoid with: {exercise.contraindications.join(', ').replace(/_/g, ' ')}
                  </p>
                )}
                {exercise.loadingScheme && (
                  <p className="text-xs font-mono text-muted-foreground">{exercise.loadingScheme}</p>
                )}
                {exercise.coachNotes && (
                  <p className="text-xs text-foreground/70 italic">{exercise.coachNotes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Exercise' : 'New Exercise'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bulgarian Split Squat"
                className="h-12"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <SelectField
                label="Category"
                value={form.category}
                options={[...EXERCISE_CATEGORIES]}
                onChange={(v) => setForm({ ...form, category: v })}
              />
              <SelectField
                label="Movement Pattern"
                value={form.movementPattern}
                options={[...MOVEMENT_PATTERNS]}
                onChange={(v) => setForm({ ...form, movementPattern: v })}
              />
              <SelectField
                label="Difficulty"
                value={form.difficulty}
                options={[...DIFFICULTIES]}
                onChange={(v) => setForm({ ...form, difficulty: v })}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary Muscles</Label>
                <Input
                  value={form.primaryMuscles}
                  onChange={(e) => setForm({ ...form, primaryMuscles: e.target.value })}
                  placeholder="quadriceps, glutes"
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Muscles</Label>
                <Input
                  value={form.secondaryMuscles}
                  onChange={(e) => setForm({ ...form, secondaryMuscles: e.target.value })}
                  placeholder="core, hamstrings"
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Equipment</Label>
              <Input
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder="dumbbells, bench"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contraindications — tap the areas that make this unsafe</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRAINDICATION_AREAS.map((area) => {
                  const selected = form.contraindications.includes(area)
                  return (
                    <button
                      key={area}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          contraindications: selected
                            ? form.contraindications.filter((c) => c !== area)
                            : [...form.contraindications, area],
                        })
                      }
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-sm capitalize transition-colors',
                        selected ? 'bg-amber-500 text-white' : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      {area.replace(/_/g, ' ')}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Loading Scheme</Label>
              <Input
                value={form.loadingScheme}
                onChange={(e) => setForm({ ...form, loadingScheme: e.target.value })}
                placeholder="4x8 each side, 60s rest"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Coach Notes — cues, variations, key points</Label>
              <Textarea
                value={form.coachNotes}
                onChange={(e) => setForm({ ...form, coachNotes: e.target.value })}
                className="min-h-[80px]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <SelectField
                label="Tier"
                value={form.tier}
                options={['studio', 'advanced']}
                onChange={(v) => setForm({ ...form, tier: v })}
              />
              <SelectField
                label="Status"
                value={form.active ? 'active' : 'archived'}
                options={['active', 'archived']}
                onChange={(v) => setForm({ ...form, active: v === 'active' })}
              />
            </div>

            <Button className="w-full h-12" onClick={handleSave} loading={saving}>
              {editingId ? 'Save Changes' : 'Add to Library'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 rounded-lg border border-input bg-background px-3 capitalize"
      >
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}
