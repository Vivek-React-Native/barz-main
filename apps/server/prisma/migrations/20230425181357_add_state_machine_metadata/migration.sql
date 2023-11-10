/*
  Warnings:

  - Added the required column `delay_in_seconds_before_resuming` to the `battle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serialized_state_machine_state` to the `battle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "battle" ADD COLUMN     "delay_in_seconds_before_resuming" DOUBLE PRECISION,
ADD COLUMN     "serialized_state_machine_state" TEXT NOT NULL;
