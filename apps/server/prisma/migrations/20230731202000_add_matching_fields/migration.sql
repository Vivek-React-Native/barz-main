-- CreateEnum
CREATE TYPE "MatchAlgorithm" AS ENUM ('RANDOM', 'COMPATIBLE_SCORE');

-- AlterTable
ALTER TABLE "battle_participant" ADD COLUMN     "matching_algorithm" "MatchAlgorithm" NOT NULL DEFAULT 'COMPATIBLE_SCORE',
ADD COLUMN     "matching_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
