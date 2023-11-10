/*
  Warnings:

  - Added the required column `uuid` to the `battle_participant_state_machine_event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "battle_participant_state_machine_event" ADD COLUMN     "uuid" TEXT NOT NULL;
