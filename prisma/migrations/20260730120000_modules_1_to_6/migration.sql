-- Modules 1-6 alignment.
--
-- Converts the JSON-string columns on Assessment to real Postgres arrays,
-- promotes TrainingCycle to a validated week-by-week cycle, adds the Module 6A
-- Exercise library and the Module 3 flow-session log, and makes Forge Games
-- scores unique per member/benchmark/month.
--
-- Written by hand rather than generated so existing rows are migrated instead
-- of dropped.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE "MemberLevel" AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE "ExerciseCategory" AS ENUM ('compound', 'accessory', 'cardio', 'mobility', 'conditioning');
CREATE TYPE "MovementPattern" AS ENUM ('push', 'pull', 'hinge', 'squat', 'lunge', 'carry', 'core', 'rotation', 'cardio');
CREATE TYPE "Difficulty" AS ENUM ('all', 'beginner', 'intermediate', 'advanced');
CREATE TYPE "CycleStatus" AS ENUM ('draft', 'validated', 'archived');

-- ---------------------------------------------------------------------------
-- Assessment: JSON strings -> text[]
-- ---------------------------------------------------------------------------
ALTER TABLE "Assessment"
  ADD COLUMN "weakPoints_arr"    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "injuryHistory_arr" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "areasToAvoid_arr"  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "goals_arr"         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "avoidAreas"        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "trainingLevel"     "MemberLevel" NOT NULL DEFAULT 'beginner';

UPDATE "Assessment"
SET "weakPoints_arr" = COALESCE(
  (SELECT array_agg(v) FROM jsonb_array_elements_text(btrim("weakPoints")::jsonb) v),
  '{}'
)
WHERE "weakPoints" IS NOT NULL AND btrim("weakPoints") LIKE '[%';

UPDATE "Assessment"
SET "injuryHistory_arr" = COALESCE(
  (SELECT array_agg(v) FROM jsonb_array_elements_text(btrim("injuryHistory")::jsonb) v),
  '{}'
)
WHERE "injuryHistory" IS NOT NULL AND btrim("injuryHistory") LIKE '[%';

UPDATE "Assessment"
SET "areasToAvoid_arr" = COALESCE(
  (SELECT array_agg(v) FROM jsonb_array_elements_text(btrim("areasToAvoid")::jsonb) v),
  '{}'
)
WHERE "areasToAvoid" IS NOT NULL AND btrim("areasToAvoid") LIKE '[%';

UPDATE "Assessment"
SET "goals_arr" = COALESCE(
  (SELECT array_agg(v) FROM jsonb_array_elements_text(btrim("goals")::jsonb) v),
  '{}'
)
WHERE "goals" IS NOT NULL AND btrim("goals") LIKE '[%';

-- Values that were plain text rather than a JSON array survive as one entry.
UPDATE "Assessment" SET "weakPoints_arr"    = ARRAY["weakPoints"]    WHERE "weakPoints"    IS NOT NULL AND btrim("weakPoints")    <> '' AND btrim("weakPoints")    NOT LIKE '[%';
UPDATE "Assessment" SET "injuryHistory_arr" = ARRAY["injuryHistory"] WHERE "injuryHistory" IS NOT NULL AND btrim("injuryHistory") <> '' AND btrim("injuryHistory") NOT LIKE '[%';
UPDATE "Assessment" SET "areasToAvoid_arr"  = ARRAY["areasToAvoid"]  WHERE "areasToAvoid"  IS NOT NULL AND btrim("areasToAvoid")  <> '' AND btrim("areasToAvoid")  NOT LIKE '[%';
UPDATE "Assessment" SET "goals_arr"         = ARRAY["goals"]         WHERE "goals"         IS NOT NULL AND btrim("goals")         <> '' AND btrim("goals")         NOT LIKE '[%';

ALTER TABLE "Assessment"
  DROP COLUMN "weakPoints",
  DROP COLUMN "injuryHistory",
  DROP COLUMN "areasToAvoid",
  DROP COLUMN "goals";

ALTER TABLE "Assessment" RENAME COLUMN "weakPoints_arr"    TO "weakPoints";
ALTER TABLE "Assessment" RENAME COLUMN "injuryHistory_arr" TO "injuryHistory";
ALTER TABLE "Assessment" RENAME COLUMN "areasToAvoid_arr"  TO "areasToAvoid";
ALTER TABLE "Assessment" RENAME COLUMN "goals_arr"         TO "goals";

-- Back-fill the canonical avoid areas from the free-text entries.
UPDATE "Assessment" SET "avoidAreas" = (
  SELECT COALESCE(array_agg(DISTINCT area), '{}')
  FROM (
    SELECT CASE
      WHEN lower(t) ~ 'lower back|low back|lumbar|sciatic|disc' THEN 'lower_back'
      WHEN lower(t) ~ 'shoulder|rotator|cuff|impingement|labrum' THEN 'shoulder'
      WHEN lower(t) ~ 'elbow'    THEN 'elbow'
      WHEN lower(t) ~ 'wrist|carpal' THEN 'wrist'
      WHEN lower(t) ~ 'knee|acl|mcl|meniscus|patell' THEN 'knee'
      WHEN lower(t) ~ 'ankle|achilles' THEN 'ankle'
      WHEN lower(t) ~ 'hip|piriformis' THEN 'hip'
      WHEN lower(t) ~ 'neck|cervical' THEN 'neck'
      WHEN lower(t) ~ 'groin|adductor' THEN 'adductor'
      ELSE NULL
    END AS area
    FROM unnest("areasToAvoid" || "injuryHistory") AS t
  ) mapped
  WHERE area IS NOT NULL
);

