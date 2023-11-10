-- AlterTable
ALTER TABLE "battle_participant" RENAME COLUMN "computedDidWinOrTieBattle" TO "computed_did_win_or_tie_battle";
ALTER TABLE "battle_participant" ADD COLUMN     "processed_video_offset_milliseconds" INTEGER NOT NULL DEFAULT 0;
