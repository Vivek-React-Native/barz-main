-- AlterTable
ALTER TABLE "challenge" ADD COLUMN     "cancelled_by_user" TEXT,
ADD COLUMN     "started_by_user" TEXT;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_started_by_user_fkey" FOREIGN KEY ("started_by_user") REFERENCES "clerk_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_cancelled_by_user_fkey" FOREIGN KEY ("cancelled_by_user") REFERENCES "clerk_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
