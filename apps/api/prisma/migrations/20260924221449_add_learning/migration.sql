-- CreateEnum
CREATE TYPE "lesson_attempt_status" AS ENUM ('in_progress', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "lesson_attempt_source" AS ENUM ('plan', 'free_browse', 'review');

-- CreateEnum
CREATE TYPE "answer_context" AS ENUM ('lesson', 'review', 'placement', 'checkpoint', 'generated_material');

-- CreateTable
CREATE TABLE "lesson_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "lesson_version_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "lesson_attempt_status" NOT NULL DEFAULT 'in_progress',
    "source" "lesson_attempt_source" NOT NULL DEFAULT 'free_browse',
    "current_step_index" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "abandoned_at" TIMESTAMP(3),
    "xp_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_progress" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "step_index" INTEGER NOT NULL,
    "type" "lesson_step_type" NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_spent_ms" INTEGER NOT NULL DEFAULT 0,
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "attempt_id" UUID,
    "step_index" INTEGER,
    "context" "answer_context" NOT NULL,
    "response" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "hints_used" INTEGER NOT NULL DEFAULT 0,
    "detected_error_patterns" TEXT[],
    "is_first_try" BOOLEAN NOT NULL,
    "client_answer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_stats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_study_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_attempts_user_id_started_at_idx" ON "lesson_attempts"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "lesson_attempts_user_id_lesson_id_status_idx" ON "lesson_attempts"("user_id", "lesson_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "step_progress_attempt_id_step_index_key" ON "step_progress"("attempt_id", "step_index");

-- CreateIndex
CREATE INDEX "answers_item_id_is_first_try_idx" ON "answers"("item_id", "is_first_try");

-- CreateIndex
CREATE INDEX "answers_attempt_id_item_id_idx" ON "answers"("attempt_id", "item_id");

-- CreateIndex
CREATE INDEX "answers_user_id_created_at_idx" ON "answers"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "answers_user_id_client_answer_id_key" ON "answers"("user_id", "client_answer_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_stats_user_id_key" ON "learning_stats"("user_id");

-- AddForeignKey
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_progress" ADD CONSTRAINT "step_progress_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lesson_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lesson_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_stats" ADD CONSTRAINT "learning_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão: o Prisma não expressa índice parcial.
-- No máximo uma tentativa aberta por aluno e lição. É o que torna o
-- "inicia ou retoma" seguro sob duas requisições simultâneas.
CREATE UNIQUE INDEX "lesson_attempts_one_open_per_lesson"
  ON "lesson_attempts"("user_id", "lesson_id")
  WHERE "status" = 'in_progress';
