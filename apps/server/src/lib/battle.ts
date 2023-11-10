import {
  Prisma,
  Battle as PrismaBattle,
  BattleParticipant as PrismaBattleParticipant,
  BattleParticipantStateMachineEvent as PrismaBattleParticipantStateMachineEvent,
  BattleParticipantCheckin as PrismaBattleParticipantCheckin,
  BattleParticipantVote as PrismaBattleParticipantVote,
  BattleParticipantThumbnail as PrismaBattleParticipantThumbnail,
  BattleExportThumbnail as PrismaBattleExportThumbnail,
} from '@prisma/client';
import { addDays } from 'date-fns';
import BattleParticipant from './battle-participant.ts';
import User, { UserMe, ExpandedUser, USER_FIELDS } from './user.ts';
import BattleComment from './battle-comment.ts';
import prisma, { PrismaTransaction } from './prisma.ts';
import pusher from './pusher.ts';
import twilioClient from './twilio.ts';
import generateTrendingSqlFragment from './battle-trending-sql.ts';
import {
  BattleStateMachineTypestate,
  STATES_THAT_CAN_SWITCH_ACTIVE_BATTLER,
} from './battle-state-machine.ts';
import { RecordingsObjectStorage } from './object-storage.ts';
import { FixMe } from './fixme.ts';

import { queueEventToGenerateBattleVideoExport } from '../worker/battle-video-export-generation-worker.ts';

import { getPublicBaseUrl, VOTING_TIME_INTERVAL_LENGTH_DAYS } from '../config.ts';

type Battle = PrismaBattle;

export type BattleWithParticipants = Battle & {
  participants: Array<
    Omit<PrismaBattleParticipant, 'battleId'> & {
      user: User;
    }
  >;
};

const DEFAULT_INCLUDE = {
  participants: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      battleId: false,
      userId: true,
      userComputedScoreAtBattleCreatedAt: true,
      computedDidWinOrTieBattle: true,
      order: true,
      madeInactiveAt: true,
      madeInactiveReason: true,
      matchingStartedAt: true,
      matchingAlgorithm: true,
      associatedWithBattleAt: true,
      videoStreamingStartedAt: true,
      connectionStatus: true,
      initialMatchFailed: true,
      currentState: true,
      currentContext: true,
      readyForBattleAt: true,
      requestedBattlePrivacyLevel: true,
      twilioAudioTrackId: true,
      twilioVideoTrackId: true,
      twilioDataTrackId: true,
      twilioAudioRecordingId: true,
      twilioVideoRecordingId: true,
      appState: true,
      appStateLastChangedAt: true,
      forfeitedAt: true,
      processedVideoStatus: true,
      processedVideoKey: true,
      processedVideoQueuedAt: true,
      processedVideoStartedAt: true,
      processedVideoCompletedAt: true,
      processedVideoOffsetMilliseconds: true,
      user: {
        select: USER_FIELDS,
      },
    },
  },
};

export type BattleWithParticipantsAndCheckinsAndVotesAndEvents = Battle & {
  participants: Array<
    Omit<PrismaBattleParticipant, 'battleId'> & {
      processedVideoThumbnails: Array<
        Pick<PrismaBattleParticipantThumbnail, 'id' | 'size' | 'key'>
      >;
      checkins: Array<
        Pick<
          PrismaBattleParticipantCheckin,
          | 'id'
          | 'createdAt'
          | 'updatedAt'
          | 'checkedInAt'
          | 'videoStreamOffsetMilliseconds'
          | 'state'
          | 'context'
        >
      >;
      votes: Array<
        Pick<
          PrismaBattleParticipantVote,
          | 'id'
          | 'startedCastingAt'
          | 'startedCastingAtVideoStreamOffsetMilliseconds'
          | 'endedCastingAt'
          | 'endedCastingAtVideoStreamOffsetMilliseconds'
          | 'castByUserId'
          | 'amount'
        >
      >;
      user: User;
    }
  >;
  stateMachineEvents: Array<
    Pick<
      PrismaBattleParticipantStateMachineEvent,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'clientGeneratedUuid'
      | 'triggeredByParticipantId'
      | 'payload'
    >
  >;
  exportedVideoThumbnails: Array<
    Pick<
      PrismaBattleExportThumbnail,
      | 'id'
      | 'size'
      | 'key'
    >
  >;
};

export type BattleRecording = {
  battleId: Battle['id'];
  battleStartedAt: Battle['startedAt'];
  battleCompletedAt: Battle['completedAt'];
  battleComputedPrivacyLevel: Battle['computedPrivacyLevel'];
  battleComputedHasBeenForfeited: Battle['computedHasBeenForfeited'];
  battleExportedVideoUrl: string | null;
  battleExportedThumbnailUrls: { [size: string]: string };
  battleVotingEndsAt: Battle['votingEndsAt'];
  battleCommentTotal: number;
  phases: Array<{
    startsAt: Date;
    endsAt: Date;
    state: BattleParticipant['currentState'];
    activeParticipantId: BattleParticipant['id'] | null;
  }>;
  participants: Array<{
    id: BattleParticipant['id'];
    order: BattleParticipant['order'];
    twilioAudioTrackId: BattleParticipant['twilioAudioTrackId'];
    twilioVideoTrackId: BattleParticipant['twilioVideoTrackId'];
    twilioDataTrackId: BattleParticipant['twilioDataTrackId'];
    twilioAudioRecordingId: BattleParticipant['twilioAudioRecordingId'];
    twilioVideoRecordingId: BattleParticipant['twilioVideoRecordingId'];
    forfeitedAt: BattleParticipant['forfeitedAt'];
    videoStreamingStartedAt: BattleParticipant['videoStreamingStartedAt'];
    madeInactiveAt: BattleParticipant['madeInactiveAt'];
    mediaUrl: string | null;
    mediaOffsetMilliseconds: number;
    mediaThumbnailUrls: { [size: string]: string };
    computedTotalVoteAmount: number;
    user: User;
  }>;
};

