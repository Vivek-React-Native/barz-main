-- CreateEnum
CREATE TYPE "BattleRoundStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'COMPLETE');

-- CreateTable
CREATE TABLE "battle" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "current_state" TEXT NOT NULL DEFAULT 'CREATED',
    "turn_length_seconds" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "warmup_length_seconds" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "twilio_room_name" TEXT NOT NULL,

    CONSTRAINT "battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_participant" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "battle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "twilio_access_token" TEXT NOT NULL,

    CONSTRAINT "battle_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_round" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "battle_id" TEXT NOT NULL,
    "status" "BattleRoundStatus" NOT NULL DEFAULT 'INACTIVE',
    "current_participant_id" TEXT,

    CONSTRAINT "battle_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "battle_participant_battle_id_order_key" ON "battle_participant"("battle_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "battle_participant" ADD CONSTRAINT "battle_participant_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participant" ADD CONSTRAINT "battle_participant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_round" ADD CONSTRAINT "battle_round_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_round" ADD CONSTRAINT "battle_round_current_participant_id_fkey" FOREIGN KEY ("current_participant_id") REFERENCES "battle_participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
