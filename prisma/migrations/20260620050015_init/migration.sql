-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('strength', 'cardio');

-- CreateEnum
CREATE TYPE "PerformancePhase" AS ENUM ('calibration', 'progression');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('upper', 'lower', 'full', 'conditioning');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hashedPassword" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'coach',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shoulderMobilityLeft" TEXT,
    "shoulderMobilityRight" TEXT,
    "shoulderNotes" TEXT,
    "hipMobilityLeft" TEXT,
    "hipMobilityRight" TEXT,
    "hipNotes" TEXT,
    "ankleMobilityLeft" TEXT,
    "ankleMobilityRight" TEXT,
    "ankleNotes" TEXT,
    "thoracicMobility" TEXT,
    "thoracicNotes" TEXT,
    "strengthAsymmetries" TEXT,
    "weakPoints" TEXT,
    "cardioLevel" TEXT,
    "injuryHistory" TEXT,
    "areasToAvoid" TEXT,
    "sportsBackground" TEXT,
    "goals" TEXT,
    "constraints" TEXT,
    "restrictionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "movementName" TEXT NOT NULL,
    "phase" "PerformancePhase" NOT NULL DEFAULT 'progression',
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "reps" INTEGER,
    "sets" INTEGER,
    "rpe" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmupSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "generalWarmup" TEXT,
    "personalDrills" TEXT,
    "coachNote" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForgeGameScore" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "benchmarkName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "scoreMonth" TEXT NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForgeGameScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCycle" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "cycleLength" INTEGER NOT NULL,
    "templateName" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Assessment_memberId_idx" ON "Assessment"("memberId");

-- CreateIndex
CREATE INDEX "PerformanceRecord_memberId_movementName_idx" ON "PerformanceRecord"("memberId", "movementName");

-- CreateIndex
CREATE INDEX "PerformanceRecord_memberId_recordedAt_idx" ON "PerformanceRecord"("memberId", "recordedAt");

-- CreateIndex
CREATE INDEX "WarmupSession_memberId_idx" ON "WarmupSession"("memberId");

-- CreateIndex
CREATE INDEX "ForgeGameScore_memberId_scoreMonth_idx" ON "ForgeGameScore"("memberId", "scoreMonth");

-- CreateIndex
CREATE INDEX "ForgeGameScore_benchmarkName_scoreMonth_idx" ON "ForgeGameScore"("benchmarkName", "scoreMonth");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmupSession" ADD CONSTRAINT "WarmupSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForgeGameScore" ADD CONSTRAINT "ForgeGameScore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCycle" ADD CONSTRAINT "TrainingCycle_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
