-- CreateTable
CREATE TABLE "battle_participant_thumbnail" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "size" INTEGER NOT NULL,
    "from_video_stream_offset_milliseconds" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "battle_participant_id" TEXT NOT NULL,

    CONSTRAINT "battle_participant_thumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "battle_participant_thumbnail_size_key" ON "battle_participant_thumbnail"("size");

-- AddForeignKey
ALTER TABLE "battle_participant_thumbnail" ADD CONSTRAINT "battle_participant_thumbnail_battle_participant_id_fkey" FOREIGN KEY ("battle_participant_id") REFERENCES "battle_participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
