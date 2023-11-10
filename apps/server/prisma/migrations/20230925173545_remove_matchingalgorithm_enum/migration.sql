-- AlterTable
ALTER TABLE "battle_participant" RENAME COLUMN "matching_algorithm" TO "matching_algorithm_old";
ALTER TABLE "battle_participant" ADD COLUMN "matching_algorithm" TEXT NOT NULL DEFAULT 'DEFAULT';

-- migrate old data to new column
UPDATE "battle_participant" SET matching_algorithm='DEFAULT' WHERE matching_algorithm='DEFAULT';
UPDATE "battle_participant" SET matching_algorithm='RANDOM' WHERE matching_algorithm='RANDOM';

ALTER TABLE "battle_participant" DROP COLUMN "matching_algorithm_old";

-- DropEnum
DROP TYPE "MatchAlgorithm";
