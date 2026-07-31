import {
  toContraindicationAreas,
  type ContraindicationArea,
  type MemberLevel,
  type RestrictionTag,
} from '@/lib/forge'

/**
 * Module 1 -> Modules 2 & 6.
 *
 * Turns the coach's intake answers into the two machine-readable vocabularies
 * the rest of the app filters on: weighted restriction tags (what to work on)
 * and contraindication areas (what to stay away from).
 */

export type AssessmentInput = {
  shoulderMobilityLeft?: string | null
  shoulderMobilityRight?: string | null
  hipMobilityLeft?: string | null
  hipMobilityRight?: string | null
  ankleMobilityLeft?: string | null
  ankleMobilityRight?: string | null
  thoracicMobility?: string | null
  strengthAsymmetries?: string | null
  weakPoints?: string[]
  injuryHistory?: string[]
  areasToAvoid?: string[]
  cardioLevel?: string | null
  trainingLevel?: MemberLevel
}

export type DerivedProfile = {
  /** Tag -> severity. 2 = bilateral or explicitly flagged, 1 = single side. */
  weightedTags: Partial<Record<RestrictionTag, number>>
  restrictionTags: RestrictionTag[]
  avoidAreas: ContraindicationArea[]
}

const LIMITED = new Set(['limited', 'stiff'])

/** Maps the coach's weak-point checkboxes onto restriction tags. */
const WEAK_POINT_TAGS: Array<[RegExp, RestrictionTag[]]> = [
  [/core|balance/i, ['core_stability_needed']],
  [/glute/i, ['glute_activation_needed']],
  [/posture/i, ['posture_correction', 'thoracic_stiffness']],
  [/lumbar|lower back/i, ['lumbar_control_needed', 'core_stability_needed']],
  [/hip flexor/i, ['tight_hips']],
  [/overhead/i, ['overhead_restriction', 'shoulder_mobility_limited']],
  [/calf/i, ['calf_tightness']],
]

export function deriveProfile(input: AssessmentInput): DerivedProfile {
  const weighted = new Map<RestrictionTag, number>()
  const bump = (tag: RestrictionTag, amount = 1) =>
    weighted.set(tag, Math.max(weighted.get(tag) ?? 0, amount))

  const joint = (
    left: string | null | undefined,
    right: string | null | undefined,
    limitedTag: RestrictionTag,
    asymmetryTag: RestrictionTag
  ) => {
    const l = LIMITED.has((left ?? '').toLowerCase())
    const r = LIMITED.has((right ?? '').toLowerCase())
    if (l && r) bump(limitedTag, 2)
    else if (l || r) {
      bump(limitedTag, 1)
      // One side limited and the other not is the definition of an asymmetry.
      bump(asymmetryTag, 2)
    }
  }

  joint(input.shoulderMobilityLeft, input.shoulderMobilityRight, 'shoulder_mobility_limited', 'asymmetry_shoulder')
  joint(input.hipMobilityLeft, input.hipMobilityRight, 'tight_hips', 'asymmetry_hip')
  joint(input.ankleMobilityLeft, input.ankleMobilityRight, 'ankle_dorsiflexion_limited', 'asymmetry_ankle')

  const thoracic = (input.thoracicMobility ?? '').toLowerCase()
  if (LIMITED.has(thoracic)) {
    bump('thoracic_stiffness', thoracic === 'stiff' ? 2 : 1)
    bump('posture_correction', 1)
  }

  // A stiff t-spine plus tight shoulders is what actually blocks the overhead
  // position, so flag it once both are present.
  if ((weighted.get('shoulder_mobility_limited') ?? 0) > 0 && (weighted.get('thoracic_stiffness') ?? 0) > 0) {
    bump('overhead_restriction', 2)
  }

  // Limited ankles almost always come with tight calves.
  if ((weighted.get('ankle_dorsiflexion_limited') ?? 0) > 0) bump('calf_tightness', 1)

  for (const point of input.weakPoints ?? []) {
    for (const [pattern, tags] of WEAK_POINT_TAGS) {
      if (pattern.test(point)) tags.forEach((t) => bump(t, 2))
    }
  }

  // Free-text asymmetry notes ("left hip shifts on the squat") should still
  // reach the warm-up selector.
  const asymmetryNotes = (input.strengthAsymmetries ?? '').toLowerCase()
  if (/shoulder|scap/.test(asymmetryNotes)) bump('asymmetry_shoulder', 2)
  if (/hip|glute|pelvi/.test(asymmetryNotes)) bump('asymmetry_hip', 2)
  if (/ankle|calf|foot/.test(asymmetryNotes)) bump('asymmetry_ankle', 2)
  if (/back|lumbar|spine/.test(asymmetryNotes)) bump('lumbar_control_needed', 2)

  const weightedTags = Object.fromEntries(weighted) as Partial<Record<RestrictionTag, number>>

  return {
    weightedTags,
    // Most restricted first, so consumers that just take the list get the
    // priority order for free.
    restrictionTags: [...weighted.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag),
    avoidAreas: toContraindicationAreas([
      ...(input.areasToAvoid ?? []),
      ...(input.injuryHistory ?? []),
    ]),
  }
}
