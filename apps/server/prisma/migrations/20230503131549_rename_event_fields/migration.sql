/*
  Warnings:

  - You are about to drop the column `triggered_by_id` on the `battle_participant_state_machine_event` table. All the data in the column will be lost.
  - You are about to drop the column `uuid` on the `battle_participant_state_machine_event` table. All the data in the column will be lost.
  - Added the required column `client_generated_uuid` to the `battle_participant_state_machine_event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `triggered_by_participant_id` to the `battle_participant_state_machine_event` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "battle_participant_state_machine_event" DROP CONSTRAINT "battle_participant_state_machine_event_triggered_by_id_fkey";

-- AlterTable
ALTER TABLE "battle_participant_state_machine_event" DROP COLUMN "triggered_by_id",
DROP COLUMN "uuid",
ADD COLUMN     "client_generated_uuid" TEXT NOT NULL,
ADD COLUMN     "triggered_by_participant_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "battle_participant_state_machine_event" ADD CONSTRAINT "battle_participant_state_machine_event_triggered_by_partic_fkey" FOREIGN KEY ("triggered_by_participant_id") REFERENCES "battle_participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