DROP INDEX IF EXISTS "Assessment_memberId_idx";
CREATE INDEX "Assessment_memberId_assessedAt_idx" ON "Assessment"("memberId", "assessedAt");

-- ---------------------------------------------------------------------------
-- Member
-- ---------------------------------------------------------------------------
CREATE INDEX "Member_active_lastName_idx" ON "Member"("active", "lastName");

-- ---------------------------------------------------------------------------
-- TrainingCycle: typed session, validation workflow, main movement
-- ---------------------------------------------------------------------------
UPDATE "TrainingCycle"
SET "sessionType" = 'full'
WHERE "sessionType" IS NULL OR "sessionType" NOT IN ('upper', 'lower', 'full', 'conditioning');

ALTER TABLE "TrainingCycle"
  ALTER COLUMN "sessionType" TYPE "SessionType" USING "sessionType"::"SessionType";

ALTER TABLE "TrainingCycle"
  ADD COLUMN "level"        "MemberLevel" NOT NULL DEFAULT 'beginner',
  ADD COLUMN "mainMovement" TEXT,
  ADD COLUMN "status"       "CycleStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "coachNotes"   TEXT,
  ADD COLUMN "validatedAt"  TIMESTAMP(3),
  ADD COLUMN "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Recover the main movement from the previously stored plan JSON where possible.
UPDATE "TrainingCycle"
SET "mainMovement" = COALESCE(
  NULLIF(("planJson"::jsonb #>> '{blocks,blockA,movement}'), ''),
  'Back Squat'
)
WHERE "mainMovement" IS NULL;

UPDATE "TrainingCycle" SET "mainMovement" = 'Back Squat' WHERE "mainMovement" IS NULL;
ALTER TABLE "TrainingCycle" ALTER COLUMN "mainMovement" SET NOT NULL;
ALTER TABLE "TrainingCycle" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX "TrainingCycle_memberId_status_idx" ON "TrainingCycle"("memberId", "status");

-- ---------------------------------------------------------------------------
-- PerformanceRecord: link results to the cycle they were produced in
-- ---------------------------------------------------------------------------
ALTER TABLE "PerformanceRecord" ADD COLUMN "cycleId" TEXT;

ALTER TABLE "PerformanceRecord"
  ADD CONSTRAINT "PerformanceRecord_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "TrainingCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "PerformanceRecord_memberId_movementName_idx";
CREATE INDEX "PerformanceRecord_memberId_movementName_recordedAt_idx" ON "PerformanceRecord"("memberId", "movementName", "recordedAt");
CREATE INDEX "PerformanceRecord_cycleId_idx" ON "PerformanceRecord"("cycleId");

-- ---------------------------------------------------------------------------
-- WarmupSession
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS "WarmupSession_memberId_idx";
CREATE INDEX "WarmupSession_memberId_generatedAt_idx" ON "WarmupSession"("memberId", "generatedAt");

-- ---------------------------------------------------------------------------
-- ForgeGameScore: one score per benchmark per month
-- ---------------------------------------------------------------------------
ALTER TABLE "ForgeGameScore"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ForgeGameScore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Keep only the most recent score if the old schema allowed duplicates.
DELETE FROM "ForgeGameScore" a
USING "ForgeGameScore" b
WHERE a."memberId" = b."memberId"
  AND a."benchmarkName" = b."benchmarkName"
  AND a."scoreMonth" = b."scoreMonth"
  AND (a."recordedAt" < b."recordedAt" OR (a."recordedAt" = b."recordedAt" AND a."id" < b."id"));

DROP INDEX IF EXISTS "ForgeGameScore_benchmarkName_scoreMonth_idx";
CREATE UNIQUE INDEX "ForgeGameScore_memberId_benchmarkName_scoreMonth_key" ON "ForgeGameScore"("memberId", "benchmarkName", "scoreMonth");

-- ---------------------------------------------------------------------------
-- SessionLog (Module 3 flow sessions)
-- ---------------------------------------------------------------------------
CREATE TABLE "SessionLog" (
  "id"          TEXT NOT NULL,
  "memberId"    TEXT NOT NULL,
  "sessionType" "SessionType" NOT NULL,
  "flowSession" BOOLEAN NOT NULL DEFAULT true,
  "notes"       TEXT,
  "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SessionLog_memberId_sessionDate_idx" ON "SessionLog"("memberId", "sessionDate");

ALTER TABLE "SessionLog"
  ADD CONSTRAINT "SessionLog_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Exercise (Module 6A library)
-- ---------------------------------------------------------------------------
CREATE TABLE "Exercise" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "category"          "ExerciseCategory" NOT NULL,
  "primaryMuscles"    TEXT[] NOT NULL DEFAULT '{}',
  "secondaryMuscles"  TEXT[] NOT NULL DEFAULT '{}',
  "movementPattern"   "MovementPattern" NOT NULL,
  "difficulty"        "Difficulty" NOT NULL DEFAULT 'all',
  "equipment"         TEXT[] NOT NULL DEFAULT '{}',
  "contraindications" TEXT[] NOT NULL DEFAULT '{}',
  "loadingScheme"     TEXT,
  "coachNotes"        TEXT,
  "trackedMovement"   TEXT,
  "tier"              TEXT NOT NULL DEFAULT 'studio',
  "active"            BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");
CREATE INDEX "Exercise_category_active_idx" ON "Exercise"("category", "active");
CREATE INDEX "Exercise_movementPattern_active_idx" ON "Exercise"("movementPattern", "active");
