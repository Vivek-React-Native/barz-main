-- CreateTable
CREATE TABLE "battle_participant_vote" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cast_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cast_by_user_id" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "battle_participant_id" TEXT NOT NULL,

    CONSTRAINT "battle_participant_vote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "battle_participant_vote" ADD CONSTRAINT "battle_participant_vote_cast_by_user_id_fkey" FOREIGN KEY ("cast_by_user_id") REFERENCES "clerk_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participant_vote" ADD CONSTRAINT "battle_participant_vote_battle_participant_id_fkey" FOREIGN KEY ("battle_participant_id") REFERENCES "battle_participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
