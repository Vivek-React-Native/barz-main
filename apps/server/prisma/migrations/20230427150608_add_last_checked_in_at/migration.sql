-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "last_checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
