-- CreateTable
CREATE TABLE "review_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "kind" "review_card_kind" NOT NULL,
    "rating" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_daily_activities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "lesson_seconds" INTEGER NOT NULL DEFAULT 0,
    "practice_seconds" INTEGER NOT NULL DEFAULT 0,
    "review_seconds" INTEGER NOT NULL DEFAULT 0,
    "study_seconds" INTEGER NOT NULL DEFAULT 0,
    "lessons_started" INTEGER NOT NULL DEFAULT 0,
    "lessons_completed" INTEGER NOT NULL DEFAULT 0,
    "answers" INTEGER NOT NULL DEFAULT 0,
    "first_try_answers" INTEGER NOT NULL DEFAULT 0,
    "first_try_correct" INTEGER NOT NULL DEFAULT 0,
    "by_competency" JSONB NOT NULL DEFAULT '{}',
    "reviews_done" INTEGER NOT NULL DEFAULT 0,
    "planned_minutes" INTEGER NOT NULL DEFAULT 0,
    "ai_calls" INTEGER NOT NULL DEFAULT 0,
    "ai_cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "tier" "plan_tier" NOT NULL DEFAULT 'free',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_daily_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_platform_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "wau" INTEGER NOT NULL DEFAULT 0,
    "mau" INTEGER NOT NULL DEFAULT 0,
    "new_users" INTEGER NOT NULL DEFAULT 0,
    "lessons_started" INTEGER NOT NULL DEFAULT 0,
    "lessons_completed" INTEGER NOT NULL DEFAULT 0,
    "ai_cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_platform_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "lesson_id" UUID NOT NULL,
    "started" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "first_try_answers" INTEGER NOT NULL DEFAULT 0,
    "first_try_correct" INTEGER NOT NULL DEFAULT 0,
    "abandoned" INTEGER NOT NULL DEFAULT 0,
    "abandoned_by_step" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cost_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "feature" TEXT NOT NULL,
    "tier" "plan_tier",
    "calls" INTEGER NOT NULL DEFAULT 0,
    "cache_hits" INTEGER NOT NULL DEFAULT 0,
    "cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "users" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cost_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "tier" "plan_tier" NOT NULL,
    "active_subscribers" INTEGER NOT NULL DEFAULT 0,
    "mrr_cents" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "ai_cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_retention" (
    "id" UUID NOT NULL,
    "cohort_week" DATE NOT NULL,
    "week_offset" INTEGER NOT NULL,
    "cohort_size" INTEGER NOT NULL,
    "retained" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cohort_retention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_logs_user_id_reviewed_at_idx" ON "review_logs"("user_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "review_logs_reviewed_at_idx" ON "review_logs"("reviewed_at");

-- CreateIndex
CREATE INDEX "user_daily_activities_date_active_idx" ON "user_daily_activities"("date", "active");

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_activities_user_id_date_key" ON "user_daily_activities"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_platform_metrics_date_key" ON "daily_platform_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_daily_metrics_date_lesson_id_key" ON "lesson_daily_metrics"("date", "lesson_id");

-- CreateIndex
CREATE INDEX "ai_cost_daily_metrics_date_idx" ON "ai_cost_daily_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "plan_daily_metrics_date_tier_key" ON "plan_daily_metrics"("date", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_retention_cohort_week_week_offset_key" ON "cohort_retention"("cohort_week", "week_offset");

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_activities" ADD CONSTRAINT "user_daily_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
