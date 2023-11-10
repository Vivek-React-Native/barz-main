/*
  Warnings:

  - The values [COMPATIBLE_SCORE] on the enum `MatchAlgorithm` will be removed. If these variants are still used in the database, this will fail.

*/

-- AlterEnum
BEGIN;
CREATE TYPE "MatchAlgorithm_new" AS ENUM ('DEFAULT', 'RANDOM');
ALTER TABLE "battle_participant" ALTER COLUMN "matching_algorithm" DROP DEFAULT;
ALTER TABLE "battle_participant" ALTER COLUMN "matching_algorithm" TYPE "MatchAlgorithm_new" USING ("matching_algorithm"::text::"MatchAlgorithm_new");
ALTER TYPE "MatchAlgorithm" RENAME TO "MatchAlgorithm_old";
ALTER TYPE "MatchAlgorithm_new" RENAME TO "MatchAlgorithm";
DROP TYPE "MatchAlgorithm_old";
ALTER TABLE "battle_participant" ALTER COLUMN "matching_algorithm" SET DEFAULT 'DEFAULT';
COMMIT;

-- AlterTable
ALTER TABLE "battle_participant" ALTER COLUMN "matching_algorithm" SET DEFAULT 'DEFAULT';
