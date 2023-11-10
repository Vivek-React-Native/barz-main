/*
  Warnings:

  - You are about to drop the column `video_stream_milliseconds` on the `battle_participant_checkin` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_participant_checkin" DROP COLUMN "video_stream_milliseconds",
ADD COLUMN     "video_stream_offset_milliseconds" DOUBLE PRECISION;
