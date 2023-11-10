/*
  Warnings:

  - You are about to drop the column `winning_participant_id` on the `battle` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "battle" DROP CONSTRAINT "battle_winning_participant_id_fkey";

-- AlterTable
ALTER TABLE "battle" DROP COLUMN "winning_participant_id";

-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "computedIsWinnerOfBattle" BOOLEAN;
