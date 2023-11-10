/*
  Warnings:

  - You are about to drop the column `computedIsWinnerOfBattle` on the `battle_participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_participant" DROP COLUMN "computedIsWinnerOfBattle",
ADD COLUMN     "computedDidWinOrTieBattle" BOOLEAN;
