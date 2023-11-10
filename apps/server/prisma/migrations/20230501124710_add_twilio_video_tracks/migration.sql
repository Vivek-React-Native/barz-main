-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "twilio_audio_track_id" TEXT,
ADD COLUMN     "twilio_data_track_id" TEXT,
ADD COLUMN     "twilio_video_track_id" TEXT;
