/*
  Warnings:

  - A unique constraint covering the columns `[size,battle_participant_id]` on the table `battle_participant_thumbnail` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "battle_participant_thumbnail_size_key";

-- CreateIndex
CREATE UNIQUE INDEX "battle_participant_thumbnail_size_battle_participant_id_key" ON "battle_participant_thumbnail"("size", "battle_participant_id");
