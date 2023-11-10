import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../lib/redis.ts';

import { subSeconds } from 'date-fns';
import prisma from '../lib/prisma.ts';
import Battle from '../lib/battle.ts';
import BattleParticipant from '../lib/battle-participant.ts';

import { BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS } from '../config.ts';

const WORKER_NAME = 'battle-auto-forfeit';

const RUN_EVERY_MILLISECONDS = 5_000; // Run every 5 seconds

// The battle auto forfeit worker will automatically forfeit battles where a participant goes
// offline for an extended interval of time. This is to ensure that the other participant(s) don't
// remain stuck in the battle in a non happy path scenario.
export function getWorker() {
  const worker = new Worker(
    WORKER_NAME,
    async () => {
      try {
        await run();
      } catch (err) {
        console.error(err);
      }
    },
    { connection: redisConnection },
  );

  // Send this message periodically using `repeat` to implement a cron-esque workflow
  // More info: https://docs.bullmq.io/guide/jobs/repeatable
  const queue = new Queue(WORKER_NAME, { connection: redisConnection });
  queue.add(
    'auto-forfeit-battles',
    { version: 1 },
    {
      repeat: {
        every: RUN_EVERY_MILLISECONDS,
      },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );

  return worker;
}

export async function run() {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const lastCheckedInAtMinValue = subSeconds(
        now,
        BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS +
          RUN_EVERY_MILLISECONDS / 1000,
      );

      const participantWhereSnippet = {
        OR: [
          // A participant is inactive if they are:
          {
            // 1. not online
            connectionStatus: {
              not: 'ONLINE' as const,
            },
            // 2. Haven't had a checkin in over
            // `BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS` seconds
            checkins: {
              every: {
                checkedInAt: {
                  lt: lastCheckedInAtMinValue,
                },
              },
            },
          },
          {
            // 1. Their app is backgrounded
            appState: "BACKGROUND",

            // 2. The app has been backgrounded for a while
            appStateLastChangedAt: {
              lt: lastCheckedInAtMinValue,
            }
          },
        ],
      };

      const battlesToAutoForfeit = await tx.battle.findMany({
        where: {
          // Find battles that are not already inactive
          madeInactiveAt: null,
          // AND at least one participant that is inactive:
          participants: { some: participantWhereSnippet },
        },
        include: {
          // Include the first participant that caused the battle to become inactive:
          participants: {
            select: {
              id: true,
              appState: true,
              connectionStatus: true,
              appStateLastChangedAt: true,
              checkins: {
                select: {
                  checkedInAt: true,
                },
              },
            },
            where: participantWhereSnippet,
            take: 1,
          },
        },
      });
      const battleIdsAndTriggeringParticipantIds = battlesToAutoForfeit.map((b) => {
        const participantId = b.participants.find((p) => p.id) || null;
        return [b.id, participantId] as [Battle['id'], BattleParticipant['id'] | null];
      });
      if (battleIdsAndTriggeringParticipantIds.length > 0) {
        console.log('BATTLES TO FORFEIT:', battleIdsAndTriggeringParticipantIds);
      }

      await Battle.makeBattlesInactive(
        battleIdsAndTriggeringParticipantIds,
        'AUTO_FORFEIT_DUE_TO_INACTIVITY',
        tx,
      );

      const numBattlesWithParticipantInAppStateBackground = battlesToAutoForfeit.filter(b => b.participants.find(p => p.appState === 'BACKGROUND')).length;
      if (numBattlesWithParticipantInAppStateBackground) {
        console.log(
          `Auto-forfeited ${numBattlesWithParticipantInAppStateBackground} battle(s) due to a participant backgrounding their app for a long duration.`,
        );
      }
      const numBattlesWithOfflineParticipant = battlesToAutoForfeit.length - numBattlesWithParticipantInAppStateBackground;
      if (numBattlesWithOfflineParticipant) {
        console.log(
          `Auto-forfeited ${numBattlesWithOfflineParticipant} battle(s) due to a participant going offline.`,
        );
      }
    });
}
