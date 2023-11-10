/*
  Warnings:

  - Added the required column `key` to the `battle_participant_thumbnail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "battle_participant_thumbnail" ADD COLUMN     "key" TEXT NOT NULL;
