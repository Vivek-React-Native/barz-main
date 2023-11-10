/*
  Warnings:

  - A unique constraint covering the columns `[comment_id,cast_by_user_id,deleted_at]` on the table `battle_comment_vote` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "battle_comment_vote_comment_id_cast_by_user_id_deleted_at_key" ON "battle_comment_vote"("comment_id", "cast_by_user_id", "deleted_at");
