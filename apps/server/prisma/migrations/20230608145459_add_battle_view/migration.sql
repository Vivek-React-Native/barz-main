/*
  Warnings:

  - You are about to drop the column `last_viewed_battle_id` on the `user` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_last_viewed_battle_id_fkey";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "last_viewed_battle_id";

-- CreateTable
CREATE TABLE "battle_view" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_viewing_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battle_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "battle_view_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "battle_view" ADD CONSTRAINT "battle_view_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_view" ADD CONSTRAINT "battle_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
