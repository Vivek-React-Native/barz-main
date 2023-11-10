/*
  Warnings:

  - Added the required column `beat_id` to the `battle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "battle" ADD COLUMN     "beat_id" TEXT;

-- CreateTable
CREATE TABLE "battle_beat" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "beat_key" TEXT NOT NULL DEFAULT 'cliomen980000pkbdhsn1vbbz',

    CONSTRAINT "battle_beat_pkey" PRIMARY KEY ("id")
);

-- Add initial row into the table that existing models will FK with
INSERT INTO "battle_beat" (id, updated_at, beat_key) VALUES (
    'cliomen980000pkbdhsn1vbbz',
    NOW(),
    'beats/sample_quiet.mp3'
);

-- Make beat id equal to a default value for all columns
UPDATE "battle" SET "beat_id"='cliomen980000pkbdhsn1vbbz';

-- Make the column not null now that the migration has been performed
ALTER TABLE "battle" ALTER COLUMN     "beat_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "battle"
  ADD CONSTRAINT "battle_beat_id_fkey"
  FOREIGN KEY ("beat_id")
  REFERENCES "battle_beat"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
