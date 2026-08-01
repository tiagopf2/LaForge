export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { buildCycle } from '@/lib/program'
import { generateProgramSchema } from '@/lib/validation'
import type { ContraindicationArea, MemberLevel, StrengthMovement } from '@/lib/forge'

/**
 * Module 6B — generates a 4-8 week cycle from the coach's own library.
 *
 * Always saved as `draft`: the brief makes the coach the final validator of
 * every program, so nothing here is assignable until they say so.
 */
export const POST = route(generateProgramSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    include: { assessments: { orderBy: { assessedAt: 'desc' }, take: 1 } },
  })
  if (!member) throw notFound('Member not found')

  const assessment = member.assessments[0]
  const level = input.level ?? (assessment?.trainingLevel as MemberLevel | undefined) ?? 'beginner'
  const avoidAreas = (assessment?.avoidAreas ?? []) as ContraindicationArea[]

  const mainMovement = (input.mainMovement ?? undefined) as StrengthMovement | undefined

  const [library, reference] = await Promise.all([
    prisma.exercise.findMany({ where: { active: true } }),
    // Latest calibration result for the main lift, so Block A can print an
    // actual kg figure instead of "reference weight".
    prisma.performanceRecord.findFirst({
      where: {
        memberId: input.memberId,
        phase: 'calibration',
        ...(mainMovement ? { movementName: mainMovement } : {}),
      },
      orderBy: { recordedAt: 'desc' },
      select: { value: true, movementName: true },
    }),
  ])

  const plan = buildCycle({
    goal: input.goal,
    level,
    sessionType: input.sessionType,
    cycleLength: input.cycleLength,
    mainMovement,
    avoidAreas,
    referenceWeightKg:
      reference && (!mainMovement || reference.movementName === mainMovement)
        ? reference.value
        : null,
    library,
  })

  const cycle = await prisma.trainingCycle.create({
    data: {
      memberId: input.memberId,
      goal: input.goal,
      sessionType: input.sessionType,
      level,
      cycleLength: input.cycleLength,
      mainMovement: plan.mainMovement,
      templateName: plan.templateName,
      planJson: JSON.stringify(plan),
      status: 'draft',
    },
  })

  return {
    cycleId: cycle.id,
    status: cycle.status,
    plan,
    message: 'Draft cycle generated. Review each block, then validate it before assigning.',
  }
})
