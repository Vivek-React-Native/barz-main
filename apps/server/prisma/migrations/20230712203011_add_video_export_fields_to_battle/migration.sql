-- AlterTable
ALTER TABLE "battle" ADD COLUMN     "exported_video_completed_at" TIMESTAMP(3),
ADD COLUMN     "exported_video_key" TEXT,
ADD COLUMN     "exported_video_queued_at" TIMESTAMP(3),
ADD COLUMN     "exported_video_started_at" TIMESTAMP(3),
ADD COLUMN     "exported_video_status" TEXT;
