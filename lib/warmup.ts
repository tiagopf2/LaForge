import type { ContraindicationArea, RestrictionTag, SessionType } from '@/lib/forge'

/**
 * Module 2 — Part 2 personalised mobility.
 *
 * A fixed, coach-reviewed drill library. Deterministic on purpose: the brief
 * wants the member to read the card and work unaided, so the same profile must
 * always produce the same warm-up.
 */
export type WarmupDrill = {
  code: string
  name: string
  instructions: string
  durationSec: number
  targets: RestrictionTag[]
  contraindications: ContraindicationArea[]
  sessionTypes: SessionType[]
}

export const WARMUP_LIBRARY: WarmupDrill[] = [
  { code: 'W01', name: 'Cat-Cow Flow', instructions: '8 slow reps, breathe out as you round.', durationSec: 40, targets: ['thoracic_stiffness', 'posture_correction'], contraindications: [], sessionTypes: ['upper', 'lower', 'full'] },
  { code: 'W02', name: "World's Greatest Stretch", instructions: '4 reps each side. Drop the back knee, rotate towards the front leg.', durationSec: 45, targets: ['tight_hips', 'hip_internal_rotation_limited', 'thoracic_stiffness'], contraindications: ['hip'], sessionTypes: ['lower', 'full'] },
  { code: 'W03', name: 'Band Pull Apart', instructions: '15 controlled reps, palms down, squeeze the shoulder blades.', durationSec: 35, targets: ['shoulder_mobility_limited', 'posture_correction'], contraindications: ['shoulder'], sessionTypes: ['upper', 'full'] },
  { code: 'W04', name: 'Ankle Rocks', instructions: '10 reps each side. Heel stays glued to the floor.', durationSec: 35, targets: ['ankle_dorsiflexion_limited', 'calf_tightness'], contraindications: ['ankle'], sessionTypes: ['lower', 'full'] },
  { code: 'W05', name: 'Dead Bug', instructions: '6 reps per side. Lower back stays flat on the floor.', durationSec: 45, targets: ['core_stability_needed', 'lumbar_control_needed'], contraindications: [], sessionTypes: ['full', 'conditioning'] },
  { code: 'W06', name: 'Glute Bridge Hold', instructions: '2 x 20 seconds. Squeeze hard at the top.', durationSec: 40, targets: ['glute_activation_needed', 'tight_hips'], contraindications: ['hip'], sessionTypes: ['lower', 'full'] },
  { code: 'W07', name: 'Wall Slide', instructions: '10 reps. Keep ribs down and wrists on the wall.', durationSec: 40, targets: ['shoulder_mobility_limited', 'overhead_restriction'], contraindications: ['shoulder'], sessionTypes: ['upper', 'full'] },
  { code: 'W08', name: 'Bodyweight Squat to Reach', instructions: '8 reps, 2 second pause at the bottom.', durationSec: 40, targets: ['tight_hips', 'ankle_dorsiflexion_limited'], contraindications: ['knee'], sessionTypes: ['lower', 'full'] },
  { code: 'W09', name: 'Side Plank', instructions: '20 seconds each side. Stack the hips.', durationSec: 45, targets: ['core_stability_needed'], contraindications: ['shoulder'], sessionTypes: ['full', 'conditioning'] },
  { code: 'W10', name: 'Scap Push-Up', instructions: '12 reps. Elbows locked, move only the shoulder blades.', durationSec: 35, targets: ['shoulder_mobility_limited', 'posture_correction'], contraindications: ['wrist'], sessionTypes: ['upper', 'full'] },
  { code: 'W11', name: 'Hip Airplane (Supported)', instructions: '5 reps each side, hold the rack for balance.', durationSec: 45, targets: ['asymmetry_hip', 'glute_activation_needed', 'hip_internal_rotation_limited'], contraindications: ['hip'], sessionTypes: ['lower', 'full'] },
  { code: 'W12', name: 'Split Squat Iso Hold', instructions: '20 seconds each side. Weakest side first.', durationSec: 45, targets: ['asymmetry_hip', 'ankle_dorsiflexion_limited'], contraindications: ['knee'], sessionTypes: ['lower', 'full'] },
  { code: 'W13', name: 'Thoracic Open Book', instructions: '6 reps per side. Follow the hand with the eyes.', durationSec: 45, targets: ['thoracic_stiffness', 'overhead_restriction'], contraindications: [], sessionTypes: ['upper', 'full'] },
  { code: 'W14', name: 'Banded Lat Stretch', instructions: '20 seconds each side. Let the shoulder open.', durationSec: 40, targets: ['overhead_restriction', 'shoulder_mobility_limited'], contraindications: ['shoulder'], sessionTypes: ['upper'] },
  { code: 'W15', name: 'Calf Raise Tempo', instructions: '12 reps, 2s up / 2s down.', durationSec: 35, targets: ['calf_tightness', 'ankle_dorsiflexion_limited'], contraindications: ['ankle'], sessionTypes: ['lower', 'conditioning'] },
  { code: 'W16', name: 'Marching Glute Bridge', instructions: '8 reps each leg. Hips stay level.', durationSec: 45, targets: ['glute_activation_needed', 'lumbar_control_needed'], contraindications: ['hip'], sessionTypes: ['lower', 'full'] },
  { code: 'W17', name: 'Box Breathing', instructions: '4 cycles of 4s inhale / hold / exhale / hold.', durationSec: 40, targets: ['posture_correction'], contraindications: [], sessionTypes: ['conditioning', 'full'] },
  { code: 'W18', name: 'Bird Dog', instructions: '6 reps each side. Slow, no rocking through the hips.', durationSec: 40, targets: ['core_stability_needed', 'lumbar_control_needed'], contraindications: [], sessionTypes: ['full', 'conditioning'] },
  { code: 'W19', name: 'Knee to Wall Ankle Drill', instructions: '8 reps each side. Knee tracks over the middle toe.', durationSec: 45, targets: ['ankle_dorsiflexion_limited', 'asymmetry_ankle'], contraindications: ['ankle'], sessionTypes: ['lower'] },
  { code: 'W20', name: 'PVC Overhead Pass-Through', instructions: '10 controlled reps. Narrow the grip as it loosens.', durationSec: 40, targets: ['shoulder_mobility_limited', 'overhead_restriction'], contraindications: ['shoulder'], sessionTypes: ['upper', 'full'] },
  { code: 'W21', name: 'Single-Arm Band External Rotation', instructions: '12 reps each side. Elbow pinned to the ribs, weakest side first.', durationSec: 40, targets: ['asymmetry_shoulder', 'shoulder_mobility_limited'], contraindications: ['shoulder', 'elbow'], sessionTypes: ['upper', 'full'] },
  { code: 'W22', name: '90/90 Hip Switch', instructions: '8 slow switches. Chest tall, hands light on the floor.', durationSec: 45, targets: ['hip_internal_rotation_limited', 'tight_hips'], contraindications: ['hip', 'knee'], sessionTypes: ['lower', 'full'] },
]

