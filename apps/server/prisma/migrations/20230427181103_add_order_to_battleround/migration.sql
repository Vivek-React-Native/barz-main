/*
  Warnings:

  - Added the required column `order` to the `battle_round` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "battle_round" ADD COLUMN     "order" INTEGER NOT NULL;
