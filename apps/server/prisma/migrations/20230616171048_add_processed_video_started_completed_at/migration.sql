-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "processed_video_completed_at" TIMESTAMP(3),
ADD COLUMN     "processed_video_started_at" TIMESTAMP(3);