const DETAIL_INCLUDE = {
  participants: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      battleId: false,
      userId: true,
      userComputedScoreAtBattleCreatedAt: true,
      computedDidWinOrTieBattle: true,
      order: true,
      madeInactiveAt: true,
      madeInactiveReason: true,
      matchingStartedAt: true,
      matchingAlgorithm: true,
      associatedWithBattleAt: true,
      videoStreamingStartedAt: true,
      connectionStatus: true,
      initialMatchFailed: true,
      currentState: true,
      currentContext: true,
      readyForBattleAt: true,
      requestedBattlePrivacyLevel: true,
      twilioAudioTrackId: true,
      twilioVideoTrackId: true,
      twilioDataTrackId: true,
      twilioAudioRecordingId: true,
      twilioVideoRecordingId: true,
      appState: true,
      appStateLastChangedAt: true,
      forfeitedAt: true,
      processedVideoStatus: true,
      processedVideoKey: true,
      processedVideoQueuedAt: true,
      processedVideoStartedAt: true,
      processedVideoCompletedAt: true,
      processedVideoOffsetMilliseconds: true,
      processedVideoThumbnails: {
        select: {
          id: true,
          size: true,
          key: true,
        },
      },
      checkins: {
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          checkedInAt: true,
          state: true,
          context: true,
          videoStreamOffsetMilliseconds: true,
        },
      },
      votes: {
        select: {
          id: true,
          startedCastingAt: true,
          startedCastingAtVideoStreamOffsetMilliseconds: true,
          endedCastingAt: true,
          endedCastingAtVideoStreamOffsetMilliseconds: true,
          castByUserId: true,
          amount: true,
        },
      },
      user: {
        select: USER_FIELDS,
      },
    },
    // Always order participants in the order in which they go in the battle
    orderBy: {
      order: 'asc' as const,
    },
  },
  stateMachineEvents: {
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      clientGeneratedUuid: true,
      triggeredByParticipantId: true,
      payload: true,
    },
  },
  exportedVideoThumbnails: {
    select: {
      id: true,
      size: true,
      key: true,
    },
  },
};

export type BattlePrivacyLevel = 'PUBLIC' | 'PRIVATE';

export type BattleWhere = NonNullable<
  NonNullable<Parameters<typeof prisma.battle.findMany>[0]>['where']
>;
type BattleWhereSimple = Pick<BattleWhere, keyof Battle>;

