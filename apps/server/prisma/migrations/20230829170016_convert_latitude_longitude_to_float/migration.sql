/*
  Warnings:

  - The `location_latitude` column on the `clerk_user` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `location_longitude` column on the `clerk_user` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "clerk_user" DROP COLUMN "location_latitude",
ADD COLUMN     "location_latitude" DOUBLE PRECISION,
DROP COLUMN "location_longitude",
ADD COLUMN     "location_longitude" DOUBLE PRECISION;
