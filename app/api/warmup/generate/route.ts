export const dynamic = 'force-dynamic'

import { badRequest, notFound, route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { deriveProfile } from '@/lib/assessment'
import { selectWarmupDrills } from '@/lib/warmup'
import { generateWarmupSchema } from '@/lib/validation'
import type { ContraindicationArea } from '@/lib/forge'

/**
 * Module 2 — Part 2 personalised mobility.
 *
 * Re-derives the profile from the stored assessment answers rather than the
 * persisted tag list, so drill selection always reflects severity (one side
 * limited vs both) and not just which tags exist.
 */
export const POST = route(generateWarmupSchema, async ({ input }) => {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    include: { assessments: { orderBy: { assessedAt: 'desc' }, take: 1 } },
  })

  if (!member) throw notFound('Member not found')

  const assessment = member.assessments[0]
  if (!assessment) {
    throw badRequest('This member needs a body assessment before a personalised warm-up can be generated')
  }

  const profile = deriveProfile({
    shoulderMobilityLeft: assessment.shoulderMobilityLeft,
    shoulderMobilityRight: assessment.shoulderMobilityRight,
    hipMobilityLeft: assessment.hipMobilityLeft,
    hipMobilityRight: assessment.hipMobilityRight,
    ankleMobilityLeft: assessment.ankleMobilityLeft,
    ankleMobilityRight: assessment.ankleMobilityRight,
    thoracicMobility: assessment.thoracicMobility,
    strengthAsymmetries: assessment.strengthAsymmetries,
    weakPoints: assessment.weakPoints,
    injuryHistory: assessment.injuryHistory,
    areasToAvoid: assessment.areasToAvoid,
  })

  // Prefer the areas stored on the assessment; fall back to re-deriving them
  // for rows written before that column existed.
  const avoidAreas = (
    assessment.avoidAreas.length > 0 ? assessment.avoidAreas : profile.avoidAreas
  ) as ContraindicationArea[]

  const selection = selectWarmupDrills({
    sessionType: input.sessionType,
    weightedTags: profile.weightedTags,
    avoidAreas,
  })

  await prisma.warmupSession.create({
    data: {
      memberId: input.memberId,
      sessionType: input.sessionType,
      generalWarmup: input.generalWarmup,
      personalDrills: JSON.stringify(selection),
      coachNote: selection.coachNote,
    },
  })

  return { ...selection, avoidAreas, restrictionTags: profile.restrictionTags }
})
