export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import type { CyclePlan } from '@/lib/program'
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
  return { ...rest, plan: parsePlan(planJson) }
})

/**
 * A plan is written by the generator and only ever edited through the schema,
 * so bad JSON here means a hand-edited row. Returning null lets the page say
 * so instead of failing the whole request.
 */
function parsePlan(planJson: string): CyclePlan | null {
  try {
    return JSON.parse(planJson) as CyclePlan
  } catch {
    return null
  }
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
