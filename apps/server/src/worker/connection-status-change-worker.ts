import { Queue, Worker } from 'bullmq';
import { subSeconds } from 'date-fns';
import prisma from '../lib/prisma.ts';
import pusher from '../lib/pusher.ts';

import { BATTLE_PARTICIPANT_CHECKIN_INACTIVITY_THRESHOLD_SECONDS } from '../config.ts';
import { redisConnection } from '../lib/redis.ts';

const WORKER_NAME = 'connection-status-change';

const RUN_EVERY_MILLISECONDS = 5_000; // Run every 5 seconds

export async function run() {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const lastCheckedInAtMinValue = subSeconds(
      now,
      BATTLE_PARTICIPANT_CHECKIN_INACTIVITY_THRESHOLD_SECONDS,
    );

    const offlineParticipantIds = (
      await tx.battleParticipant.findMany({
        select: {
          id: true,
        },
        where: {
          connectionStatus: 'ONLINE',
          checkins: {
            every: {
              checkedInAt: {
                lt: lastCheckedInAtMinValue,
              },
            },
          },
        },
      })
    ).map((n) => n.id);

    const result = await tx.battleParticipant.updateMany({
      where: {
        id: {
          in: offlineParticipantIds,
        },
      },
      data: {
        connectionStatus: 'OFFLINE',
      },
    });

    if (result.count > 0) {
      console.log(`Set ${result.count} participant connection status(es) to OFFLINE.`);
    }

    // Push updates out to clients
    const newlyOfflineParticipants = await tx.battleParticipant.findMany({
      where: {
        id: {
          in: offlineParticipantIds,
        },
      },
    });
    for (const battleParticipant of newlyOfflineParticipants) {
      pusher.trigger(
        `private-battleparticipant-${battleParticipant.id}`,
        'battleParticipant.update',
        battleParticipant,
      );
    }
  });
}

// The connection status change worker runs periodically to check if participants have reached out
// to the server recently, and if not, the participant is marked as "offline". Upon the next
// successful checkin, the participant will be marked as "online" again.
export function getWorker() {
  const worker = new Worker(
    WORKER_NAME,
    async (_job) => {
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
    'change-connection-status',
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
