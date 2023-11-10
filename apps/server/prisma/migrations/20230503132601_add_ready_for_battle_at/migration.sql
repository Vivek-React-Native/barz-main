/*
  Warnings:

  - You are about to drop the column `is_ready_for_battle` on the `battle_participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_participant" DROP COLUMN "is_ready_for_battle",
ADD COLUMN     "ready_for_battle_at" TIMESTAMP(3);
