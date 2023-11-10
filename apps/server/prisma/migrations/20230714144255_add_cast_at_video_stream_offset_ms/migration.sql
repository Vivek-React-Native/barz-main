/*
  Warnings:

  - Added the required column `cast_at_video_stream_offset_milliseconds` to the `battle_participant_vote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "battle_participant_vote" ADD COLUMN     "cast_at_video_stream_offset_milliseconds" DOUBLE PRECISION NOT NULL;