const Battle = {
  async all(
    page: number,
    pageSize: number,
    sort?: [keyof Battle, 'asc' | 'desc'],
    filter?: BattleWhereSimple,
  ): Promise<Array<BattleWithParticipants>> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    return prisma.battle.findMany({
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

  async count(filter?: BattleWhereSimple) {
    return prisma.battle.count({ where: filter });
  },

  // Return battles that are shown to a user when they visit the app's "home" page.
  // This powers a tictoc style card video swiping interface for viewing battles
  //
  // NOTE: currently, the SAME chronological list of battles is returned to all users.
  // This will almost certainly get more complex with time!
  async generateHomeFeedStartingAtBattle(
    battleId: Battle['id'] | null = null,
    userId: User['id'],
    feed: 'FOLLOWING' | 'TRENDING' = 'FOLLOWING',
    homeFeedLength = 10,
  ): Promise<null | Array<BattleRecording>> {
    if (battleId) {
      const battle = await Battle.getById(battleId);
      if (!battle) {
        return null;
      }
    }

    let selectedBattleIds: Array<{ id: string }>;
    switch (feed) {
      case 'FOLLOWING':
        selectedBattleIds = await prisma.$queryRaw`
          SELECT
            battle.id,
            (
              SELECT count(battle_view.id)
              FROM battle_view
              WHERE battle_view.user_id = ${userId} AND battle_view.battle_id = battle.id
            ) as number_of_views
          FROM battle
          WHERE
            battle.started_at IS NOT NULL AND

            -- Exclude non public battles from the home feed
            battle.computed_privacy_level = 'PUBLIC' AND

            -- Filter out battles that didn't make it into the warm up/battle stages of the battle
            -- The videos associated with these battles when played in the viewer will be zero length
            EXISTS (
              SELECT
                battle_participant_checkin.id
              FROM battle_participant_checkin
              LEFT JOIN battle_participant
                ON battle_participant.id = battle_participant_checkin.battle_participant_id
              WHERE
                battle_participant.battle_id = battle.id AND
                battle_participant_checkin.state = 'WARM_UP'
            ) AND

            -- Filter out battles that are not fully processed
            NOT EXISTS (
              SELECT id FROM battle_participant
              WHERE
                battle_participant.battle_id = battle.id AND (
                  battle_participant.processed_video_key IS NULL OR
                  battle_participant.processed_video_status != 'COMPLETED'
                )
            ) AND

            -- Filter out battles that do NOT involve a user that the authorized user follows
            EXISTS (
              SELECT id
              FROM battle_participant
              WHERE
                battle_participant.battle_id = battle.id
                -- Determine if the authed user is following the user associated with the participant
                AND EXISTS (
                  SELECT id
                  FROM clerk_user_follows
                  WHERE
                    -- "userId" has followed "battle_participant.user_id"
                    clerk_user_follows.user_id = ${userId} AND
                    clerk_user_follows.follows_user_id = battle_participant.user_id
                )
            )
          ORDER BY
            -- Show battles that have been viewed least first, then sort all battles that
            -- have been viewed the same number of times by creation time
            number_of_views ASC,
            created_at DESC
          LIMIT ${homeFeedLength}
        `;
        break;

      case 'TRENDING':
        selectedBattleIds = await prisma.$queryRaw`
          SELECT
            battle.id,
            (
              SELECT count(battle_view.id)
              FROM battle_view
              WHERE battle_view.user_id = ${userId} AND battle_view.battle_id = battle.id
            ) as number_of_views,

            (${generateTrendingSqlFragment(Prisma.sql`battle`, Prisma.sql`id`)}) as trending_score
          FROM battle
          WHERE
            battle.started_at IS NOT NULL AND

            -- Exclude non public battles from the home feed
            battle.computed_privacy_level = 'PUBLIC' AND

            -- Filter out battles that didn't make it into the warm up/battle stages of the battle
            -- The videos associated with these battles when played in the viewer will be zero length
            EXISTS (
              SELECT
                battle_participant_checkin.id
              FROM battle_participant_checkin
              LEFT JOIN battle_participant
                ON battle_participant.id = battle_participant_checkin.battle_participant_id
              WHERE
                battle_participant.battle_id = battle.id AND
                battle_participant_checkin.state = 'WARM_UP'
            ) AND

            -- Filter out battles that are not fully processed
            NOT EXISTS (
              SELECT id FROM battle_participant
              WHERE
                battle_participant.battle_id = battle.id AND (
                  battle_participant.processed_video_key IS NULL OR
                  battle_participant.processed_video_status != 'COMPLETED'
                )
            )
          ORDER BY
            -- Show battles that have been viewed least first, then sort all battles that
            -- have been viewed the same number of times by creation time
            number_of_views ASC,
            -- Show battles with the highest trending score first, as they have been
            -- voted on most recently
            trending_score DESC,
            created_at DESC
          LIMIT ${homeFeedLength}
        `;
        break;
    }

    const rawResults = await prisma.battle.findMany({
      where: {
        id: {
          in: selectedBattleIds.map((n) => n.id),
        },
      },
      include: DETAIL_INCLUDE,
    });

    // Generate battle recordings for each battle
    const recordings = await Promise.all(
      rawResults.map((battle) => Battle.generatePlaybackData(battle)),
    );

    // Return the generated battle recordings in the same order as the original query returned the
    // battle ids
    const battleToRecording = new Map(
      rawResults.map(
        (battle, index) => [battle.id, recordings[index]] as [Battle['id'], BattleRecording],
      ),
    );
    return selectedBattleIds
      .map(({ id }) => battleToRecording.get(id))
      .filter((r): r is BattleRecording => typeof r !== 'undefined');
  },

  async generatePlaybackData(
    battle: BattleWithParticipantsAndCheckinsAndVotesAndEvents,
  ): Promise<BattleRecording> {
    return {
      battleId: battle.id,
      battleStartedAt: battle.startedAt,
      battleCompletedAt: battle.completedAt,
      battleComputedPrivacyLevel: battle.computedPrivacyLevel,
      battleComputedHasBeenForfeited: battle.computedHasBeenForfeited,
      battleExportedVideoUrl:
        battle.exportedVideoStatus === 'COMPLETED' && battle.exportedVideoKey
          ? await RecordingsObjectStorage.getSignedUrl(battle.exportedVideoKey)
          : null,
      battleExportedThumbnailUrls: Object.fromEntries(
        await Promise.all(
          battle.exportedVideoThumbnails.map(async (thumbnail) => [
            `${thumbnail.size}`,
            // NOTE: the battle sharing app relies on these not expiring so that it can use these
            // links in the opengraph tags and other services can cache them. Consider putting these
            // on a CDN / not generating bespoke signed links to them every request.
            await RecordingsObjectStorage.getSignedUrl(thumbnail.key, null),
          ]),
        ),
      ),
      battleVotingEndsAt: battle.votingEndsAt,
      battleCommentTotal: await BattleComment.countForBattle(battle.id),
      phases: battle.startedAt
        ? Battle.generateStateChangesFromParticipantCheckins(battle).map((stateChange) => ({
            startsAt: stateChange.startsAt,
            startsAtVideoStreamOffsetMilliseconds:
              stateChange.startsAtVideoStreamOffsetMilliseconds,
            endsAt: stateChange.endsAt,
            endsAtVideoStreamOffsetMilliseconds: stateChange.endsAtVideoStreamOffsetMilliseconds,
            state: stateChange.state,
            activeParticipantId: stateChange.activeParticipant
              ? stateChange.activeParticipant.id
              : null,
          }))
        : [],
      participants: await Promise.all(
        battle.participants.map(async (p) => {
          return {
            id: p.id,
            order: p.order,

            twilioAudioTrackId: p.twilioAudioTrackId,
            twilioVideoTrackId: p.twilioVideoTrackId,
            twilioDataTrackId: p.twilioDataTrackId,

            twilioAudioRecordingId: p.twilioAudioRecordingId,
            twilioVideoRecordingId: p.twilioVideoRecordingId,

            forfeitedAt: p.forfeitedAt,
            videoStreamingStartedAt: p.videoStreamingStartedAt,
            madeInactiveAt: p.madeInactiveAt,
            mediaUrl:
              p.processedVideoStatus === 'COMPLETED' && p.processedVideoKey
                ? await RecordingsObjectStorage.getSignedUrl(p.processedVideoKey)
                : null,
            mediaThumbnailUrls: Object.fromEntries(
              await Promise.all(
                p.processedVideoThumbnails.map(async (thumbnail) => [
                  `${thumbnail.size}`,
                  await RecordingsObjectStorage.getSignedUrl(thumbnail.key),
                ]),
              ),
            ),
            mediaOffsetMilliseconds: p.processedVideoOffsetMilliseconds,

            computedTotalVoteAmount: p.votes.reduce((acc, vote) => acc + vote.amount, 0),

            user: {
              id: p.user.id,
              handle: p.user.handle,
              name: p.user.name,
              profileImageUrl: p.user.profileImageUrl,
              computedScore: p.user.computedScore,
              computedFollowersCount: p.user.computedFollowersCount,
              computedFollowingCount: p.user.computedFollowingCount,
            },
          };
        }),
      ),
    };
  },

  async getById(
    id: Battle['id'],
    tx: PrismaTransaction = prisma,
  ): Promise<BattleWithParticipantsAndCheckinsAndVotesAndEvents | null> {
    return tx.battle.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  },

  async getByIds(
    ids: Array<Battle['id']>,
    tx: PrismaTransaction = prisma,
  ): Promise<Array<BattleWithParticipantsAndCheckinsAndVotesAndEvents>> {
    const results = await tx.battle.findMany({
      where: { id: { in: ids } },
      include: DETAIL_INCLUDE,
    });
    return ids.map((id) => results.find((r) => r.id === id)!);
  },

  async refreshFromDatabase(
    battle: Pick<Battle, 'id'>,
    tx: PrismaTransaction = prisma,
  ): Promise<BattleWithParticipantsAndCheckinsAndVotesAndEvents> {
    const updatedBattle = await Battle.getById(battle.id, tx);
    if (!updatedBattle) {
      throw new Error(`Error refreshing battle from database: battle ${battle.id} not found!`);
    }
    return updatedBattle;
  },

  async getByIdInContextOfUserMe(
    id: Battle['id'],
    userMe: UserMe | null,
    operationType: 'read' | 'in-battle-read',
  ): Promise<BattleWithParticipantsAndCheckinsAndVotesAndEvents | null> {
    switch (operationType) {
      // A user should be able to READ battles if they are either:
      // - PUBLIC: all users can see public battles
      // - PRIVATE: only users that participanted in the battle should be able to see these
      case 'read': {
        return prisma.battle.findFirst({
          where: {
            AND: [
              { id },
              {
                OR: [
                  { computedPrivacyLevel: 'PUBLIC' },
                  {
                    computedPrivacyLevel: 'PRIVATE',
                    // A user must have participated in the battle
                    participants: {
                      some: {
                        userId: userMe?.id,
                      },
                    },
                  },
                ],
              },
            ],
          },
          include: DETAIL_INCLUDE,
        });
      }

      // A user should be able to LIVE-READ only battles they are part of - this is because there
      // are costs associated with users being subscribed via pusher and it would be bad if just
      // anyone could connect
      case 'in-battle-read': {
        if (!userMe) {
          return null;
        }

        const result = await prisma.battle.findMany({
          where: {
            id,
            // NOTE: The privacy setting doesn't matter since this query is effectively always PRIVATE-scoped
            participants: {
              some: {
                user: {
                  id: userMe.id,
                },
              },
            },
          },
          include: DETAIL_INCLUDE,
          take: 1,
        });

        if (result.length > 0) {
          return result[0];
        } else {
          return null;
        }
      }
    }
  },

  async create(
    battleParticipants: Array<BattleParticipant>,
    privacyLevel: BattlePrivacyLevel = 'PRIVATE',
    numberOfRounds: number = 1,
    now: Date = new Date(),
    tx?: PrismaTransaction,
  ): Promise<BattleWithParticipants> {
    const run = async (tx: PrismaTransaction) => {
      const twilioRoomName = Battle.generateBattleTwilioRoomName(battleParticipants);

      const beatId = await Battle.generateRandomBeatId();

      // First, create a battle in the database
      let battle: BattleWithParticipants = await tx.battle.create({
        data: {
          participants: {
            connect: battleParticipants.map((p) => ({ id: p.id })),
          },
          beatId,
          numberOfRounds,
          twilioRoomName,
          // NOTE: this needs to be left blank because the next step is what generates this value
          // Because this create and update are done in a transaction this should never be like this
          // in the database for real
          twilioRoomSid: '',
          computedPrivacyLevel: privacyLevel,
        },
        include: DEFAULT_INCLUDE,
      });

      // Second, generate a new room on twilio video's end
      const room = await twilioClient.video.v1.rooms.create({
        uniqueName: twilioRoomName,
        recordParticipantsOnConnect: true,
        statusCallback: `${getPublicBaseUrl()}/v1/battles/${battle.id}/twilio-video-room-webhook`,
        statusCallbackMethod: 'POST',
      });

      // Third, Update the battle to include the room sid in the database
      battle = await tx.battle.update({
        where: {
          id: battle.id,
        },
        data: {
          twilioRoomSid: room.sid,
        },
        include: DEFAULT_INCLUDE,
      });

      // Forth, store initial score values for each participant's user when the battle is created
      //
      // This is important as a baseline for the elo score calculation - when performing that
      // calculation, one needs the score of both participants from BEFORE the battle, not the
      // future / current score when the elo score is being computed
      let userInitialScores: Array<User['computedScore']> = [];
      for (let index = 0; index < battleParticipants.length; index += 1) {
        const participant = battle.participants[index];
        const userInitialScore = participant.user.computedScore;

        await tx.battleParticipant.update({
          where: { id: participant.id },
          data: {
            userComputedScoreAtBattleCreatedAt: userInitialScore,
          },
        });

        userInitialScores.push(userInitialScore);
      }

      // Fifth, after storing the initial score, run the initial score computation for each user
      // associated with this battle
      //
      // NOTE: this should be pretty fast, since this battle being started should be pretty
      // recently created / likely is the most recent battle that the user has been part of. It's
      // also very likely to be a no-op if the user initial scores are the same...
      const updatedUsers = await User.updateComputedCloutScore(
        battleParticipants.map((p) => p.user),
        now,
        tx,
      );
      const scoredBattleParticipants = battleParticipants.map((participant, index) => ({
        ...participant,
        userComputedScoreAtBattleCreatedAt: userInitialScores[index],
        user: updatedUsers[index],
      }));

      // Sixth, Update all participants to have the correct battle association time and sort them in a
      // random order
      const randomlyOrderedBattleParticipants = scoredBattleParticipants
        .map((p) => ({ p, i: Math.random() }))
        .sort((a, b) => a.i - b.i)
        .map((p, order) => ({ ...p.p, order }));
      for (let index = 0; index < randomlyOrderedBattleParticipants.length; index += 1) {
        const battleParticipant = randomlyOrderedBattleParticipants[index];

        await tx.battleParticipant.update({
          where: {
            id: battleParticipant.id,
          },
          data: {
            order: battleParticipant.order,
            associatedWithBattleAt: battle.createdAt,
          },
        });

        battle.participants[index] = battleParticipant;
      }

      pusher.trigger(`private-battle-${battle.id}`, 'battle.create', battle);

      // Send pushes to all clients - this contains information about their newly assigned battle
      battleParticipants = await BattleParticipant.getByIds(battleParticipants.map((p) => p.id));
      for (const battleParticipant of battleParticipants) {
        pusher.trigger(
          `private-battleparticipant-${battle.id}`,
          'battleParticipant.update',
          battleParticipant,
        );
        // console.log(`PUSHER: battle-participant-${battle.id}`, 'battleParticipant.update', battleParticipant);
      }

      // FIXME: this is commented out since I'm moving away from running the state machine on the
      // server
      // await beginProcessingBattleStateMachine(battle);

      return battle;
    };

    if (tx) {
      return run(tx);
    } else {
      return prisma.$transaction(run);
    }
  },

  generateBattleTwilioRoomName(battleParticipants: Array<BattleParticipant>) {
    return `battle-${battleParticipants.map((p) => p.id).join('-')}-${new Date().getTime()}`;
  },

  async generateRandomBeatId() {
    const where = { enabled: true };
    const count = await prisma.battleBeat.count({ where });
    const skip = Math.floor(Math.random() * count);
    const beat = await prisma.battleBeat.findFirst({
      where,
      skip,
      select: { id: true },
    });

    if (!beat) {
      throw new Error(
        'No beats exist - please create at least one beat in the battle_beats table before creating a battle!',
      );
    }

    return beat.id;
  },

  // Once all participants have said they are "ready", then start the battle!
  async startBattle(battleId: Battle['id'], now: Date = new Date(), tx?: PrismaTransaction) {
    const run = async (tx: PrismaTransaction) => {
      const battle = await tx.battle.update({
        where: {
          id: battleId,
        },
        data: {
          startedAt: now,

          // Once the battle starts, also set the last point at which votes can be submitted for the battle
          votingEndsAt: addDays(now, VOTING_TIME_INTERVAL_LENGTH_DAYS),
        },
        include: DEFAULT_INCLUDE,
      });

      // Push updates to clients
      pusher.trigger(`private-battle-${battle.id}`, 'battle.update', battle);
      for (const participant of battle.participants) {
        pusher.trigger(
          `private-battleparticipant-${participant.id}`,
          'battleParticipant.update',
          participant,
        );
      }
    };

    if (tx) {
      return run(tx);
    } else {
      return prisma.$transaction(run);
    }
  },

  // Once all participants have finished running the battle state machine, then the battle is
  // completed.
  async completeBattle(
    battleId: Battle['id'],
    now: Date = new Date(),
    tx: PrismaTransaction = prisma,
  ) {
    const battle = await tx.battle.update({
      where: {
        id: battleId,
      },
      data: {
        completedAt: now,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(`private-battle-${battle.id}`, 'battle.update', battle);
  },

  // When a battle is made inactive, all users will be forced out of the battle and the
  // battle matching process will begin again for all clients from scratch.
  async makeBattlesInactive(
    battleIdsAndTriggeringParticipant: Array<[Battle['id'], BattleParticipant['id'] | null]>,
    madeInactiveReason: string = 'UNKNOWN',
    tx: PrismaTransaction = prisma,
  ) {
    const battleIds = battleIdsAndTriggeringParticipant.map((n) => n[0]);
    const run = async (tx: PrismaTransaction) => {
      const madeInactiveAt = new Date();
      const wasBattlePreviouslyComplete = new Map(
        (await Battle.getByIds(battleIds, tx)).map((battle) => [battle.id, battle.completedAt]),
      );

      await tx.battle.updateMany({
        where: {
          id: {
            in: battleIds,
          },
        },
        data: {
          completedAt: madeInactiveAt,
          madeInactiveAt,
          madeInactiveReason,
        },
      });

      const battles = await Battle.getByIds(battleIds, tx);

      for (let index = 0; index < battles.length; index += 1) {
        let battle = battles[index];
        const triggeredByParticipantId = battleIdsAndTriggeringParticipant[index][1];

        const participantIds = battle.participants.map((p) => p.id);

        // When the user left the battle, did they leave during a point in the battle's lifecycle
        // where that would be considered a forfeit?
        let didForfeit = false;
        if (
          !battle.computedHasBeenForfeited &&
          triggeredByParticipantId &&
          participantIds.includes(triggeredByParticipantId)
        ) {
          if (battle.startedAt) {
            // Leaving a battle once it has started and before it has completed is definitely a forfeit
            const wasCompleteWhenFunctionStarted = wasBattlePreviouslyComplete.get(battle.id);
            didForfeit = !wasCompleteWhenFunctionStarted;
          } else if (await prisma.challenge.findFirst({ where: { battleId: battle.id } })) {
            // If the battle was created by a challenge, then the period from when the participants
            // both join the waiting room up until when the battle starts should NOT count as a
            // forfeit
            didForfeit = false;
          } else {
            // In a regular / non challenge battle, leaving in the span of time from when the
            // participants are matched up until when the battle starts SHOULD forfeit
            didForfeit = true;
          }

          // If the participant that left the battle actually forfeited, then note that down
          if (didForfeit) {
            await tx.battleParticipant.updateMany({
              where: {
                id: triggeredByParticipantId,
              },
              data: {
                forfeitedAt: madeInactiveAt,
              },
            });

            const updatedBattle = await Battle.refreshFromDatabase(battle, tx);
            if (!updatedBattle) {
              throw new Error(
                `Battle ${battle.id} was unable to be found after updating participant forfeitedAt!`,
              );
            }
            battle = updatedBattle;
          }
        }

        // Mark all participants within the battle as inactive as well
        await BattleParticipant.markInactive(
          participantIds,
          madeInactiveAt,
          madeInactiveReason,
          tx,
        );

        // If the battle was forfeited, then update the cached user scores to take this into account
        // so that the user that forfeited's score decreases.
        if (didForfeit) {
          await Battle.updateComputedWinningParticipants(battle, tx);
        }

        // console.log('PUSH BATTLE INACTIVE', battle.madeInactiveAt)
        pusher.trigger(`private-battle-${battle.id}`, 'battle.update', battle);
      }
    };

    // Prisma does not seem to support nested transactions, so if a transaction was passed in, run
    // all queries in that context.
    if (tx === prisma) {
      return prisma.$transaction(run);
    } else {
      return run(tx);
    }
  },

  async setComputedBattlePrivacyLevel(
    battleId: Battle['id'],
    newComputedPrivacyLevel: BattlePrivacyLevel,
    tx?: PrismaTransaction,
  ) {
    const run = async (tx: PrismaTransaction) => {
      const isBattleAlreadyAtPrivacyLevel =
        (await tx.battle.count({
          where: {
            id: battleId,
            computedPrivacyLevel: newComputedPrivacyLevel,
          },
        })) > 0;

      // Avoid updating the battle's privacy level if it is already set to minimize the number of
      // pusher messages sent to the client
      if (isBattleAlreadyAtPrivacyLevel) {
        return;
      }

      const updatedBattle = await tx.battle.update({
        where: { id: battleId },
        data: { computedPrivacyLevel: newComputedPrivacyLevel },
        include: DEFAULT_INCLUDE,
      });
      pusher.trigger(`private-battle-${updatedBattle.id}`, 'battle.update', updatedBattle);
    };

    if (tx) {
      return run(tx);
    } else {
      return prisma.$transaction(run);
    }
  },

  // Given information about each individual participant's state transitions, combine all those
  // state transitions together, and combine them (removing states like WAITING, etc) to compute a
  // list of the state that the battle as a whole was in at aa given time between the battle start
  // and end time.
  //
  // This is used to render the "progress bar" UI element when playing back battles.
  generateStateChangesFromParticipantCheckins(
    battle: BattleWithParticipantsAndCheckinsAndVotesAndEvents,
  ) {
    if (!battle.startedAt) {
      throw new Error(
        `Cannot generate state changes for battle ${battle.id}, startedAt is not defined! This is required.`,
      );
    }

    const sortedCheckins = battle.participants
      .flatMap((p) =>
        p.checkins.map(
          (c) =>
            [c, p] as [
              BattleWithParticipantsAndCheckinsAndVotesAndEvents['participants'][0]['checkins'][0],
              BattleWithParticipantsAndCheckinsAndVotesAndEvents['participants'][0],
            ],
        ),
      )
      .sort(([checkinA], [checkinB]) => {
        if (
          checkinA.videoStreamOffsetMilliseconds !== null &&
          checkinB.videoStreamOffsetMilliseconds !== null
        ) {
          return checkinA.videoStreamOffsetMilliseconds > checkinB.videoStreamOffsetMilliseconds
            ? 1
            : -1;
        } else {
          return checkinA.checkedInAt > checkinB.checkedInAt ? 1 : -1;
        }
      });

    const stateChanges: Array<{
      startsAt: Date;
      startsAtVideoStreamOffsetMilliseconds: number | null;
      endsAt: Date;
      endsAtVideoStreamOffsetMilliseconds: number | null;
      state: BattleStateMachineTypestate['value'];
      activeParticipant: BattleWithParticipants['participants'][0] | null;
    }> = [];

    for (const [checkin, participant] of sortedCheckins) {
      const checkinState = checkin.state as BattleStateMachineTypestate['value'];
      const checkinContext = checkin.context as BattleStateMachineTypestate['context'];

      if (stateChanges.length === 0) {
        stateChanges.push({
          startsAt: battle.startedAt,
          startsAtVideoStreamOffsetMilliseconds: null,
          endsAt: checkin.checkedInAt,
          endsAtVideoStreamOffsetMilliseconds: checkin.videoStreamOffsetMilliseconds,
          state: checkinState,
          activeParticipant: null,
        });
        continue;
      }

      // Make sure that this checkin occurred from the currently active participant - events like
      // "WAITING" / etc from non active state machines aren't useful in the resulting data.
      const activeParticipantFromContextId =
        typeof checkinContext.currentParticipantIndex === 'number'
          ? checkinContext.participantIds[checkinContext.currentParticipantIndex]
          : null;
      if (activeParticipantFromContextId !== participant.id) {
        continue;
      }

      const lastStateChange = stateChanges.at(-1);
      if (!lastStateChange) {
        continue;
      }

      // Only take state transitions from the active participant - this ensures that `WAITING` for
      // example from the inactive participant does not end up in this list. The active participant
      // can only be changed by a state in `STATES_THAT_CAN_SWITCH_ACTIVE_BATTLER`. This prevents
      // states from the non active participant from
      if (lastStateChange.activeParticipant) {
        if (participant.id !== lastStateChange.activeParticipant.id) {
          if (!STATES_THAT_CAN_SWITCH_ACTIVE_BATTLER.includes(checkinState)) {
            continue;
          }
        } else {
          if (STATES_THAT_CAN_SWITCH_ACTIVE_BATTLER.includes(checkinState)) {
            continue;
          }
        }
      }

      // If the last state and current state are the same, then extend the last state
      // This should ensure that two duplicate states don't show up in a row
      if (lastStateChange.state === checkinState) {
        lastStateChange.endsAt = checkin.checkedInAt;
        lastStateChange.endsAtVideoStreamOffsetMilliseconds = checkin.videoStreamOffsetMilliseconds;
        continue;
      }

      stateChanges.push({
        startsAt: lastStateChange.endsAt,
        startsAtVideoStreamOffsetMilliseconds: lastStateChange.endsAtVideoStreamOffsetMilliseconds,
        endsAt: checkin.checkedInAt,
        endsAtVideoStreamOffsetMilliseconds: checkin.videoStreamOffsetMilliseconds,
        state: checkinState,
        activeParticipant: participant,
      });
      continue;
    }

    // Make sure that the final state change ending lines up with the battle completion end time, if
    // the battle has been completed
    const lastStateChange = stateChanges.at(-1);
    if (battle.completedAt && lastStateChange) {
      lastStateChange.endsAt = battle.completedAt;
    }

    return stateChanges;
  },

  // Computes the start and end offsets of the twilio video recording in millseconds:
  // - Starting at when the battle participant going first initially transitions into the WARM_UP state
  // - Finishing at when the battle participant going last initially transitions into TRANSITION_TO_SUMMARY state
  //
  // This time range is used as the cononical period of time within the battle that a battle
  // viewer should be shown. Because the range is from the FIRST user that goes into WARM_UP
  // until the FIRST user that goes into TRANSITION_TO_SUMMARY, this range:
  // - Excludes the coin toss time, since that doesn't end until the FIRST
  //   user goes into WARM_UP
  // - Excludes the final battle conversations, since those won't start
  //   before the first user goes into TRANSITION_TO_SUMMARY
  //
  // NOTE: if this range cannot be computed, it's likely because the battle checkins this function
  // queries do not have a `videoStreamOffsetMilliseconds` set on them.
  async calculatePlayableVideoMillisecondsRange(battle: BattleWithParticipants) {
    const battleParticipantsInOrder = battle.participants.sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    );
    const firstBattleParticipant = battleParticipantsInOrder[0];
    const lastBattleParticipant = battleParticipantsInOrder.at(-1);

    if (!firstBattleParticipant || !lastBattleParticipant) {
      return null;
    }

    const [firstWarmUpCheckin, firstCompleteCheckin] = await Promise.all([
      prisma.battleParticipantCheckin.findFirst({
        where: {
          battleParticipantId: firstBattleParticipant.id,
          state: 'WARM_UP',
        },
        select: {
          videoStreamOffsetMilliseconds: true,
          checkedInAt: true,
        },
        orderBy: [{ videoStreamOffsetMilliseconds: 'asc' }, { checkedInAt: 'asc' }],
      }),
      prisma.battleParticipantCheckin.findFirst({
        where: {
          battleParticipantId: lastBattleParticipant.id,
          state: 'TRANSITION_TO_SUMMARY',
        },
        select: {
          videoStreamOffsetMilliseconds: true,
          checkedInAt: true,
        },
        orderBy: [{ videoStreamOffsetMilliseconds: 'asc' }, { checkedInAt: 'asc' }],
      }),
    ]);

    if (!firstWarmUpCheckin) {
      return null;
    }
    if (!firstCompleteCheckin) {
      return null;
    }

    // Ideally, rely on the millisecond timestamps being reported, as those are directly from the
    // client and will not contain any sort of network delay possibly mixed in
    if (
      firstWarmUpCheckin.videoStreamOffsetMilliseconds &&
      firstCompleteCheckin.videoStreamOffsetMilliseconds
    ) {
      return [
        firstWarmUpCheckin.videoStreamOffsetMilliseconds,
        firstCompleteCheckin.videoStreamOffsetMilliseconds,
      ];
    }

    // Fall back to computing the offsets using server generated timestamps
    //
    // FIXME: eventually, get rid of this once all phones are sending up video offsets!! This is not
    // nearly as reliable.
    let startOffsetMilliseconds = 0;
    let endOffsetMilliseconds = 0;
    if (firstWarmUpCheckin.checkedInAt && firstBattleParticipant.videoStreamingStartedAt) {
      startOffsetMilliseconds =
        firstWarmUpCheckin.checkedInAt.getTime() -
        firstBattleParticipant.videoStreamingStartedAt.getTime();
    }

    if (!lastBattleParticipant.videoStreamingStartedAt) {
      return null;
    }

    if (firstCompleteCheckin.checkedInAt) {
      endOffsetMilliseconds =
        firstCompleteCheckin.checkedInAt.getTime() -
        lastBattleParticipant.videoStreamingStartedAt.getTime();
    } else if (battle.completedAt) {
      endOffsetMilliseconds =
        battle.completedAt.getTime() - lastBattleParticipant.videoStreamingStartedAt.getTime();
    }

    return [startOffsetMilliseconds, endOffsetMilliseconds];
  },

  async updateExportVideoStatus(
    battle: Battle,
    exportedVideoStatus: Battle['exportedVideoStatus'],
    exportedVideoKey?: Battle['exportedVideoKey'],
  ) {
    battle = await prisma.battle.update({
      where: {
        id: battle.id,
      },
      data: {
        exportedVideoStatus,
        exportedVideoKey,
        exportedVideoQueuedAt: exportedVideoStatus === 'QUEUEING' ? new Date() : undefined,
        exportedVideoStartedAt: exportedVideoStatus === 'DOWNLOADING' ? new Date() : undefined,
        exportedVideoCompletedAt: exportedVideoStatus === 'COMPLETED' ? new Date() : undefined,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(`private-battle-${battle.id}`, 'battle.update', battle);
    return battle;
  },

  // Kicks off the async task to generate an exportable video for the battle. This can only be run
  // after all related participant videos are first processed into *.mp4s.
  async beginGeneratingVideoExport(battle: BattleWithParticipants) {
    await Battle.updateExportVideoStatus(battle, 'QUEUEING');

    // Kick off generating the export video for the battle
    await queueEventToGenerateBattleVideoExport(battle);
  },

  // When called, compute the winner(s) of the specified battle based off votes cast by users,
  // and update each battle participant's `computedDidWinOrTieBattle` field to cache this data. The
  // return value, a boolean, indicates if the cached values were updated or not.
  //
  // NOTE: if a battle bas multiple winners (ie, a tie / draw), then they will both be marked as
  // winners.
  //
  // If the winner of the battle didn't change, this function is a no-op.
  async updateComputedWinningParticipants(
    battle: BattleWithParticipants,
    tx: PrismaTransaction = prisma,
    recomputeUserScores: boolean = true,
  ) {
    // Make sure the `computedHasBeenForfeited` field is up to date on the battle
    const forfeitedParticipants = battle.participants
      .filter((p): p is BattleParticipant & { forfeitedAt: Date } => p.forfeitedAt !== null)
      .sort((a, b) => a.forfeitedAt.getTime() - b.forfeitedAt.getTime());
    const hasBeenForfeited = forfeitedParticipants.length > 0;
    if (battle.computedHasBeenForfeited !== hasBeenForfeited) {
      battle = await Battle.updateComputedHasBeenForfeited(battle, hasBeenForfeited, tx);
    }

    // If the battle is private then users cannot vote on it.
    //
    // All of the cached `computedDidWinOrTieBattle` fields should be set to `null`.
    if (battle.computedPrivacyLevel === 'PRIVATE') {
      // Make sure that the cached winner values are empty in this case
      if (battle.participants.every((p) => p.computedDidWinOrTieBattle === null)) {
        return false;
      }

      // And if the fields are for some reason not empty, reset them back to null
      await tx.battleParticipant.updateMany({
        where: {
          battleId: battle.id,
        },
        data: {
          computedDidWinOrTieBattle: null,
        },
      });

      // If the battle has not started yet, then it should not have received any votes yet
      await tx.battle.update({
        where: {
          id: battle.id,
        },
        data: {
          computedHasReceivedVotes: false,
        },
      });

      return true;
    }
    const battleCreatedAt = battle.createdAt;

    // If a public battle was forfeited, then the winner is always the participant who didn't
    // forfeit (or more accurately, the looser is the one who forfeited first)
    if (battle.computedPrivacyLevel === 'PUBLIC' && hasBeenForfeited) {
      const firstForfeitedParticipant = forfeitedParticipants[0];

      // Check to see if the `computedDidWinOrTieBattle` fields on the participants are already set,
      // and if so, then it's possible to avoid recomputing user scores since this is
      // computationally expensive.
      const areComputedFieldsSetAlready = battle.participants.every((participant) => {
        if (participant.id === firstForfeitedParticipant.id) {
          // The participant that forfeited should have lost
          return participant.computedDidWinOrTieBattle === false;
        } else {
          // The other participant(s) should have all tied (or if only one other participant, won)
          return participant.computedDidWinOrTieBattle === true;
        }
      });
      if (areComputedFieldsSetAlready) {
        return false;
      }

      console.log(
        `[${battle.id}] Battle was forfeited by participant with id ${firstForfeitedParticipant.id}.`,
      );

      // The battle winners changed - update the cached data on all the participant rows associated
      // with the battle so that `firstForfeitedParticipant` is the only one with `false` set.
      await Promise.all([
        tx.battleParticipant.updateMany({
          where: {
            battleId: battle.id,
            id: {
              not: {
                equals: firstForfeitedParticipant.id,
              },
            },
          },
          data: {
            computedDidWinOrTieBattle: true,
          },
        }),
        tx.battleParticipant.updateMany({
          where: {
            battleId: battle.id,
            id: {
              equals: firstForfeitedParticipant.id,
            },
          },
          data: {
            computedDidWinOrTieBattle: false,
          },
        }),
      ]);

      if (!recomputeUserScores) {
        return true;
      }

      // Because the battle winners changed, also now recompute the clout scores of all participants
      // in this battle
      console.log(
        `[${
          battle.id
        }] Rescoring users associated with battle participants, participant id to user id map: ${JSON.stringify(
          Object.fromEntries(battle.participants.map((p) => [p.id, p.userId])),
        )}`,
      );
      const users = await User.getByIds(battle.participants.map((p) => p.userId));
      await User.updateComputedCloutScore(
        users.filter((user): user is ExpandedUser => user !== null),
        battleCreatedAt,
        tx,
      );
      return true;
    }

    // Compute the number of votes that have been cast for each participant in the battle
    const voteTotalsWithParticipantId = await tx.$queryRaw<
      Array<{ battle_participant_id: string; sum: BigInt }>
    >`
      SELECT
        battle_participant_id,
        sum(amount)
      FROM battle_participant_vote
      WHERE battle_participant_id IN (${Prisma.join(battle.participants.map((p) => p.id))})
      GROUP BY battle_participant_id;
    `;

    // FIXME: for some reason, prisma returns a BigInt for the sum value - convert this into a
    // regular number...
    const voteTotalsWithParticipantIdFixed = voteTotalsWithParticipantId.map((n) => ({
      battleParticipantId: n.battle_participant_id,
      amount: (new Number((n as FixMe).sum) as number) + 0,
    }));

    const voteTotals = voteTotalsWithParticipantIdFixed.map((n) => n.amount);
    const largestVoteTotal = Math.max(...voteTotals);

    // NOTE: If there are two users that are tied, they will be both marked as winners.
    const computedWinningBattleOrTieingParticipantIds = voteTotalsWithParticipantIdFixed
      .filter((n) => n.amount === largestVoteTotal)
      .map((n) => n.battleParticipantId);

    const existingWinningOrTieingBattleParticipantIds = battle.participants
      .filter((p) => p.computedDidWinOrTieBattle)
      .map((p) => p.id);

    // Send an update to all conencted clients reporting that the vote totals have changed
    const computedTotalVoteAmountByParticipantId = Object.fromEntries(
      voteTotalsWithParticipantIdFixed.map((t) => [t.battleParticipantId, t.amount]),
    );
    // Backfill any battle participants in the total vote amount list that don't have any votes with
    // the value `0`
    for (const battleParticipant of battle.participants) {
      if (!computedTotalVoteAmountByParticipantId[battleParticipant.id]) {
        computedTotalVoteAmountByParticipantId[battleParticipant.id] = 0;
      }
    }
    pusher.trigger(`private-battle-${battle.id}-results`, 'battle.results', {
      computedTotalVoteAmountByParticipantId,
      winningOrTieingBattleParticipantIds: computedWinningBattleOrTieingParticipantIds,
    });

    // Update the `computedHasReceivedVotes` flag to reflect if this battle has received votes
    const hasReceivedVotes = voteTotalsWithParticipantIdFixed.length > 0;
    if (battle.computedHasReceivedVotes !== hasReceivedVotes) {
      battle = await Battle.updateComputedHasReceivedVotes(battle, hasReceivedVotes, tx);
    }

    // NOTE: it should not be possible for a battle to gain new participants after it has started
    if (
      JSON.stringify(existingWinningOrTieingBattleParticipantIds.sort()) ===
      JSON.stringify(computedWinningBattleOrTieingParticipantIds.sort())
    ) {
      return false;
    }
    console.log(
      `[${battle.id}] Winning or tieing participants in battle ${
        battle.id
      } changed! New winning participant id(s) are ${JSON.stringify(
        computedWinningBattleOrTieingParticipantIds,
      )}`,
    );

    // The battle winners changed - update the cached data on all the participant rows associated
    // with the battle!
    await Promise.all([
      tx.battleParticipant.updateMany({
        where: {
          battleId: battle.id,
          id: {
            in: computedWinningBattleOrTieingParticipantIds,
          },
        },
        data: {
          computedDidWinOrTieBattle: true,
        },
      }),
      tx.battleParticipant.updateMany({
        where: {
          battleId: battle.id,
          id: {
            not: {
              in: computedWinningBattleOrTieingParticipantIds,
            },
          },
        },
        data: {
          computedDidWinOrTieBattle: false,
        },
      }),
    ]);

    if (!recomputeUserScores) {
      return true;
    }

    // Because the battle winners changed, also now recompute the clout scores of all participants
    // in this battle
    console.log(
      `[${
        battle.id
      }] Rescoring users associated with battle participants, participant id to user id map: ${JSON.stringify(
        Object.fromEntries(battle.participants.map((p) => [p.id, p.userId])),
      )}`,
    );
    const users = await User.getByIds(battle.participants.map((p) => p.userId));
    await User.updateComputedCloutScore(
      users.filter((user): user is ExpandedUser => user !== null),
      battleCreatedAt,
      tx,
    );
    return true;
  },

  // Updated the `computedHasReceivedVotes` flag to the given new value.
  async updateComputedHasReceivedVotes(
    battle: BattleWithParticipants,
    computedHasReceivedVotes: Battle['computedHasReceivedVotes'],
    tx: PrismaTransaction = prisma,
  ) {
    battle = await tx.battle.update({
      where: {
        id: battle.id,
      },
      data: {
        computedHasReceivedVotes,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(`private-battle-${battle.id}`, 'battle.update', battle);
    return battle;
  },

  // Updated the `computedHasBeenForfeited` flag to the given new value.
  async updateComputedHasBeenForfeited(
    battle: BattleWithParticipants,
    computedHasBeenForfeited: Battle['computedHasBeenForfeited'],
    tx: PrismaTransaction = prisma,
  ) {
    battle = await tx.battle.update({
      where: {
        id: battle.id,
      },
      data: {
        computedHasBeenForfeited,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(`private-battle-${battle.id}`, 'battle.update', battle);
    return battle;
  },
};

export default Battle;
