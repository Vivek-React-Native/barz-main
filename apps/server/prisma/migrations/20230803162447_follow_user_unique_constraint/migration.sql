/*
  Warnings:

  - A unique constraint covering the columns `[user_id,follows_user_id]` on the table `clerk_user_follows` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "clerk_user_follows_user_id_follows_user_id_key" ON "clerk_user_follows"("user_id", "follows_user_id");
