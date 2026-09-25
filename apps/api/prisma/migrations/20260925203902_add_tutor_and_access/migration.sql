-- CreateEnum
CREATE TYPE "tutor_input_source" AS ENUM ('text', 'audio');

-- CreateEnum
CREATE TYPE "tutor_correction_status" AS ENUM ('transcribing', 'queued', 'done', 'refused', 'failed');

-- CreateEnum
CREATE TYPE "roleplay_status" AS ENUM ('active', 'finished');

-- CreateEnum
CREATE TYPE "roleplay_role" AS ENUM ('student', 'character');

-- CreateEnum
CREATE TYPE "roleplay_turn_status" AS ENUM ('pending', 'done', 'failed');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "first_payment_discount_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upgrades_from_id" UUID;

-- CreateTable
CREATE TABLE "tutor_corrections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID,
    "lesson_version_id" UUID,
    "step_index" INTEGER,
    "text" TEXT NOT NULL,
    "source" "tutor_input_source" NOT NULL DEFAULT 'text',
    "audio_key" TEXT,
    "status" "tutor_correction_status" NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "error_code" TEXT,
    "credit_reservation_id" UUID,
    "client_request_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roleplay_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID,
    "lesson_version_id" UUID,
    "step_index" INTEGER,
    "character_id" UUID,
    "scenario" TEXT NOT NULL,
    "free_scenario" BOOLEAN NOT NULL DEFAULT false,
    "goals" JSONB NOT NULL,
    "goals_met" TEXT[],
    "max_turns" INTEGER NOT NULL,
    "vocabulary_level" "cefr_level" NOT NULL,
    "status" "roleplay_status" NOT NULL DEFAULT 'active',
    "student_turns" INTEGER NOT NULL DEFAULT 0,
    "strikes" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "credit_reservation_id" UUID,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roleplay_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roleplay_turns" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "role" "roleplay_role" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "roleplay_turn_status" NOT NULL DEFAULT 'done',
    "feedback" JSONB,
    "client_turn_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roleplay_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_corrections_user_id_created_at_idx" ON "tutor_corrections"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_corrections_user_id_client_request_id_key" ON "tutor_corrections"("user_id", "client_request_id");

-- CreateIndex
CREATE INDEX "roleplay_sessions_user_id_created_at_idx" ON "roleplay_sessions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roleplay_turns_session_id_index_key" ON "roleplay_turns"("session_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "roleplay_turns_session_id_client_turn_id_key" ON "roleplay_turns"("session_id", "client_turn_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_upgrades_from_id_fkey" FOREIGN KEY ("upgrades_from_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_corrections" ADD CONSTRAINT "tutor_corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleplay_sessions" ADD CONSTRAINT "roleplay_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleplay_turns" ADD CONSTRAINT "roleplay_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "roleplay_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão: o Prisma não expressa índice parcial.
-- Upgrade: uma assinatura em uso (ACTIVE/PAST_DUE) pode conviver com uma
-- PENDING de tier maior. O índice único antigo cobria as três juntas.
DROP INDEX "subscriptions_one_open_per_user";

CREATE UNIQUE INDEX "subscriptions_one_active_per_user"
  ON "subscriptions"("user_id")
  WHERE "status" IN ('active', 'past_due');

CREATE UNIQUE INDEX "subscriptions_one_pending_per_user"
  ON "subscriptions"("user_id")
  WHERE "status" = 'pending';
