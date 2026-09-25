-- CreateEnum
CREATE TYPE "assessment_status" AS ENUM ('in_progress', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "assessment_kind" AS ENUM ('placement', 'checkpoint');

-- CreateEnum
CREATE TYPE "writing_status" AS ENUM ('not_offered', 'pending', 'scored');

-- CreateEnum
CREATE TYPE "checkpoint_result" AS ENUM ('passed', 'passed_with_reinforcement', 'needs_reinforcement');

-- CreateTable
CREATE TABLE "learner_placement_priors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "placement_id" UUID NOT NULL,
    "overall_theta" DOUBLE PRECISION NOT NULL,
    "competency_thetas" JSONB NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_placement_priors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_tests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "assessment_status" NOT NULL DEFAULT 'in_progress',
    "start_level" "cefr_level" NOT NULL,
    "current_item_id" UUID,
    "served_item_ids" TEXT[],
    "theta" DOUBLE PRECISION,
    "standard_error" DOUBLE PRECISION,
    "overall_level" "cefr_level",
    "levels_by_competency" JSONB,
    "mastered_skill_ids" TEXT[],
    "bank_exhausted" BOOLEAN NOT NULL DEFAULT false,
    "writing_status" "writing_status" NOT NULL DEFAULT 'not_offered',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_checkpoints" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "status" "assessment_status" NOT NULL DEFAULT 'in_progress',
    "target_skill_ids" TEXT[],
    "weak_skill_ids" TEXT[],
    "current_item_id" UUID,
    "served_item_ids" TEXT[],
    "result" "checkpoint_result",
    "reinforce_skill_ids" TEXT[],
    "skill_results" JSONB,
    "score" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" UUID NOT NULL,
    "kind" "assessment_kind" NOT NULL,
    "test_id" UUID NOT NULL,
    "answer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "skillIds" TEXT[],
    "competency" "competency" NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_calibrations" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "responses" INTEGER NOT NULL,
    "p_value" DOUBLE PRECISION NOT NULL,
    "estimated_difficulty" DOUBLE PRECISION NOT NULL,
    "previous_difficulty" DOUBLE PRECISION NOT NULL,
    "applied_difficulty" DOUBLE PRECISION NOT NULL,
    "point_biserial" DOUBLE PRECISION,
    "flags" TEXT[],
    "calibrated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learner_placement_priors_user_id_key" ON "learner_placement_priors"("user_id");

-- CreateIndex
CREATE INDEX "placement_tests_user_id_completed_at_idx" ON "placement_tests"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "unit_checkpoints_user_id_unit_id_idx" ON "unit_checkpoints"("user_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_answer_id_key" ON "assessment_responses"("answer_id");

-- CreateIndex
CREATE INDEX "assessment_responses_test_id_idx" ON "assessment_responses"("test_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_test_id_position_key" ON "assessment_responses"("test_id", "position");

-- CreateIndex
CREATE INDEX "item_calibrations_item_id_calibrated_at_idx" ON "item_calibrations"("item_id", "calibrated_at");

-- CreateIndex
CREATE INDEX "item_calibrations_resolved_at_idx" ON "item_calibrations"("resolved_at");

-- AddForeignKey
ALTER TABLE "learner_placement_priors" ADD CONSTRAINT "learner_placement_priors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_checkpoints" ADD CONSTRAINT "unit_checkpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_checkpoints" ADD CONSTRAINT "unit_checkpoints_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão: o Prisma não expressa índice parcial.
-- No máximo um nivelamento aberto por aluno.
CREATE UNIQUE INDEX "placement_tests_one_open_per_user"
  ON "placement_tests"("user_id")
  WHERE "status" = 'in_progress';
