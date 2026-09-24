-- CreateEnum
CREATE TYPE "cefr_level" AS ENUM ('a1', 'a2', 'b1', 'b2', 'c1');

-- CreateEnum
CREATE TYPE "competency" AS ENUM ('grammar', 'vocabulary', 'listening', 'reading', 'writing', 'speaking');

-- CreateEnum
CREATE TYPE "skill_type" AS ENUM ('grammar', 'vocab_set', 'chunk', 'function', 'pronunciation', 'register');

-- CreateEnum
CREATE TYPE "register_level" AS ENUM ('informal_spoken', 'neutral', 'formal');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "lesson_step_type" AS ENUM ('scene', 'explanation_cards', 'practice', 'free_production', 'roleplay', 'summary');

-- CreateEnum
CREATE TYPE "item_type" AS ENUM ('multiple_choice', 'listen_choose', 'order_words', 'fill_blank', 'type_answer', 'match', 'dictation', 'reading_comprehension', 'register_swap');

-- CreateEnum
CREATE TYPE "item_source" AS ENUM ('human', 'ai_draft_reviewed');

-- CreateEnum
CREATE TYPE "media_kind" AS ENUM ('audio', 'image', 'pdf');

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "type" "skill_type" NOT NULL,
    "competency" "competency" NOT NULL,
    "cefr_level" "cefr_level" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deprecated_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_prerequisites" (
    "id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,
    "prerequisite_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_patterns" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "deprecated_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "error_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_error_patterns" (
    "id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,
    "error_pattern_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_error_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_notes" (
    "id" TEXT NOT NULL,
    "spoken_form" TEXT NOT NULL,
    "standard_form" TEXT NOT NULL,
    "register" "register_level" NOT NULL,
    "explanation" TEXT NOT NULL,
    "when_to_avoid" TEXT,
    "cefr_level" "cefr_level" NOT NULL,
    "skill_id" TEXT,
    "audio_asset_id" UUID,
    "deprecated_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "cefr_level" "cefr_level" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT[],
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "cover_asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "voice_id" TEXT,
    "avatar_asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_characters" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "published_version_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_versions" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "cefr_level" "cefr_level" NOT NULL,
    "estimated_minutes" INTEGER NOT NULL DEFAULT 10,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_steps" (
    "id" UUID NOT NULL,
    "lesson_version_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "lesson_step_type" NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_target_skills" (
    "id" UUID NOT NULL,
    "lesson_version_id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_target_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_version_items" (
    "id" UUID NOT NULL,
    "lesson_version_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_version_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "slug" TEXT,
    "type" "item_type" NOT NULL,
    "prompt" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "accepted_answers" TEXT[],
    "explanation" TEXT NOT NULL,
    "error_pattern_map" JSONB NOT NULL DEFAULT '{}',
    "cefr_level" "cefr_level" NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "discrimination" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "exposure_count" INTEGER NOT NULL DEFAULT 0,
    "correct_rate" DOUBLE PRECISION,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "source" "item_source" NOT NULL DEFAULT 'human',
    "replaced_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_skills" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "skill_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "kind" "media_kind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "duration_ms" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workbooks" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "asset_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workbooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skills_cefr_level_competency_idx" ON "skills"("cefr_level", "competency");

-- CreateIndex
CREATE INDEX "skills_type_idx" ON "skills"("type");

-- CreateIndex
CREATE INDEX "skills_deprecated_at_idx" ON "skills"("deprecated_at");

-- CreateIndex
CREATE INDEX "skill_prerequisites_prerequisite_id_idx" ON "skill_prerequisites"("prerequisite_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_prerequisites_skill_id_prerequisite_id_key" ON "skill_prerequisites"("skill_id", "prerequisite_id");

-- CreateIndex
CREATE INDEX "error_patterns_deprecated_at_idx" ON "error_patterns"("deprecated_at");

-- CreateIndex
CREATE INDEX "skill_error_patterns_error_pattern_id_idx" ON "skill_error_patterns"("error_pattern_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_error_patterns_skill_id_error_pattern_id_key" ON "skill_error_patterns"("skill_id", "error_pattern_id");

-- CreateIndex
CREATE UNIQUE INDEX "register_notes_skill_id_key" ON "register_notes"("skill_id");

-- CreateIndex
CREATE INDEX "register_notes_cefr_level_idx" ON "register_notes"("cefr_level");

-- CreateIndex
CREATE INDEX "register_notes_deprecated_at_idx" ON "register_notes"("deprecated_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "levels_course_id_cefr_level_key" ON "levels"("course_id", "cefr_level");

-- CreateIndex
CREATE UNIQUE INDEX "levels_course_id_order_key" ON "levels"("course_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "units_slug_key" ON "units"("slug");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE UNIQUE INDEX "units_level_id_order_key" ON "units"("level_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "characters_slug_key" ON "characters"("slug");

-- CreateIndex
CREATE INDEX "unit_characters_character_id_idx" ON "unit_characters"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_characters_unit_id_character_id_key" ON "unit_characters"("unit_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_slug_key" ON "lessons"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_published_version_id_key" ON "lessons"("published_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_unit_id_order_key" ON "lessons"("unit_id", "order");

-- CreateIndex
CREATE INDEX "lesson_versions_status_idx" ON "lesson_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_versions_lesson_id_version_key" ON "lesson_versions"("lesson_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_steps_lesson_version_id_order_key" ON "lesson_steps"("lesson_version_id", "order");

-- CreateIndex
CREATE INDEX "lesson_target_skills_skill_id_idx" ON "lesson_target_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_target_skills_lesson_version_id_skill_id_key" ON "lesson_target_skills"("lesson_version_id", "skill_id");

-- CreateIndex
CREATE INDEX "lesson_version_items_item_id_idx" ON "lesson_version_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_version_items_lesson_version_id_item_id_key" ON "lesson_version_items"("lesson_version_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_slug_key" ON "items"("slug");

-- CreateIndex
CREATE INDEX "items_cefr_level_status_idx" ON "items"("cefr_level", "status");

-- CreateIndex
CREATE INDEX "items_status_difficulty_idx" ON "items"("status", "difficulty");

-- CreateIndex
CREATE INDEX "item_skills_skill_id_position_idx" ON "item_skills"("skill_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "item_skills_item_id_skill_id_key" ON "item_skills"("item_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_kind_idx" ON "media_assets"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "workbooks_slug_key" ON "workbooks"("slug");

-- CreateIndex
CREATE INDEX "workbooks_status_idx" ON "workbooks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workbooks_unit_id_order_key" ON "workbooks"("unit_id", "order");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_patterns" ADD CONSTRAINT "error_patterns_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "error_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_error_patterns" ADD CONSTRAINT "skill_error_patterns_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_error_patterns" ADD CONSTRAINT "skill_error_patterns_error_pattern_id_fkey" FOREIGN KEY ("error_pattern_id") REFERENCES "error_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_notes" ADD CONSTRAINT "register_notes_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_notes" ADD CONSTRAINT "register_notes_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_notes" ADD CONSTRAINT "register_notes_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "register_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_characters" ADD CONSTRAINT "unit_characters_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_characters" ADD CONSTRAINT "unit_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "lesson_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_steps" ADD CONSTRAINT "lesson_steps_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_target_skills" ADD CONSTRAINT "lesson_target_skills_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_target_skills" ADD CONSTRAINT "lesson_target_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_version_items" ADD CONSTRAINT "lesson_version_items_lesson_version_id_fkey" FOREIGN KEY ("lesson_version_id") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_version_items" ADD CONSTRAINT "lesson_version_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_skills" ADD CONSTRAINT "item_skills_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_skills" ADD CONSTRAINT "item_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
