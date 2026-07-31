export const dynamic = 'force-dynamic'

import { route } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { TRACKED_MOVEMENTS } from '@/lib/forge'
import { getSuggestion, type Suggestion } from '@/lib/progression'
import { suggestQuerySchema } from '@/lib/validation'

/**
 * Returns the next-session recommendation for all eight tracked movements in a
 * single round trip. The tracker used to fire one request per movement, which
 * meant eight queries every time the coach picked a member.
 */
export const GET = route(suggestQuerySchema, async ({ input }) => {
  const records = await prisma.performanceRecord.findMany({
    where: { memberId: input.memberId, movementName: { in: [...TRACKED_MOVEMENTS] } },
    orderBy: { recordedAt: 'desc' },
    // 25 per movement is far more history than any rule here looks at.
    take: 25 * TRACKED_MOVEMENTS.length,
    select: {
      movementName: true,
      value: true,
      reps: true,
      sets: true,
      rpe: true,
      phase: true,
      recordedAt: true,
    },
  })

  const byMovement = new Map<string, typeof records>()
  for (const record of records) {
    const list = byMovement.get(record.movementName) ?? []
    list.push(record)
    byMovement.set(record.movementName, list)
  }

  const suggestions: Record<string, Suggestion> = {}
  for (const movement of TRACKED_MOVEMENTS) {
    suggestions[movement] = getSuggestion(movement, (byMovement.get(movement) ?? []) as never)
  }

  return suggestions
})
