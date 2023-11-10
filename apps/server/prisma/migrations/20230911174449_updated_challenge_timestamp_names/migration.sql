/*
  Warnings:

  - You are about to drop the column `accepted_at` on the `challenge` table. All the data in the column will be lost.
  - You are about to drop the column `rejected_at` on the `challenge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "challenge" DROP COLUMN "accepted_at",
DROP COLUMN "rejected_at",
ADD COLUMN     "started_at" TIMESTAMP(3);
