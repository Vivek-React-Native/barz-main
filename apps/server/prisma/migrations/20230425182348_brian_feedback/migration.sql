/*
  Warnings:

  - You are about to drop the column `twilio_access_token` on the `battle_participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_participant" DROP COLUMN "twilio_access_token";

-- AlterTable
ALTER TABLE "battle_round" ADD COLUMN     "started_at" TIMESTAMP(3);
