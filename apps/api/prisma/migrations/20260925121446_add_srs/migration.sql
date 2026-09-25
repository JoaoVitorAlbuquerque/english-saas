-- CreateEnum
CREATE TYPE "review_card_kind" AS ENUM ('skill', 'vocab', 'chunk', 'register_note', 'error_pattern');

-- CreateEnum
CREATE TYPE "review_card_source" AS ENUM ('lesson', 'generated_material', 'tutor_feedback', 'placement');

-- CreateEnum
CREATE TYPE "review_card_state" AS ENUM ('new', 'learning', 'review', 'relearning');

-- CreateTable
CREATE TABLE "review_cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "review_card_kind" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "source" "review_card_source" NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "scheduled_days" INTEGER NOT NULL DEFAULT 0,
    "learning_steps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "review_card_state" NOT NULL DEFAULT 'new',
    "last_reviewed_at" TIMESTAMP(3),
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "srs_update_cursors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_answer_at" TIMESTAMP(3),
    "last_answer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "srs_update_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_cards_user_id_due_idx" ON "review_cards"("user_id", "due");

-- CreateIndex
CREATE UNIQUE INDEX "review_cards_user_id_kind_ref_id_key" ON "review_cards"("user_id", "kind", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "srs_update_cursors_user_id_key" ON "srs_update_cursors"("user_id");

-- AddForeignKey
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "srs_update_cursors" ADD CONSTRAINT "srs_update_cursors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
