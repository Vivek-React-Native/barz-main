-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "processed_video_key" TEXT;

-- AlterTable
ALTER TABLE "clerk_user" RENAME CONSTRAINT "user_pkey" TO "clerk_user_pkey";

-- RenameIndex
ALTER INDEX "user_clerk_id_key" RENAME TO "clerk_user_clerk_id_key";
