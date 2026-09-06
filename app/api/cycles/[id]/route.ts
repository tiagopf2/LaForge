export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import type { CyclePlan, LegacyPlan } from '@/lib/program'
import { cycleIdSchema, updateCycleSchema } from '@/lib/validation'

/**
 * A saved cycle, with `planJson` already parsed, so the member's file can show
 * the program that was actually generated rather than just its title.
 */
export const GET = route(cycleIdSchema, async ({ input }) => {
  const cycle = await prisma.trainingCycle.findUnique({
    where: { id: input.id },
    include: { member: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!cycle) throw notFound('Cycle not found')

  const { planJson, ...rest } = cycle
  return { ...rest, ...parsePlan(planJson) }
})

/**
 * Sorts a stored plan into the shape the current generator writes and anything
 * older.
 *
 * The database still holds cycles from an earlier generator, whose plan is a
 * single `blocks` summary rather than a week-by-week `weeks` array. Handing one
 * of those to the week view renders an empty cycle, so they are separated here
 * and the page shows what the row does carry instead.
 *
 * Unparseable JSON means a hand-edited row; both fields come back null so the
 * page can say so rather than the request failing.
 */
function parsePlan(planJson: string): { plan: CyclePlan | null; legacyPlan: LegacyPlan | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(planJson)
  } catch {
    return { plan: null, legacyPlan: null }
  }

  if (isCyclePlan(parsed)) return { plan: parsed, legacyPlan: null }
  return { plan: null, legacyPlan: isLegacyPlan(parsed) ? parsed : null }
}

function isCyclePlan(value: unknown): value is CyclePlan {
  return isObject(value) && Array.isArray(value.weeks) && value.weeks.length > 0
}

function isLegacyPlan(value: unknown): value is LegacyPlan {
  return isObject(value) && isObject(value.blocks)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * The coach-validation step from the brief: a cycle only becomes assignable
 * once the coach marks it validated, and they can attach notes or an edited
 * plan at the same time.
 */
export const PATCH = route(updateCycleSchema, async ({ input }) => {
  const { id, status, ...rest } = input

  const cycle = await prisma.trainingCycle.findUnique({ where: { id }, select: { id: true } })
  if (!cycle) throw notFound('Cycle not found')

  return prisma.trainingCycle.update({
    where: { id },
    data: {
      ...rest,
      ...(status ? { status } : {}),
      ...(status === 'validated' ? { validatedAt: new Date() } : {}),
    },
  })
})
