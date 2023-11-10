import { BattleParticipant as PrismaBattleParticipant } from '@prisma/client';
import { subMilliseconds } from 'date-fns';
import prisma, { PrismaTransaction } from './prisma.ts';
import {
  BattleStateMachineTypestate,
  BattleStateMachineEvent,
  BattleStateMachineContext,
} from './battle-state-machine.ts';
import Battle, { BattleWithParticipants } from './battle.ts';
import delay from './delay.ts';
import pusher from './pusher.ts';
import User, { UserMe, USER_MAX_VOTES_PER_BATTLE } from './user.ts';
import { BATTLE_PARTICIPANT_MATCHING_SCORE_TABLE } from '../config.ts';
import { BattlePrivacyLevel } from './battle.ts';

import { queueEventToGenerateBattleParticipantVideo } from '../worker/battle-participant-video-generation-worker.ts';

type BattleParticipant = PrismaBattleParticipant & {
  user: User;
};

const DEFAULT_INCLUDE = {
  user: {
    select: {
      id: true,
      handle: true,
      name: true,
      profileImageUrl: true,
      computedScore: true,
      computedFollowersCount: true,
      computedFollowingCount: true,
    },
  },
};

type BattleParticipantWhere = NonNullable<
  NonNullable<Parameters<typeof prisma.battleParticipant.findMany>[0]>['where']
>;
type BattleParticipantWhereSimple = Pick<BattleParticipantWhere, keyof BattleParticipant>;

