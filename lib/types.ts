export type SessionType = 'upper' | 'lower' | 'full' | 'conditioning'

export type PerformancePhase = 'calibration' | 'progression'

export type TrackedStrengthMovement =
  | 'Back Squat'
  | 'Deadlift'
  | 'Bench Press'
  | 'Overhead Press'
  | 'Barbell Row'

export type CardioBenchmark = '500m Row' | '1km Bike Erg' | '400m Run'

export type MemberCapacitySummary = {
  activeMembers: number
  maxCapacity: 160
  utilizationPct: number
}
