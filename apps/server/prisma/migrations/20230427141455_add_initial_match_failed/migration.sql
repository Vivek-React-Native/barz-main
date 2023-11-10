-- AlterTable
ALTER TABLE "battle" ALTER COLUMN "serialized_state_machine_state" SET DEFAULT '';

-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "initial_match_failed" BOOLEAN NOT NULL DEFAULT false;
