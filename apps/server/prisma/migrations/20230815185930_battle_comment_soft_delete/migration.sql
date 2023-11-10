/*
  Warnings:

  - Made the column `battle_id` on table `battle_comment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `user_id` on table `battle_comment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `comment_id` on table `battle_comment_vote` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cast_by_user_id` on table `battle_comment_vote` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "battle_comment" DROP CONSTRAINT "battle_comment_battle_id_fkey";

-- DropForeignKey
ALTER TABLE "battle_comment" DROP CONSTRAINT "battle_comment_user_id_fkey";

-- DropForeignKey
ALTER TABLE "battle_comment_vote" DROP CONSTRAINT "battle_comment_vote_cast_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "battle_comment_vote" DROP CONSTRAINT "battle_comment_vote_comment_id_fkey";

-- AlterTable
ALTER TABLE "battle_comment" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "battle_id" SET NOT NULL,
ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "battle_comment_vote" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "comment_id" SET NOT NULL,
ALTER COLUMN "cast_by_user_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "battle_comment" ADD CONSTRAINT "battle_comment_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_comment" ADD CONSTRAINT "battle_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "clerk_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_comment_vote" ADD CONSTRAINT "battle_comment_vote_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "battle_comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_comment_vote" ADD CONSTRAINT "battle_comment_vote_cast_by_user_id_fkey" FOREIGN KEY ("cast_by_user_id") REFERENCES "clerk_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
