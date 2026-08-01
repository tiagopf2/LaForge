export const dynamic = 'force-dynamic'

import { notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { createAssessmentSchema } from '@/lib/validation'
import { deriveProfile } from '@/lib/assessment'

/**
 * Module 1 — every submission is a new snapshot. The newest row is the live
 * profile; older ones stay so the coach can see how a member has changed.
 */
export const POST = route(createAssessmentSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true },
  })
  if (!member) throw notFound('Member not found')

  const derived = deriveProfile(input)

  return prisma.assessment.create({
    data: {
      ...input,
      restrictionTags: derived.restrictionTags,
      avoidAreas: derived.avoidAreas,
    },
  })
})
