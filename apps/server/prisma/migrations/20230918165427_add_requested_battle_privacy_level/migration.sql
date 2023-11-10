/*
  Warnings:

  - You are about to drop the column `requested_battle_permissions_level` on the `battle_participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_participant" DROP COLUMN "requested_battle_permissions_level",
ADD COLUMN     "requested_battle_privacy_level" TEXT;
