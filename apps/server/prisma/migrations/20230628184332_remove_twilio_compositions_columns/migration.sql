/*
  Warnings:

  - You are about to drop the column `twilio_composition_sid` on the `battle_participant` table. All the data in the column will be lost.
  - You are about to drop the column `twilio_composition_status` on the `battle_participant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle_participant" DROP COLUMN "twilio_composition_sid",
DROP COLUMN "twilio_composition_status";
