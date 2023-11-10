/*
  Warnings:

  - You are about to drop the `battle_round` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "battle_round" DROP CONSTRAINT "battle_round_battle_id_fkey";

-- DropForeignKey
ALTER TABLE "battle_round" DROP CONSTRAINT "battle_round_current_participant_id_fkey";

-- AlterTable
ALTER TABLE "battle" ADD COLUMN     "number_of_rounds" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "battle_round";

-- DropEnum
DROP TYPE "BattleRoundStatus";
