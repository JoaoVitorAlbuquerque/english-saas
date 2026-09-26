-- CreateEnum
CREATE TYPE "generation_kind" AS ENUM ('suggest', 'topic', 'ingest');

-- CreateEnum
CREATE TYPE "generation_status" AS ENUM ('queued', 'running', 'done', 'refused', 'failed');

-- CreateEnum
CREATE TYPE "source_provider" AS ENUM ('wikipedia');

-- CreateEnum
CREATE TYPE "material_kind" AS ENUM ('topic', 'ingest');

-- CreateEnum
CREATE TYPE "material_difficulty_feedback" AS ENUM ('too_easy', 'ok', 'too_hard');

-- AlterEnum
ALTER TYPE "item_source" ADD VALUE 'ai_generated';

-- AlterEnum
ALTER TYPE "review_card_kind" ADD VALUE 'term';

-- CreateTable
CREATE TABLE "study_terms" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "normalized_term" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "cefr_level" "cefr_level" NOT NULL,
    "source" "review_card_source" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "generation_kind" NOT NULL,
    "status" "generation_status" NOT NULL DEFAULT 'queued',
    "steps" JSONB NOT NULL,
    "current_step" TEXT,
    "interest_text" TEXT,
    "suggestions" JSONB,
    "chosen" JSONB,
    "input_text" TEXT,
    "input_url" TEXT,
    "source_document_id" UUID,
    "analysis" JSONB,
    "targets" JSONB,
    "base_id" UUID,
    "draft" JSONB,
    "exercises" JSONB,
    "material_id" UUID,
    "credit_reservation_id" UUID,
    "client_request_id" TEXT,
    "error_code" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_documents" (
    "id" UUID NOT NULL,
    "provider" "source_provider" NOT NULL,
    "page_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "revision_id" BIGINT NOT NULL,
    "license" TEXT NOT NULL,
    "license_url" TEXT NOT NULL,
    "extract" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_bases" (
    "id" UUID NOT NULL,
    "cache_key" TEXT NOT NULL,
    "source_document_id" UUID NOT NULL,
    "level" "cefr_level" NOT NULL,
    "target_skill_ids" TEXT[],
    "register_note_ids" TEXT[],
    "content" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_materials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "material_kind" NOT NULL,
    "base_id" UUID,
    "content" JSONB,
    "title" TEXT NOT NULL,
    "level" "cefr_level" NOT NULL,
    "topic" TEXT NOT NULL,
    "target_skill_ids" TEXT[],
    "register_note_ids" TEXT[],
    "snapshot_used" JSONB NOT NULL,
    "attribution" JSONB,
    "reference_url" TEXT,
    "item_ids" TEXT[],
    "term_ids" TEXT[],
    "rating" INTEGER,
    "difficulty" "material_difficulty_feedback",
    "feedback_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "study_terms_user_id_normalized_term_key" ON "study_terms"("user_id", "normalized_term");

-- CreateIndex
CREATE INDEX "generation_jobs_user_id_created_at_idx" ON "generation_jobs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_user_id_client_request_id_key" ON "generation_jobs"("user_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_documents_provider_page_id_revision_id_key" ON "source_documents"("provider", "page_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_bases_cache_key_key" ON "material_bases"("cache_key");

-- CreateIndex
CREATE INDEX "generated_materials_user_id_created_at_idx" ON "generated_materials"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "study_terms" ADD CONSTRAINT "study_terms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_bases" ADD CONSTRAINT "material_bases_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_materials" ADD CONSTRAINT "generated_materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_materials" ADD CONSTRAINT "generated_materials_base_id_fkey" FOREIGN KEY ("base_id") REFERENCES "material_bases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
