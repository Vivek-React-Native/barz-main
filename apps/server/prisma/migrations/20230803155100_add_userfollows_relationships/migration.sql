-- CreateTable
CREATE TABLE "clerk_user_follows" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "follows_user_id" TEXT NOT NULL,
    "followed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clerk_user_follows_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "clerk_user_follows" ADD CONSTRAINT "clerk_user_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "clerk_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clerk_user_follows" ADD CONSTRAINT "clerk_user_follows_follows_user_id_fkey" FOREIGN KEY ("follows_user_id") REFERENCES "clerk_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
