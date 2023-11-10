-- AlterTable
ALTER TABLE "user" ADD COLUMN     "last_viewed_battle_id" TEXT;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_last_viewed_battle_id_fkey" FOREIGN KEY ("last_viewed_battle_id") REFERENCES "battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
