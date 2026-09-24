-- CreateEnum
CREATE TYPE "content_draft_kind" AS ENUM ('lesson', 'items', 'register_notes');

-- CreateEnum
CREATE TYPE "content_draft_status" AS ENUM ('queued', 'generating', 'qa_running', 'ready', 'failed', 'discarded');

-- CreateEnum
CREATE TYPE "qa_severity" AS ENUM ('info', 'warning', 'blocker');

-- CreateEnum
CREATE TYPE "comment_target" AS ENUM ('version', 'step', 'item');

-- AlterEnum
ALTER TYPE "item_source" ADD VALUE 'ai_draft';

-- AlterTable
ALTER TABLE "workbooks" ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "source_hash" TEXT;

-- CreateTable
CREATE TABLE "content_drafts" (
    "id" UUID NOT NULL,
    "kind" "content_draft_kind" NOT NULL,
    "status" "content_draft_status" NOT NULL DEFAULT 'queued',
    "params" JSONB NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "prompt_id" TEXT,
    "prompt_version" INTEGER,
    "model" TEXT,
    "cost_usd_micros" INTEGER,
    "job_id" TEXT,
    "lesson_version_id" UUID,
    "created_item_ids" UUID[],
    "created_register_note_ids" TEXT[],
    "error_code" TEXT,
    "generated_at" TIMESTAMP(3),
    "discarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_qa_reports" (
    "id" UUID NOT NULL,
    "lesson_version_id" UUID,
    "content_draft_id" UUID,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "levelStats" JSONB NOT NULL DEFAULT '{}',
    "blocker_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "info_count" INTEGER NOT NULL DEFAULT 0,
    "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_qa_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_comments" (
    "id" UUID NOT NULL,
    "lesson_version_id" UUID NOT NULL,
    "target" "comment_target" NOT NULL DEFAULT 'version',
    "target_ref" TEXT,
    "body" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_renditions" (
    "id" UUID NOT NULL,
    "text_hash" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "asset_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "char_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audio_renditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_drafts_status_created_at_idx" ON "content_drafts"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_drafts_requested_by_id_created_at_idx" ON "content_drafts"("requested_by_id", "created_at");

-- CreateIndex
CREATE INDEX "content_drafts_lesson_version_id_idx" ON "content_drafts"("lesson_version_id");

-- CreateIndex
CREATE INDEX "content_qa_reports_lesson_version_id_ran_at_idx" ON "content_qa_reports"("lesson_version_id", "ran_at");

-- CreateIndex
CREATE INDEX "content_qa_reports_content_draft_id_idx" ON "content_qa_reports"("content_draft_id");

-- CreateIndex
CREATE INDEX "content_comments_lesson_version_id_created_at_idx" ON "content_comments"("lesson_version_id", "created_at");

-- CreateIndex
CREATE INDEX "content_comments_author_id_idx" ON "content_comments"("author_id");

-- CreateIndex
CREATE INDEX "audio_renditions_asset_id_idx" ON "audio_renditions"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "audio_renditions_text_hash_voice_id_key" ON "audio_renditions"("text_hash", "voice_id");

-- AddForeignKey
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_qa_reports" ADD CONSTRAINT "content_qa_reports_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_qa_reports" ADD CONSTRAINT "content_qa_reports_content_draft_id_fkey" FOREIGN KEY ("content_draft_id") REFERENCES "content_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_renditions" ADD CONSTRAINT "audio_renditions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
