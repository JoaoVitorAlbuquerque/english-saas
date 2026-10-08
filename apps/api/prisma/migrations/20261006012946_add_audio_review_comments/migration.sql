-- CreateEnum
CREATE TYPE "audio_issue_kind" AS ENUM ('pronunciation', 'intonation', 'speed', 'noise', 'other');

-- AlterEnum
ALTER TYPE "comment_target" ADD VALUE 'audio';

-- AlterTable
ALTER TABLE "content_comments" ADD COLUMN     "audio_issue" "audio_issue_kind";
