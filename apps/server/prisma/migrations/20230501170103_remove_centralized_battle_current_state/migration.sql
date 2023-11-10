/*
  Warnings:

  - You are about to drop the column `current_state` on the `battle` table. All the data in the column will be lost.
  - You are about to drop the column `serialized_state_machine_state` on the `battle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "battle" DROP COLUMN "current_state",
DROP COLUMN "serialized_state_machine_state";
