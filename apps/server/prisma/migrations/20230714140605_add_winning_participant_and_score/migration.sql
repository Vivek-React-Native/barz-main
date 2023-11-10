-- AlterTable
ALTER TABLE "battle" ADD COLUMN     "winning_participant_id" TEXT;

-- AlterTable
ALTER TABLE "clerk_user" ADD COLUMN     "computed_score" INTEGER NOT NULL DEFAULT 1000;

-- AddForeignKey
ALTER TABLE "battle" ADD CONSTRAINT "battle_winning_participant_id_fkey" FOREIGN KEY ("winning_participant_id") REFERENCES "battle_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
