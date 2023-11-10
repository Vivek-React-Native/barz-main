-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "current_context" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "current_state" TEXT NOT NULL DEFAULT 'CREATED';
