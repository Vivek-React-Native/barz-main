-- Add new ending timestamp fields
ALTER TABLE "battle_participant_vote" RENAME COLUMN "cast_at" TO "started_casting_at";
ALTER TABLE "battle_participant_vote" RENAME COLUMN "cast_at_video_stream_offset_milliseconds" TO "started_casting_at_video_stream_offset_milliseconds";
ALTER TABLE "battle_participant_vote" ADD COLUMN "ended_casting_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "battle_participant_vote" ADD COLUMN "ended_casting_at_video_stream_offset_milliseconds" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- Copy data from the starting fields into the ending fields for old votes
UPDATE "battle_participant_vote" SET "ended_casting_at" = "started_casting_at";
UPDATE "battle_participant_vote" SET "ended_casting_at_video_stream_offset_milliseconds" = "started_casting_at_video_stream_offset_milliseconds";
