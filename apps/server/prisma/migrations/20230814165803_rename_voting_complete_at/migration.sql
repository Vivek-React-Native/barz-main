/*
  Warnings:

  - You are about to drop the column `voting_complete_at` on the `battle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle" DROP COLUMN "voting_complete_at",
ADD COLUMN     "voting_ends_at" TIMESTAMP(3);

-- Set default value for voting_ends_at value:
UPDATE battle
SET voting_ends_at = battle.started_at + INTERVAL '7 days'
WHERE battle.started_at IS NOT NULL;
