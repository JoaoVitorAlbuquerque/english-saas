-- CreateEnum
CREATE TYPE "ai_call_status" AS ENUM ('ok', 'cache_hit', 'validation_error', 'provider_error');

-- CreateEnum
CREATE TYPE "ai_tier" AS ENUM ('fast', 'smart');

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "feature" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "tier" "ai_tier" NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd_micros" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "status" "ai_call_status" NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "repair_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cache_entries" (
    "id" UUID NOT NULL,
    "cache_key" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usages_user_id_created_at_idx" ON "ai_usages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usages_feature_created_at_idx" ON "ai_usages"("feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usages_created_at_idx" ON "ai_usages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_cache_entries_cache_key_key" ON "ai_cache_entries"("cache_key");

-- CreateIndex
CREATE INDEX "ai_cache_entries_prompt_id_prompt_version_idx" ON "ai_cache_entries"("prompt_id", "prompt_version");

-- CreateIndex
CREATE INDEX "ai_cache_entries_expires_at_idx" ON "ai_cache_entries"("expires_at");
