-- CreateTable
CREATE TABLE "battle_participant_checkin" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battle_participant_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CREATED',
    "context" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "battle_participant_checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_participant_state_machine_event" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "battle_id" TEXT NOT NULL,
    "triggered_by_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "battle_participant_state_machine_event_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "battle_participant_checkin" ADD CONSTRAINT "battle_participant_checkin_battle_participant_id_fkey" FOREIGN KEY ("battle_participant_id") REFERENCES "battle_participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participant_state_machine_event" ADD CONSTRAINT "battle_participant_state_machine_event_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participant_state_machine_event" ADD CONSTRAINT "battle_participant_state_machine_event_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "battle_participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
