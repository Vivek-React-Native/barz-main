-- CreateTable
CREATE TABLE "battle_comment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "commented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commented_at_offset_milliseconds" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "battle_id" TEXT,
    "user_id" TEXT,

    CONSTRAINT "battle_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_comment_vote" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "comment_id" TEXT,
    "commented_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cast_by_user_id" TEXT,

    CONSTRAINT "battle_comment_vote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "battle_comment" ADD CONSTRAINT "battle_comment_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_comment" ADD CONSTRAINT "battle_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "clerk_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_comment_vote" ADD CONSTRAINT "battle_comment_vote_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "battle_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_comment_vote" ADD CONSTRAINT "battle_comment_vote_cast_by_user_id_fkey" FOREIGN KEY ("cast_by_user_id") REFERENCES "clerk_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
