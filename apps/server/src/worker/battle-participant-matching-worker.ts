import { Queue, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from 'date-fns';
import { redisConnection } from '../lib/redis.ts';
import BattleParticipant from '../lib/battle-participant.ts';
import Battle from '../lib/battle.ts';
import { BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES } from '../config.ts';

const WORKER_NAME = 'battle-participant-matching';

const RUN_BATCH_EVERY_MILLISECONDS = 5_000; // Run every 5 seconds

type Message =
  // This message is sent when a participant is initially created to attempt to match them on demand
  // with another participant. When there is an abundance of participants, it is expected this is
  // successful the majority of the time.
  | {
      version: 1;
      type: 'MATCH_ONE_PARTICIPANT';
      battleParticipantId: BattleParticipant['id'];
    }
  // This message is sent on an interval to "kick" the matching algorithm
  // and ensure that no participants get stuck in an unmatched state.
  //
  // In local development or if there are very few participants currently looking to battle, this
  // comes into play to ensure that participant matching is eventualyl accomplished.
  | {
      version: 1;
      type: 'MATCH_ALL_UNMATCHED_PARTICIPANTS';
    };

const queue = new Queue(WORKER_NAME, { connection: redisConnection });

// When called, enqueue a message to take the given participant and form a battle with them,
// containing other participant(s)
export async function queueEventToFormBattleWithParticipant(battleParticipant: BattleParticipant) {
  const message: Message = {
    version: 1,
    type: 'MATCH_ONE_PARTICIPANT',
    battleParticipantId: battleParticipant.id,
  };
  await queue.add('form-battle-with-participant', message, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export async function run(message: Message) {
  const now = new Date();
  switch (message.type) {
    case 'MATCH_ALL_UNMATCHED_PARTICIPANTS':
      const uuid = uuidv4();
      // console.log(`[${uuid}] Begin to run BATCH participant match!`);
      let matchCount = 0;
      while (true) {
        // Get two available participants
        const firstParticipant = await BattleParticipant.getAvailableParticipant();
        if (!firstParticipant) {
          break;
        }

        // If matching runs for over the time limit, then terminate the matching process
        if (
          BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES !== null &&
          now >
            addMinutes(
              firstParticipant.matchingStartedAt,
              BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES,
            )
        ) {
          console.error(
            `[${uuid}] Battle Participant with id ${firstParticipant.id} has been matching for over ${BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES} minutes, termianting matching!`,
          );
          await BattleParticipant.markInactive([firstParticipant.id], now, 'MATCHING_TIMED_OUT');
          continue;
        }

        const secondParticipant = await BattleParticipant.getAvailableParticipant(firstParticipant);
        if (!secondParticipant) {
          break;
        }

        // Match them for battle
        const battle = await Battle.create([firstParticipant, secondParticipant], 'PUBLIC');
        matchCount += 1;
        console.log(
          `[${uuid}] Participants ${firstParticipant.id} and ${secondParticipant.id} were BATCH paired to form battle ${battle.id}! (match ${matchCount} in batch)`,
        );
      }
      // console.log(`[${uuid}] Complete running BATCH participant match - ${matchCount} matches performed!`);
      return;

    case 'MATCH_ONE_PARTICIPANT':
    default:
      // Get the battle participant row from the database
      const participant = await BattleParticipant.getById(message.battleParticipantId);
      if (!participant) {
        console.error(
          `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} not found!`,
        );
        return;
      }

      if (participant.battleId !== null) {
        console.error(
          `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} seems to already be in a battle (${participant.battleId})! Skipping.`,
        );
        return;
      }

      // If matching runs for over the time limit, then terminate the matching process
      if (
        BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES !== null &&
        now >
          addMinutes(participant.matchingStartedAt, BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES)
      ) {
        console.error(
          `[${message.battleParticipantId}] Battle Participant with id ${message.battleParticipantId} has been matching for over ${BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES} minutes, termianting matching!`,
        );
        await BattleParticipant.markInactive([participant.id], now, 'MATCHING_TIMED_OUT');
        return;
      }

      // Match the given participant with other participant(s) to form a battle.
      //
      // Right now, only form battles with TWO participants
      const otherParticipant = await BattleParticipant.getAvailableParticipant(participant);
      if (!otherParticipant) {
        console.log(
          `[${message.battleParticipantId}] No other participants found to match with participant ${participant.id}... failed!`,
        );
        await BattleParticipant.markInitialParticipantMatchFailure(participant);
        return;
      }

      // Create the battle with the two participants
      const battle = await Battle.create([participant, otherParticipant], 'PUBLIC');
      console.log(
        `[${message.battleParticipantId}] Participants ${participant.id} and ${otherParticipant.id} were LIVE paired to form battle ${battle.id}!`,
      );
      return;
  }
}

export function getWorker() {
  const worker = new Worker(
    WORKER_NAME,
    async (job) => {
      try {
        await run(job.data);
      } catch (err) {
        console.error(err);
      }
    },
    { connection: redisConnection },
  );

  // Send this message periodically using `repeat` to implement a cron-esque workflow for matching
  // missed participants as a batch
  // More info: https://docs.bullmq.io/guide/jobs/repeatable
  const batchMessage: Message = { version: 1, type: 'MATCH_ALL_UNMATCHED_PARTICIPANTS' };
  queue.add('batch-match-participants', batchMessage, {
    repeat: {
      every: RUN_BATCH_EVERY_MILLISECONDS,
    },
    removeOnComplete: true,
    removeOnFail: true,
  });

  return worker;
}
