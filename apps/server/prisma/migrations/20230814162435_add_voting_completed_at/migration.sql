-- AlterTable
ALTER TABLE "battle" ADD COLUMN     "voting_complete_at" TIMESTAMP(3);

UPDATE battle SET voting_complete_at = battle.started_at + INTERVAL '7 days';
