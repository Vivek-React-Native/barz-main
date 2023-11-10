/*
  Warnings:

  - Added the required column `associated_with_battle_at` to the `battle_participant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "battle_participant" DROP CONSTRAINT "battle_participant_battle_id_fkey";

-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "associated_with_battle_at" TIMESTAMP(3),
ALTER COLUMN "battle_id" DROP NOT NULL,
ALTER COLUMN "order" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "battle_participant" ADD CONSTRAINT "battle_participant_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
