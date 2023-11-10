/*
  Warnings:

  - You are about to drop the column `status` on the `challenge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "challenge" DROP COLUMN "status",
ADD COLUMN     "challenged_user_in_waiting_room" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "challenged_user_last_alive_at" TIMESTAMP(3),
ADD COLUMN     "created_by_user_in_waiting_room" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_by_user_last_alive_at" TIMESTAMP(3);
