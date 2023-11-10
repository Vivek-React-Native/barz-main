-- CreateTable
CREATE TABLE "battle_export_thumbnail" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "size" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "battle_id" TEXT NOT NULL,

    CONSTRAINT "battle_export_thumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "battle_export_thumbnail_size_battle_id_key" ON "battle_export_thumbnail"("size", "battle_id");

-- AddForeignKey
ALTER TABLE "battle_export_thumbnail" ADD CONSTRAINT "battle_export_thumbnail_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
