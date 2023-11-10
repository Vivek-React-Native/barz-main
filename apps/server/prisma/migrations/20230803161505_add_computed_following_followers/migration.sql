-- AlterTable
ALTER TABLE "clerk_user" ADD COLUMN     "computed_followers_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "computed_following_count" INTEGER NOT NULL DEFAULT 0;
