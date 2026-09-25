-- CreateTable
CREATE TABLE "study_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_level" "cefr_level" NOT NULL,
    "target_date" TIMESTAMP(3),
    "path" JSONB NOT NULL,
    "reinforce_skill_ids" TEXT[],
    "forecast" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_agendas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_agendas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "study_plans_user_id_key" ON "study_plans"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_agendas_user_id_local_date_key" ON "daily_agendas"("user_id", "local_date");

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_agendas" ADD CONSTRAINT "daily_agendas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