const BattleParticipant = {
  async all(
    page: number,
    pageSize: number,
    sort?: [keyof BattleParticipant, 'asc' | 'desc'],
    filter?: BattleParticipantWhereSimple,
  ) {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    return prisma.battleParticipant.findMany({
      // Allow arbitrary sorting
      // orderBy: sort ? {
      //   [sort[0]]: { sort: sort[1], nulls: 'last' },
      // } : { createdAt: 'desc' },
      orderBy: sort
        ? {
            [sort[0]]: sort[1],
          }
        : { createdAt: 'desc' },

      // Allow arbitrary filtering
      where: filter,

      include: DEFAULT_INCLUDE,
      skip,
      take,
    });
  },

  async count(filter?: BattleParticipantWhereSimple) {
    return prisma.battleParticipant.count({ where: filter });
  },

  async create(
    userId: User['id'],
    tx: PrismaTransaction = prisma,
    now: Date = new Date(),
  ): Promise<BattleParticipant> {
    return BattleParticipant.createWithAlgorithm(userId, undefined, tx, now);
  },

  async createWithAlgorithm(
    userId: User['id'],
    matchingAlgorithm?: BattleParticipant['matchingAlgorithm'],
    tx: PrismaTransaction = prisma,
    now: Date = new Date(),
  ): Promise<BattleParticipant> {
    return tx.battleParticipant.create({
      data: {
        userId: userId,
        connectionStatus: 'ONLINE',
        matchingAlgorithm,

        // NOTE: seed an initial checkin into the checkin list when creating a new participant
        // This ensures that when the auto forfeit worker runs, there is always at least one check
        // in record for it to look at
        checkins: {
          create: {
            checkedInAt: now,
          },
        },
      },
      include: DEFAULT_INCLUDE,
    });
  },

  async getById(id: BattleParticipant['id']): Promise<BattleParticipant | null> {
    return prisma.battleParticipant.findUnique({
      where: { id },
      include: DEFAULT_INCLUDE,
    });
  },

  async getByIds(ids: Array<BattleParticipant['id']>): Promise<Array<BattleParticipant>> {
    return prisma.battleParticipant.findMany({
      where: { id: { in: ids } },
      include: DEFAULT_INCLUDE,
    });
  },

  async refreshFromDatabase(
    battleParticipant: Pick<BattleParticipant, 'id'>,
  ): Promise<BattleParticipant> {
    const updatedBattleParticipant = await BattleParticipant.getById(battleParticipant.id);
    if (!updatedBattleParticipant) {
      throw new Error(
        `Error refreshing battle participant from database: battle participant ${battleParticipant.id} not found!`,
      );
    }
    return updatedBattleParticipant;
  },

  async getByIdInContextOfUserMe(
    id: BattleParticipant['id'],
    userMe: UserMe,
    operationType: 'read' | 'live-read' | 'write',
  ) {
    const result = await prisma.battleParticipant.findMany({
      where: {
        OR: [
          // A user can always READ and WRITE their own participants
          {
            id,
            user: { id: userMe.id },
          },

          // A user should be able to READ participants associated with battles they are part of,
          // even if they are not
          operationType === 'read' || operationType === 'live-read'
            ? {
                id,
                battle: {
                  participants: {
                    some: {
                      user: { id: userMe.id },
                    },
                  },
                },
              }
            : {},
        ],
      },
      include: {
        ...DEFAULT_INCLUDE,

        // NOTE: this field is being included for the POST /participants/:id/twilio-token endpoint
        battle: {
          select: {
            twilioRoomName: true,
          },
        },
      },
      take: 1,
    });

    if (result.length > 0) {
      return result[0];
    } else {
      return null;
    }
  },

  async getFirstParticipantAssociatedWithBattleWithTwilioVideoTrack(
    battleId: BattleParticipant['battleId'],
    twilioVideoTrackId: BattleParticipant['twilioVideoTrackId'],
  ): Promise<BattleParticipant | null> {
    return prisma.battleParticipant.findFirst({
      where: {
        battleId: battleId,
        twilioVideoTrackId: twilioVideoTrackId,
      },
      include: DEFAULT_INCLUDE,
    });
  },

  async getFirstParticipantAssociatedWithBattleWithTwilioAudioTrack(
    battleId: BattleParticipant['battleId'],
    twilioAudioTrackId: BattleParticipant['twilioAudioTrackId'],
  ): Promise<BattleParticipant | null> {
    return prisma.battleParticipant.findFirst({
      where: {
        battleId: battleId,
        twilioAudioTrackId: twilioAudioTrackId,
      },
      include: DEFAULT_INCLUDE,
    });
  },

  // Called when a client checks in with the server to indicate that they are still active
  async performCheckin(
    battleParticipant: BattleParticipant,
    videoStreamOffsetMilliseconds: number | null,
    currentState?: BattleStateMachineTypestate['value'],
    currentContext?: BattleStateMachineContext,
  ) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const latestBattleParticipant = await tx.battleParticipant.update({
        where: {
          id: battleParticipant.id,
        },
        data: {
          connectionStatus: 'ONLINE',

          currentState,
          currentContext,

          // If a new current state and current context were passed, then register a check in
          checkins: {
            create: {
              checkedInAt: now,
              videoStreamOffsetMilliseconds: videoStreamOffsetMilliseconds || null,
              state: currentState || battleParticipant.currentState,
              context:
                currentContext || (battleParticipant.currentContext as BattleStateMachineContext),
            },
          },
        },
      });

      if (
        latestBattleParticipant.currentState !== battleParticipant.currentState ||
        latestBattleParticipant.currentContext !== battleParticipant.currentContext
      ) {
        pusher.trigger(
          `private-battleparticipant-${latestBattleParticipant.id}`,
          'battleParticipant.update',
          latestBattleParticipant,
        );
      }

      // If all of the client state machines have gotten to the end ("COMPLETE" state),
      // then complete the battle.
      const numberOfParticipants = await tx.battleParticipant.count({
        where: {
          battleId: latestBattleParticipant.battleId,
        },
      });
      const numberOfParticipantsThatAreInCompleteState = await tx.battleParticipant.count({
        where: {
          battleId: latestBattleParticipant.battleId,
          currentState: 'COMPLETE',
        },
      });
      if (numberOfParticipants !== numberOfParticipantsThatAreInCompleteState) {
        return;
      }

      // All participants are complete - so let's finish the battle!
      if (latestBattleParticipant.battleId === null) {
        return;
      }
      await Battle.completeBattle(latestBattleParticipant.battleId, now, tx);
    });
  },

  // Called when a client sends an event to its peers via the twilio data channel to store that
  // event on the server as a source of truth
  async recordStateMachineEvent(
    battleParticipant: BattleParticipant,
    clientGeneratedUuid: string,
    payload: BattleStateMachineEvent,
  ) {
    if (!battleParticipant.battleId) {
      throw new Error(
        `Battle participant ${battleParticipant.id} does not have a battle associated! This is required to record a state machine event.`,
      );
    }

    const stateMachineEvent = await prisma.battleParticipantStateMachineEvent.create({
      data: {
        battleId: battleParticipant.battleId,
        clientGeneratedUuid,
        triggeredByParticipantId: battleParticipant.id,
        payload,
      },
    });

    pusher.trigger(
      `private-battle-${battleParticipant.battleId}-events`,
      'battle.event',
      stateMachineEvent,
    );

    return stateMachineEvent;
  },

  // Returns a participant that is available to join a battle.
  async getAvailableParticipant(
    participantToMatchWith: BattleParticipant | null = null,
    now: Date = new Date(),
  ): Promise<BattleParticipant | null> {
    let scoreRange: [number, number] | null = null;

    // let disallowedMatchingWithUserIdsRecently: Array<User['id']> = [];
    // let disallowedMatchingOldestMatchDate: Date | null = null;

    switch (participantToMatchWith?.matchingAlgorithm) {
      // With the "DEFAULT" matching method, look for two users that have roughly the same
      // score to match them
      case 'DEFAULT': {
        const score = participantToMatchWith.user.computedScore;
        const millisecondsSinceMatchStarted =
          now.getTime() - participantToMatchWith.matchingStartedAt.getTime();

        // CRITERIA ONE: figure out the score range that a potential matching user would be within
        for (const [
          millisecondsOffset,
          deviation,
        ] of BATTLE_PARTICIPANT_MATCHING_SCORE_TABLE.slice().reverse()) {
          if (millisecondsSinceMatchStarted > millisecondsOffset) {
            scoreRange = [score - deviation, score + deviation];
            break;
          }
        }

        // // CRITERIA TWO: limit selecting users that have been matched recently with the given user
        // if (millisecondsSinceMatchStarted < 15_000) { // Up until 15 seconds has passed...
        //   disallowedMatchingWithUserIdsRecently = [ participantToMatchWith.userId ];
        //   disallowedMatchingOldestMatchDate = subHours(now, 2); // ... Don't match users that have battled in the past 2 hours
        // }
        break;
      }

      // By default, just match users randomly
      // This is especially useful / important for local development
      case 'RANDOM':
      default: {
        break;
      }
    }

    return prisma.battleParticipant.findFirst({
      where: {
        battleId: null,

        // Only target battle participants which are currently checking in with the server
        connectionStatus: 'ONLINE',

        // Exclude inactive battle participants - these participants were abandoned by the mobile
        // app intentionally
        madeInactiveAt: {
          equals: null,
        },

        user: {
          // Make sure that a user cannot match with themselves in any way
          id: participantToMatchWith
            ? {
                not: {
                  equals: participantToMatchWith.userId,
                },
              }
            : undefined,

          // If specified, ensure that the found participant is associated with a user that has a score within the given range
          ...(scoreRange
            ? {
                computedScore: {
                  gt: scoreRange[0],
                  lt: scoreRange[1],
                },
              }
            : {}),

          // If specified, exclude participants of which their users have matched with the user
          // being queried for within a given time range.
          //
          // This ensures that two users don't get matched repeatedly.
          // ...(disallowedMatchingWithUserIdsRecently && disallowedMatchingOldestMatchDate ? {
          //   battleParticipants: {
          //     some: {
          //       battle: {
          //         participants: {
          //           some: {
          //             // Exclude these users...
          //             userId: {
          //               in: disallowedMatchingWithUserIdsRecently,
          //             },
          //             // ... if they have matched after a given date threshold
          //             associatedWithBattleAt: {
          //               gt: disallowedMatchingOldestMatchDate,
          //             },
          //           },
          //         },
          //       },
          //     },
          //   },
          // } : {}),
        },
      },
      include: DEFAULT_INCLUDE,
    });
  },

  // Updates the battle participant to note down that the initial attempt at forming a battle with
  // other participant(s) failed
  async markInitialParticipantMatchFailure(battleParticipant: BattleParticipant) {
    battleParticipant = await prisma.battleParticipant.update({
      where: {
        id: battleParticipant.id,
      },
      data: {
        initialMatchFailed: true,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-battleparticipant-${battleParticipant.id}`,
      'battleParticipant.update',
      battleParticipant,
    );
  },

  // Updates the battle participant, registering that they have pressed the "ready" button in the
  // app, and that they are good to start battling.
  //
  // If all participants have said they are ready, then the battle is started!
  async markParticipantAsReady(battleParticipant: BattleParticipant) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      if (!battleParticipant.battleId) {
        return;
      }
      const battleId = battleParticipant.battleId;

      // Update the participant to be ready
      battleParticipant = await tx.battleParticipant.update({
        where: {
          id: battleParticipant.id,
        },
        data: {
          readyForBattleAt: now,
        },
        include: DEFAULT_INCLUDE,
      });

      pusher.trigger(
        `private-battleparticipant-${battleParticipant.id}`,
        'battleParticipant.update',
        battleParticipant,
      );

      const numberOfParticipantsThatAreNotReady = await tx.battleParticipant.count({
        where: {
          battleId,
          readyForBattleAt: {
            equals: null,
          },
        },
      });
      if (numberOfParticipantsThatAreNotReady > 0) {
        return;
      }

      // All participants are ready - let's start the battle!
      await Battle.startBattle(battleId, now, tx);
    });
  },

  async setRequestedBattlePrivacyLevel(
    battleParticipant: BattleParticipant,
    newPrivacyLevel: BattlePrivacyLevel,
  ) {
    const battleId = battleParticipant.battleId;
    if (!battleId) {
      throw new Error(
        `Cannot set requested battle privacy level for participant ${battleParticipant.id}, the participant is not yet part of a battle!`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updatedBattleParticipant = await tx.battleParticipant.update({
        where: {
          id: battleParticipant.id,
        },
        data: {
          requestedBattlePrivacyLevel: newPrivacyLevel,

          // If the user chooses a new privacy option AFTER pressing "ready", reset the ready state
          readyForBattleAt: null,
        },
        include: DEFAULT_INCLUDE,
      });

      pusher.trigger(
        `private-battleparticipant-${updatedBattleParticipant.id}`,
        'battleParticipant.update',
        updatedBattleParticipant,
      );

      const numberOfParticipantsThatDontWantPublic = await tx.battleParticipant.count({
        where: {
          AND: [
            { battleId },
            {
              OR: [
                { requestedBattlePrivacyLevel: null },
                { requestedBattlePrivacyLevel: 'PRIVATE' },
              ],
            },
          ],
        },
      });
      const battlePrivacyLevel = numberOfParticipantsThatDontWantPublic > 0 ? 'PRIVATE' : 'PUBLIC';

      await Battle.setComputedBattlePrivacyLevel(battleId, battlePrivacyLevel, tx);
    });
  },

  async storeTwilioTrackIds(
    battleParticipant: BattleParticipant,
    twilioAudioTrackId: BattleParticipant['twilioAudioTrackId'],
    twilioVideoTrackId: BattleParticipant['twilioVideoTrackId'],
    twilioDataTrackId: BattleParticipant['twilioDataTrackId'],
  ) {
    // Update the participant to be ready
    battleParticipant = await prisma.battleParticipant.update({
      where: {
        id: battleParticipant.id,
      },
      data: {
        twilioAudioTrackId,
        twilioVideoTrackId,
        twilioDataTrackId,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-battleparticipant-${battleParticipant.id}`,
      'battleParticipant.update',
      battleParticipant,
    );

    return battleParticipant;
  },

  async storeTwilioVideoRecordingId(
    battleParticipant: BattleParticipant,
    twilioVideoRecordingId: BattleParticipant['twilioVideoRecordingId'],
  ) {
    battleParticipant = await prisma.battleParticipant.update({
      where: {
        id: battleParticipant.id,
      },
      data: { twilioVideoRecordingId },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-battleparticipant-${battleParticipant.id}`,
      'battleParticipant.update',
      battleParticipant,
    );
    return battleParticipant;
  },

  async storeTwilioAudioRecordingId(
    battleParticipant: BattleParticipant,
    twilioAudioRecordingId: BattleParticipant['twilioAudioRecordingId'],
  ) {
    battleParticipant = await prisma.battleParticipant.update({
      where: {
        id: battleParticipant.id,
      },
      data: { twilioAudioRecordingId },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-battleparticipant-${battleParticipant.id}`,
      'battleParticipant.update',
      battleParticipant,
    );

    return battleParticipant;
  },

  async updateProcessedVideoStatus(
    battleParticipant: BattleParticipant,
    processedVideoStatus: BattleParticipant['processedVideoStatus'],
    processedVideoKey?: BattleParticipant['processedVideoKey'],
    processedVideoOffsetMilliseconds?: BattleParticipant['processedVideoOffsetMilliseconds'],
  ) {
    battleParticipant = await prisma.battleParticipant.update({
      where: {
        id: battleParticipant.id,
      },
      data: {
        processedVideoStatus,
        processedVideoKey,
        processedVideoQueuedAt: processedVideoStatus === 'QUEUEING' ? new Date() : undefined,
        processedVideoStartedAt: processedVideoStatus === 'DOWNLOADING' ? new Date() : undefined,
        processedVideoCompletedAt: processedVideoStatus === 'COMPLETED' ? new Date() : undefined,
        processedVideoOffsetMilliseconds,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-battleparticipant-${battleParticipant.id}`,
      'battleParticipant.update',
      battleParticipant,
    );
    return battleParticipant;
  },

  // When a participant leaves a battle, mark the participant inactive so that it cannot be
  // matched with other participants (since it has been "abandoned" my the mobile app)
  async markInactive(
    battleParticipantIds: Array<BattleParticipant['id']>,
    madeInactiveAt: Date = new Date(),
    madeInactiveReason: string = 'UNKNOWN',
    tx: PrismaTransaction = prisma,
  ) {
    await tx.battleParticipant.updateMany({
      where: {
        id: {
          in: battleParticipantIds,
        },
      },
      data: {
        madeInactiveAt,
        madeInactiveReason,
        connectionStatus: 'OFFLINE',
      },
    });

    const battleParticipants = await tx.battleParticipant.findMany({
      where: {
        id: {
          in: battleParticipantIds,
        },
      },
      include: DEFAULT_INCLUDE,
    });

    for (const battleParticipant of battleParticipants) {
      pusher.trigger(
        `private-battleparticipant-${battleParticipant.id}`,
        'battleParticipant.update',
        battleParticipant,
      );
    }

    return battleParticipants;
  },

  // Called when a client checks in with the server to indicate that they are still active
  async updateAppState(
    battleParticipant: BattleParticipant,
    appState: BattleParticipant['appState'],
    now: Date = new Date(),
  ) {
    battleParticipant = await prisma.battleParticipant.update({
      where: {
        id: battleParticipant.id,
      },
      data: { appState, appStateLastChangedAt: now },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-battleparticipant-${battleParticipant.id}`,
      'battleParticipant.update',
      battleParticipant,
    );
  },

  // When a battle before the battle that the given participant is associated with changes outcome,
  // all battles afterwards will have their cached initial user scores change. This function is
  // called to do this.
  async updateUserComputedScoreAtBattleCreatedAt(
    participantId: BattleParticipant['id'],
    newScore: BattleParticipant['userComputedScoreAtBattleCreatedAt'],
    tx: PrismaTransaction = prisma,
  ) {
    const updatedUser = await tx.battleParticipant.update({
      where: { id: participantId },
      data: {
        userComputedScoreAtBattleCreatedAt: newScore,
      },
    });

    pusher.trigger(`private-battleparticipant-${participantId}`, 'user.update', updatedUser);
  },

  // Once the twilio video room is complete, this function can be called to begin transcoding the
  // participant video from the `*.mkv` generated in the twilio recording to a `*.mp4` so that it
  // can be played back on mobile.
  async beginTranscodingVideoForMobilePlayback(participant: BattleParticipant) {
    if (!participant.twilioVideoRecordingId) {
      console.warn(
        `WARNING: attempted to encode video for participant ${participant.id}, but twilioVideoRecordingId was null. Skipping...`,
      );
      return;
    }
    if (!participant.twilioAudioRecordingId) {
      console.warn(
        `WARNING: attempted to encode video for participant ${participant.id}, but twilioAudioRecordingId was null. Skipping...`,
      );
      return;
    }
    if (!participant.madeInactiveAt) {
      console.warn(
        `WARNING: attempted to encode video for participant ${participant.id}, but madeInactiveAt was not set. Make sure that the participant is completed before calling this function again. Skipping...`,
      );
      return;
    }

    await BattleParticipant.updateProcessedVideoStatus(participant, 'QUEUEING');

    // Kick off generating the video for the battle participant
    await queueEventToGenerateBattleParticipantVideo(participant);
  },

  // This function, when called, will enqueue messages to re-transcode ALL participant battle videos
  // for ALL participants in the database. It will paginate through the whole table, from start to
  // end, to do this in a performant way.
  //
  // NOTE: This is a function primarily for maintainence / data migration, and eventually this will
  // no longer be a feasible thing to do anymore at a certain size of data
  async forceRetranscodeVideosForMobilePlayback(
    participants: Array<BattleParticipant> | 'all' = 'all',
    pageSize = 10,
  ) {
    const participantList =
      participants !== 'all'
        ? participants
        : await prisma.battleParticipant.findMany({
            where: {
              processedVideoKey: {
                not: {
                  equals: null,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            include: DEFAULT_INCLUDE,
          });

    for (let index = 0; true; index += 1) {
      const page = participantList.slice(index * pageSize, (index + 1) * pageSize);
      if (page.length === 0) {
        break;
      }

      // Kick off processing the page of battle participants
      console.log(
        `[${index + 1}] Processing videos for battle participants: ${page
          .map((p) => p.id)
          .join(', ')}`,
      );
      await Promise.all(
        page.map((p) => BattleParticipant.beginTranscodingVideoForMobilePlayback(p)),
      );
      console.log(
        `[${index + 1}] Waiting for the processedVideoStatus of ${
          page.length
        } participant(s) to enter COMPLETED`,
      );

      // Wait for the page to finish processing
      while (true) {
        await delay(5000);
        process.stdout.write('.');

        const totalCompleted = await prisma.battleParticipant.count({
          where: {
            id: { in: page.map((p) => p.id) },
            processedVideoStatus: 'COMPLETED',
          },
        });
        if (totalCompleted === page.length) {
          break;
        }
      }
      console.log(`\n[${index + 1}] Page finished processing!`);
    }
  },

  // When called, casts a vote for the given battle participant in the battle it is participating
  // within.
  //
  // Optionally, an `amount` parameter can be specified to allow a user to cast multiple votes at
  // once - this provides a mechanism to combat a user pressing the button over and over creating
  // crazy amounts of database rows. Instead, the client can collect button presses together that
  // happen within a short duration and submit them as one "vote" event to the server with `amount`
  // set to a value greater than 1.
  async castVoteFor(
    battle: BattleWithParticipants,
    participantId: BattleParticipant['id'],
    castByUser: User,
    startedCastingAtVideoStreamOffsetMilliseconds: number,
    endedCastingAtVideoStreamOffsetMilliseconds: number,
    amount: number = 1,
    clientGeneratedUuid?: string,
    now: Date = new Date(),
    tx?: PrismaTransaction,
  ) {
    const run = async (tx: PrismaTransaction) => {
      // A vote cannot be cast on a non public battle
      if (battle.computedPrivacyLevel !== 'PUBLIC') {
        return null;
      }

      // A vote cannot be cast on a forfeited battle
      if (battle.computedHasBeenForfeited) {
        return null;
      }

      // A vote cannot be cast in a battle that has not started yet.
      if (!battle.startedAt) {
        return null;
      }

      // A vote cannot be cast in a battle that has had its voting period already ellapse
      if (battle.votingEndsAt && now > battle.votingEndsAt) {
        return null;
      }

      // A vote cannot be cast in a battle that the user themselves particicipated in
      const isCastByUserABattleParticipant = battle.participants.find(
        (p) => p.userId === castByUser.id,
      );
      if (isCastByUserABattleParticipant) {
        return null;
      }

      // Make sure that a user cannot cast more votes than they are allowed
      if (amount > USER_MAX_VOTES_PER_BATTLE) {
        amount = USER_MAX_VOTES_PER_BATTLE;
      }

      // Prior to casting new votes, remove any old votes over the maximum vote total USER_MAX_VOTES_PER_BATTLE
      //
      // This ensures that there is a maximum for the number of votes that a user can cast in a
      // battle to limit how much of an effect a single user can have on the vote total
      const existingNumberOfVotesQuery = await tx.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          castByUserId: castByUser.id,
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      const existingNumberOfVotesCastByUser = existingNumberOfVotesQuery._sum.amount || 0;
      let newTotalNumberOfVotes = existingNumberOfVotesCastByUser + amount;
      while (newTotalNumberOfVotes > USER_MAX_VOTES_PER_BATTLE) {
        // Look initially for votes to remove that are for OTHER participants
        //
        // This means that if one votes for participant A and participant B has an old vote, but
        // participant A ALSO has an OLDER vote, then prefer the participant B vote since the user
        // most likely intends to reallocate votes to the participant they votef for
        let oldestCastVote = await tx.battleParticipantVote.findFirst({
          where: {
            castByUserId: castByUser.id,
            battleParticipant: {
              id: {
                not: {
                  equals: participantId,
                },
              },
              battleId: battle.id,
            },
          },
          orderBy: {
            startedCastingAt: 'asc',
          },
          select: {
            id: true,
            amount: true,
            battleParticipantId: true,
            startedCastingAt: true,
          },
        });
        if (!oldestCastVote) {
          // If no votes can be found for OTHER participants, than open it up across all
          // participants. This will happen if a user is already fully voting for one participant
          // and keeps pressing the vote button.
          oldestCastVote = await tx.battleParticipantVote.findFirst({
            where: {
              castByUserId: castByUser.id,
              battleParticipant: {
                battleId: battle.id,
              },
            },
            orderBy: {
              startedCastingAt: 'asc',
            },
            select: {
              id: true,
              amount: true,
              battleParticipantId: true,
              startedCastingAt: true,
            },
          });
        }
        if (!oldestCastVote) {
          // This _should_ never happen...
          console.warn(
            `Error in casting vote for user ${castByUser.id} and battle ${battle.id}: in rearranging votes, after getting to ${newTotalNumberOfVotes}, ran out of vote rows! This should be impossible!`,
          );
          break;
        }

        newTotalNumberOfVotes -= oldestCastVote.amount;
        if (newTotalNumberOfVotes >= USER_MAX_VOTES_PER_BATTLE) {
          // Delete the vote row, it fully should be reallocated to later
          await tx.battleParticipantVote.delete({ where: { id: oldestCastVote.id } });
        } else {
          const numberOfVotesToKeep = USER_MAX_VOTES_PER_BATTLE - newTotalNumberOfVotes;

          // Update the vote row so that some of its votes are removed
          await tx.battleParticipantVote.update({
            where: { id: oldestCastVote.id },
            data: {
              amount: numberOfVotesToKeep,
            },
          });
        }
      }

      const startedCastingAt = subMilliseconds(
        now,
        endedCastingAtVideoStreamOffsetMilliseconds - startedCastingAtVideoStreamOffsetMilliseconds,
      );

      // First, actually create the new vote
      const vote = await tx.battleParticipantVote.create({
        data: {
          startedCastingAt,
          endedCastingAt: now,
          startedCastingAtVideoStreamOffsetMilliseconds,
          endedCastingAtVideoStreamOffsetMilliseconds,
          castByUserId: castByUser.id,
          amount,
          battleParticipantId: participantId,
          clientGeneratedUuid: clientGeneratedUuid || '',
        },
      });
      pusher.trigger(
        `private-battleparticipant-${participantId}-votes`,
        'battleParticipantVote.create',
        vote,
      );

      // Next, update cached values - did this vote cause the winner of the battle this participant is
      // part of to change?
      await Battle.updateComputedWinningParticipants(battle, tx);

      return vote;
    };

    if (tx) {
      return run(tx);
    } else {
      return prisma.$transaction(run);
    }
  },
};

export default BattleParticipant;