/** Brief: the personalised block fits inside the 5-minute warm-up. */
export const WARMUP_BUDGET_SEC = 300

export type SelectedDrill = {
  drillCode: string
  name: string
  instructions: string
  durationSec: number
  reason: string
}

export type WarmupSelection = {
  drills: SelectedDrill[]
  totalDurationSec: number
  coachNote: string
}

/**
 * Picks drills for one member and one session type.
 *
 * `weightedTags` maps a restriction tag to how pronounced it is (2 = both
 * sides limited or an explicit weak point, 1 = one side), which is what makes
 * "most-restricted areas first" concrete.
 */
export function selectWarmupDrills({
  sessionType,
  weightedTags,
  avoidAreas,
  minDrills = 3,
  maxDrills = 5,
}: {
  sessionType: SessionType
  weightedTags: Partial<Record<RestrictionTag, number>>
  avoidAreas: ContraindicationArea[]
  minDrills?: number
  maxDrills?: number
}): WarmupSelection {
  const safeForSession = WARMUP_LIBRARY.filter(
    (drill) =>
      drill.sessionTypes.includes(sessionType) &&
      !drill.contraindications.some((area) => avoidAreas.includes(area))
  )

  const scored = safeForSession
    .map((drill) => {
      const matched = drill.targets.filter((t) => (weightedTags[t] ?? 0) > 0)
      const score = matched.reduce((sum, t) => sum + (weightedTags[t] ?? 0), 0)
      return { drill, score, matched }
    })
    // Highest relevance first; ties break on the shorter drill so more of the
    // member's restrictions fit inside the time budget.
    .sort((a, b) => b.score - a.score || a.drill.durationSec - b.drill.durationSec)

  const picked: typeof scored = []
  let total = 0

  for (const candidate of scored) {
    if (picked.length >= maxDrills) break
    // Once the member's own restrictions are covered, stop adding filler.
    if (candidate.score === 0 && picked.length >= minDrills) break
    if (total + candidate.drill.durationSec > WARMUP_BUDGET_SEC) continue
    picked.push(candidate)
    total += candidate.drill.durationSec
  }

  const drills = picked.map(({ drill, matched }) => ({
    drillCode: drill.code,
    name: drill.name,
    instructions: drill.instructions,
    durationSec: drill.durationSec,
    reason: matched.length > 0 ? describeTags(matched) : "General prep for today's session",
  }))

  const targeted = picked.filter((p) => p.score > 0).length

  return {
    drills,
    totalDurationSec: total,
    coachNote:
      targeted > 0
        ? `${targeted} of ${drills.length} drills target this member's assessed restrictions. Total ${Math.round(total / 60 * 10) / 10} min.`
        : 'No specific restrictions on file — this is the general prep set for the session type.',
  }
}

const TAG_LABELS: Record<RestrictionTag, string> = {
  shoulder_mobility_limited: 'shoulder mobility',
  overhead_restriction: 'overhead position',
  thoracic_stiffness: 'thoracic stiffness',
  posture_correction: 'posture',
  tight_hips: 'tight hips',
  hip_internal_rotation_limited: 'hip internal rotation',
  glute_activation_needed: 'glute activation',
  asymmetry_shoulder: 'shoulder asymmetry',
  asymmetry_hip: 'hip asymmetry',
  asymmetry_ankle: 'ankle asymmetry',
  ankle_dorsiflexion_limited: 'ankle dorsiflexion',
  calf_tightness: 'calf tightness',
  core_stability_needed: 'core stability',
  lumbar_control_needed: 'lower-back control',
}

function describeTags(tags: RestrictionTag[]): string {
  return tags.map((t) => TAG_LABELS[t] ?? t).join(', ')
}
