import { subMilliseconds } from 'date-fns';
import prisma from './prisma.ts';
import pusher from './pusher.ts';
import Battle from './battle.ts';
import BattleParticipant from './battle-participant.ts';
import { PrismaTransaction } from './prisma.ts';
import User, { UserMe, USER_FIELDS } from './user.ts';
import { Challenge as PrismaChallenge, User as PrismaUser } from '@prisma/client';

const DEFAULT_INCLUDE = {
  createdByUser: {
    select: USER_FIELDS,
  },
  challengedUser: {
    select: USER_FIELDS,
  },
};

type Challenge = PrismaChallenge & { challengedUser: User };

type ChallengeWhere = NonNullable<
  NonNullable<Parameters<typeof prisma.challenge.findMany>[0]>['where']
>;

// How long must it be since a user checked in to the challenge for the user to still be considered
// in the waiting room?
//
// NOTE: this duration must stay as short as possible - if a user leaves the waiting room
// during this duration, the system will errantly think they are still in the waiting room.
const CHALLENGE_WAITING_ROOM_LAST_ALIVE_AT_THRESHOLD_MILLISECONDS = 2000;

const Challenge = {
  async allPendingInContextOfUserMe(
    page: number,
    pageSize: number,
    userMe: UserMe,
  ): Promise<Array<Challenge>> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    return prisma.challenge.findMany({
      where: Challenge.generatePendingFilterInContextOfUserMe(userMe),

      orderBy: { createdAt: 'desc' },

      include: DEFAULT_INCLUDE,
      skip,
      take,
    });
  },
  async countPendingInContextOfUserMe(userMe: UserMe) {
    return prisma.challenge.count({
      where: Challenge.generatePendingFilterInContextOfUserMe(userMe),
    });
  },
  generatePendingFilterInContextOfUserMe(userMe: UserMe): ChallengeWhere {
    return {
      AND: [
        // Ensure that all challenges that are returned are associated with the given
        // user me value
        {
          OR: [{ createdByUserId: userMe.id }, { challengedUserId: userMe.id }],
        },

        // And ensure that only pending challenges are returned
        { status: 'PENDING' },
      ],
    };
  },

  async createInContextOfUserMe(
    userToChallenge: User,
    userMe: Pick<UserMe, 'id'>,
    now: Date = new Date(),
  ): Promise<Challenge> {
    return prisma.$transaction(async (tx) => {
      // Before creating the challenge, cancel all pre-existing pending challenges that the user has
      // created
      //
      // A user can only be in one challenge at a time!
      const pendingChallenges = await tx.challenge.findMany({
        where: {
          status: 'PENDING',
          createdByUserId: userMe.id,
        },
        include: DEFAULT_INCLUDE,
      });
      for (const pendingChallenge of pendingChallenges) {
        await Challenge.cancelChallenge(pendingChallenge, userMe, now);
      }

      let challenge = await tx.challenge.create({
        data: {
          createdByUserId: userMe.id,
          createdByUserInWaitingRoom: true,
          createdByUserLastAliveAt: now,
          challengedUserId: userToChallenge.id,
        },
        include: DEFAULT_INCLUDE,
      });

      pusher.trigger(
        `private-user-${challenge.createdByUserId}-challenges`,
        'challenge.create',
        challenge,
      );
      pusher.trigger(
        `private-user-${challenge.challengedUserId}-challenges`,
        'challenge.create',
        challenge,
      );

      return challenge;
    });
  },

  async getById(id: Challenge['id']): Promise<Challenge | null> {
    return prisma.challenge.findUnique({ where: { id }, include: DEFAULT_INCLUDE });
  },

  async getByIdInContextOfUserMe(id: Challenge['id'], userMe: UserMe): Promise<Challenge | null> {
    const challenge = await Challenge.getById(id);
    if (!challenge) {
      return null;
    }

    // Make sure that the challenge mentions the given user in order for that user to be able to
    // access the challenge
    if (challenge.challengedUserId !== userMe.id && challenge.createdByUserId !== userMe.id) {
      return null;
    }

    return challenge;
  },

  async getByIdAndAssociatedUser(
    id: Challenge['id'],
    clerkUserId: PrismaUser['clerkId'] | null,
  ): Promise<Challenge | null> {
    const userMe = await User.getByClerkId(clerkUserId);
    if (userMe) {
      return Challenge.getByIdInContextOfUserMe(id, userMe);
    } else {
      return null;
    }
  },

  async getByIds(ids: Array<Challenge['id']>): Promise<Array<Challenge>> {
    const results = await prisma.challenge.findMany({
      where: { id: { in: ids } },
      include: DEFAULT_INCLUDE,
    });
    return ids.map((id) => results.find((r) => r.id === id)!);
  },

  async refreshFromDatabase(challenge: Pick<Challenge, 'id'>): Promise<Challenge> {
    const updatedChallenge = await Challenge.getById(challenge.id);
    if (!updatedChallenge) {
      throw new Error(
        `Error refreshing challenge from database: challenge ${challenge.id} not found!`,
      );
    }
    return updatedChallenge;
  },

  async mostRecentlyCreated(): Promise<Challenge | null> {
    return prisma.challenge.findFirst({
      include: DEFAULT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  },

  // When a check in request is made, update the last checked in timestamp for the given user on the
  // challenge.
  async checkInToWaitingRoom(challenge: Challenge, user: User, now: Date = new Date()) {
    if (challenge.status !== 'PENDING') {
      throw new Error(
        `Cannot check in to challenge with id ${challenge.id}, the challenge's status is not PENDING (found ${challenge.status})`,
      );
    }

    return prisma.$transaction(async (tx) => {
      let otherUserId: User['id'];

      const data: Partial<PrismaChallenge> = {};
      if (challenge.createdByUserId === user.id) {
        data.createdByUserInWaitingRoom = true;
        data.createdByUserLastAliveAt = now;
        otherUserId = challenge.challengedUserId;
      } else if (challenge.challengedUserId === user.id) {
        data.challengedUserInWaitingRoom = true;
        data.challengedUserLastAliveAt = now;
        otherUserId = challenge.createdByUserId;
      } else {
        throw new Error(
          `User ${user.id} was not the user that created this challenge ${challenge.createdByUserId} or the user that was challenged ${challenge.challengedUserId}, so unable to do anything!`,
        );
      }

      let updatedChallenge = await tx.challenge.update({
        where: { id: challenge.id },
        data,
        include: DEFAULT_INCLUDE,
      });

      pusher.trigger(
        `private-user-${updatedChallenge.createdByUserId}-challenges`,
        'challenge.update',
        updatedChallenge,
      );
      pusher.trigger(
        `private-user-${updatedChallenge.challengedUserId}-challenges`,
        'challenge.update',
        updatedChallenge,
      );

      // If users have not checked in recently, then the challenge shouldn't start yet
      const mustHaveCheckedInTimestamp = subMilliseconds(
        now,
        CHALLENGE_WAITING_ROOM_LAST_ALIVE_AT_THRESHOLD_MILLISECONDS,
      );
      if (
        updatedChallenge.createdByUserLastAliveAt &&
        updatedChallenge.createdByUserLastAliveAt >= mustHaveCheckedInTimestamp &&
        updatedChallenge.challengedUserLastAliveAt &&
        updatedChallenge.challengedUserLastAliveAt >= mustHaveCheckedInTimestamp
      ) {
        // All users are ready - start the challenge!
        //
        // NOTE: this doesn't start the battle - this creates the battle and associates the
        // participants, but the participants still need to mark themselves as ready before the battle
        // will actually start
        await Challenge.startChallenge(updatedChallenge, user, now, tx);
      } else {
        // The other user hasn't checked in lately or ever, so send a message asking them to check
        // in. Once the other user checks in, both last alive at timestamps should be recent and the
        // battle should start.
        //
        // NOTE: This avoids requiring users associated with the battle having to constantly check
        // in by polling on an interval, since it's not important to know if a user is constantly
        // online, just online at an instantenous moment.
        pusher.trigger(`private-user-${otherUserId}-challenges`, 'challenge.requestCheckIn', {
          challengeId: updatedChallenge.id,
        });
      }

      return updatedChallenge;
    });
  },

  // When a user leaves the waiting room, mark them as no longer active
  async leaveWaitingRoom(challenge: Challenge, user: User) {
    if (challenge.status !== 'PENDING') {
      throw new Error(
        `Cannot leave challenge with id ${challenge.id}, the challenge's status is not PENDING (found ${challenge.status})`,
      );
    }

    const data: Partial<PrismaChallenge> = {};
    if (challenge.createdByUserId === user.id) {
      data.createdByUserInWaitingRoom = false;
    } else if (challenge.challengedUserId === user.id) {
      data.challengedUserInWaitingRoom = false;
    } else {
      throw new Error(
        `User ${user.id} was not the user that created this challenge ${challenge.createdByUserId} or the user that was challenged ${challenge.challengedUserId}, so unable to do anything!`,
      );
    }

    let updatedChallenge = await prisma.challenge.update({
      where: { id: challenge.id },
      data,
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-user-${updatedChallenge.createdByUserId}-challenges`,
      'challenge.update',
      updatedChallenge,
    );
    pusher.trigger(
      `private-user-${updatedChallenge.challengedUserId}-challenges`,
      'challenge.update',
      updatedChallenge,
    );

    return updatedChallenge;
  },

  async cancelChallenge(challenge: Challenge, userMe: Pick<UserMe, 'id'>, now: Date = new Date()) {
    if (challenge.status !== 'PENDING') {
      throw new Error(
        `Cannot cancel challenge with id ${challenge.id}, the challenge's status is not PENDING (found ${challenge.status})`,
      );
    }

    let updatedChallenge = await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledByUserId: userMe.id,
        createdByUserInWaitingRoom: false,
        challengedUserInWaitingRoom: false,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-user-${updatedChallenge.createdByUserId}-challenges`,
      'challenge.update',
      updatedChallenge,
    );
    pusher.trigger(
      `private-user-${updatedChallenge.challengedUserId}-challenges`,
      'challenge.update',
      updatedChallenge,
    );

    return updatedChallenge;
  },

  async startChallenge(
    challenge: Challenge,
    userMe: Pick<UserMe, 'id'>,
    now: Date = new Date(),
    tx: PrismaTransaction = prisma,
  ): Promise<Challenge> {
    if (challenge.status !== 'PENDING') {
      throw new Error(
        `Cannot start challenge with id ${challenge.id}, the challenge's status is not PENDING (found ${challenge.status})`,
      );
    }

    // Create a new battle, associating the two users that are in the challenge
    const createdByUserParticipant = await BattleParticipant.create(challenge.createdByUserId, tx);
    const challengedUserParticipant = await BattleParticipant.create(
      challenge.challengedUserId,
      tx,
    );
    const battle = await Battle.create(
      [createdByUserParticipant, challengedUserParticipant],
      'PRIVATE', // NOTE: this is just the privacy level the battle starts at, it potentially changes
      undefined,
      now,
      tx,
    );

    // Update the challenge to be associated with the newly created battle
    let updatedChallenge = await tx.challenge.update({
      where: { id: challenge.id },
      data: {
        status: 'STARTED',
        startedAt: now,
        startedByUserId: userMe.id,
        battleId: battle.id,
      },
      include: DEFAULT_INCLUDE,
    });

    pusher.trigger(
      `private-user-${updatedChallenge.createdByUserId}-challenges`,
      'challenge.update',
      updatedChallenge,
    );
    pusher.trigger(
      `private-user-${updatedChallenge.challengedUserId}-challenges`,
      'challenge.update',
      updatedChallenge,
    );

    return updatedChallenge;
  },
};

export default Challenge;
