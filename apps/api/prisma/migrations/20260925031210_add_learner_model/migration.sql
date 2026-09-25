-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "goals" "learning_goal"[] DEFAULT ARRAY[]::"learning_goal"[];

-- CreateTable
CREATE TABLE "learner_skill_states" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,
    "theta" DOUBLE PRECISION NOT NULL,
    "evidence_count" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "correct_streak" INTEGER NOT NULL DEFAULT 0,
    "last_practiced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_skill_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_error_patterns" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "error_pattern_id" TEXT NOT NULL,
    "recent_outcomes" BOOLEAN[],
    "total_occurrences" INTEGER NOT NULL DEFAULT 0,
    "last_occurred_at" TIMESTAMP(3),
    "examples" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_error_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_level_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "overall_level" "cefr_level",
    "levels" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_level_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_model_cursors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_answer_at" TIMESTAMP(3),
    "last_answer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_model_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learner_skill_states_user_id_skill_id_key" ON "learner_skill_states"("user_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_error_patterns_user_id_error_pattern_id_key" ON "learner_error_patterns"("user_id", "error_pattern_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_level_snapshots_user_id_week_start_key" ON "learner_level_snapshots"("user_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "learner_model_cursors_user_id_key" ON "learner_model_cursors"("user_id");

-- AddForeignKey
ALTER TABLE "learner_skill_states" ADD CONSTRAINT "learner_skill_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_error_patterns" ADD CONSTRAINT "learner_error_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_level_snapshots" ADD CONSTRAINT "learner_level_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_model_cursors" ADD CONSTRAINT "learner_model_cursors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
