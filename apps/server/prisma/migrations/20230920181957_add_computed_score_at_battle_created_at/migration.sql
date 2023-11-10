-- AlterTable
ALTER TABLE "battle_participant"
RENAME COLUMN "user_computed_score_at_battle_started_at"
TO "user_computed_score_at_battle_created_at";
