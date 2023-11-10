import { Prisma, User as PrismaUser, BattleView as PrismaBattleView } from '@prisma/client';
import Battle, { BattleWithParticipants } from './battle.ts';
import generateTrendingSqlFragment from './battle-trending-sql.ts';
import BattleParticipant from './battle-participant.ts';
import prisma, { PrismaTransaction } from './prisma.ts';
import pusher from '../lib/pusher.ts';
import Elo, { DEFAULT_CONSTANTS } from './elo.ts';

// The initial "clout score" value that newly created users will start with.
export const USER_INITIAL_SCORE = 5000;

// The maximum number of votes that a user can cast in a single battle
export const USER_MAX_VOTES_PER_BATTLE = 20;

// These are the base fields in the user object. These fields are meaningful without context and
// represent raw data fetchable from the database.
type User = {
  id: PrismaUser['id'];
  handle: PrismaUser['handle'];
  name: PrismaUser['name'];
  profileImageUrl: PrismaUser['profileImageUrl'];
  computedScore: PrismaUser['computedScore'];
  computedFollowersCount: PrismaUser['computedFollowersCount'];
  computedFollowingCount: PrismaUser['computedFollowingCount'];
};
export const USER_FIELDS = {
  id: true,
  handle: true,
  name: true,
  profileImageUrl: true,
  computedScore: true,
  computedFollowersCount: true,
  computedFollowingCount: true,
};

// The ExpandedUser object contains extra user metadata that doesn't make sense to include
// everywhere that a user is specified, but any time that a user is serialized standalone back to
// the client, it's sent
export type ExpandedUser = User & {
  intro: PrismaUser['intro'];
  locationName: PrismaUser['locationName'];
  locationLatitude: PrismaUser['locationLatitude'];
  locationLongitude: PrismaUser['locationLongitude'];
  favoriteRapperSpotifyId: PrismaUser['favoriteRapperSpotifyId'];
  favoriteRapperName: PrismaUser['favoriteRapperName'];
  favoriteSongSpotifyId: PrismaUser['favoriteSongSpotifyId'];
  favoriteSongName: PrismaUser['favoriteSongName'];
  favoriteSongArtistName: PrismaUser['favoriteSongArtistName'];
  instagramHandle: PrismaUser['instagramHandle'];
  soundcloudHandle: PrismaUser['soundcloudHandle'];
};
const EXPANDED_USER_FIELDS = {
  ...USER_FIELDS,
  intro: true,
  locationName: true,
  locationLatitude: true,
  locationLongitude: true,
  favoriteRapperSpotifyId: true,
  favoriteRapperName: true,
  favoriteSongSpotifyId: true,
  favoriteSongName: true,
  favoriteSongArtistName: true,
  instagramHandle: true,
  soundcloudHandle: true,
};

// These fields are fields that are only relevant about a user in the context of a currently authed
// user.
//
// NOTE: These fields are NOT exposed in contexts where a single instance user object is broadcast
// across many different users - ie, sending data via pusher
type UserInContextOfUserMe = ExpandedUser & {
  computedIsBeingFollowedByUserMe: boolean;
  computedIsFollowingUserMe: boolean;
};

// These fields are fields that are only ever exposed about a given use to that user themselves -
// these fields are "private".
export type UserMe = UserInContextOfUserMe & {
  phoneNumber: PrismaUser['phoneNumber'];
  lastViewedBattleId: Battle['id'] | null;
  maxNumberOfVotesPerBattle: number;
};

function computeBattleResult(
  activeParticipant: Pick<BattleParticipant, 'id' | 'userId' | 'computedDidWinOrTieBattle'>,
  opponentParticipant: Pick<BattleParticipant, 'id' | 'userId' | 'computedDidWinOrTieBattle'>,
) {
  if (
    activeParticipant.computedDidWinOrTieBattle &&
    opponentParticipant.computedDidWinOrTieBattle
  ) {
    return 0.5;
  } else if (
    !activeParticipant.computedDidWinOrTieBattle &&
    !opponentParticipant.computedDidWinOrTieBattle
  ) {
    return 0.5;
  } else if (activeParticipant.computedDidWinOrTieBattle) {
    return 1;
  } else if (opponentParticipant.computedDidWinOrTieBattle) {
    return 0;
  } else {
    return 0;
  }
}

type UserWhere = NonNullable<NonNullable<Parameters<typeof prisma.user.findMany>[0]>['where']>;

const User = {
  async allInContextOfUserMe(
    page: number,
    pageSize: number,
    userMe: UserMe,
    search?: string,
  ): Promise<Array<UserInContextOfUserMe>> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    const result = await prisma.user.findMany({
      where: User.generateAllFilter(search),
      select: { id: true },

      // Sort the most popular users to the top by default
      // This facilutates a user being able to search the list to find other users in the system
      orderBy: {
        computedFollowersCount: 'desc',
      },
      skip,
      take,
    });

    const users = await User.getByIdsInContextOfUserMe(
      result.map((u) => u.id),
      userMe,
    );
    return users.filter((u): u is UserInContextOfUserMe => u !== null);
  },

  generateAllFilter(search?: string): UserWhere {
    return {
      AND: [
        search
          ? {
              // FIXME: investigate a better searching mechanism. Prisma seems to have at least preview
              // support for full text search, which would let one do something like sort by relevancy,
              // etc
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { handle: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        {
          name: { not: { equals: null } },
          handle: { not: { equals: null } },
        },
      ],
    };
  },

  async count(search?: string) {
    return prisma.user.count({ where: User.generateAllFilter(search) });
  },

  async getByClerkId(clerkId: PrismaUser['clerkId'] | null): Promise<UserMe | null> {
    if (!clerkId) {
      return null;
    }

    const result = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        battleViews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { battleId: true },
        },
      },
    });

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      handle: result.handle,
      name: result.name,
      profileImageUrl: result.profileImageUrl,

      computedScore: result.computedScore,
      computedFollowingCount: result.computedFollowingCount,
      computedFollowersCount: result.computedFollowersCount,

      // A user should never be able to follow themselves.
      computedIsBeingFollowedByUserMe: false,
      // A user should never be followed by themselves either.
      computedIsFollowingUserMe: false,

      phoneNumber: result.phoneNumber,
      lastViewedBattleId: result.battleViews.length > 0 ? result.battleViews[0].battleId : null,
      maxNumberOfVotesPerBattle: USER_MAX_VOTES_PER_BATTLE,

      // Bio data
      intro: result.intro,
      locationName: result.locationName,
      locationLatitude: result.locationLatitude,
      locationLongitude: result.locationLongitude,
      favoriteRapperSpotifyId: result.favoriteRapperSpotifyId,
      favoriteRapperName: result.favoriteRapperName,
      favoriteSongSpotifyId: result.favoriteSongSpotifyId,
      favoriteSongName: result.favoriteSongName,
      favoriteSongArtistName: result.favoriteSongArtistName,
      instagramHandle: result.instagramHandle,
      soundcloudHandle: result.soundcloudHandle,
    };
  },
  async getById(id: User['id']): Promise<ExpandedUser | null> {
    return prisma.user.findUnique({ where: { id }, select: EXPANDED_USER_FIELDS });
  },
  async getByIds(ids: Array<User['id']>): Promise<Array<ExpandedUser | null>> {
    const results = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: EXPANDED_USER_FIELDS,
    });
    return ids.map((id) => {
      const user = results.find((u) => u.id === id);
      return user || null;
    });
  },
  async getByIdInContextOfUserMe(
    id: User['id'],
    userMe: UserMe,
  ): Promise<UserInContextOfUserMe | null> {
    const results = await User.getByIdsInContextOfUserMe([id], userMe);
    return results[0] || null;
  },
  async getByIdsInContextOfUserMe(
    ids: Array<User['id']>,
    userMe: UserMe,
  ): Promise<Array<UserInContextOfUserMe | null>> {
    if (ids.length === 0) {
      return [];
    }

    const rawResults = await prisma.$queryRaw<
      Array<{
        id: UserInContextOfUserMe['id'];
        handle: UserInContextOfUserMe['handle'];
        name: UserInContextOfUserMe['name'];
        profile_image_url: UserInContextOfUserMe['profileImageUrl'];
        computed_score: UserInContextOfUserMe['computedScore'];
        computed_followers_count: UserInContextOfUserMe['computedFollowersCount'];
        computed_following_count: UserInContextOfUserMe['computedFollowingCount'];
        computed_is_being_followed_by_user_me: UserInContextOfUserMe['computedIsBeingFollowedByUserMe'];
        computed_is_following_user_me: UserInContextOfUserMe['computedIsFollowingUserMe'];

        // Bio information
        intro: UserInContextOfUserMe['intro'];
        location_name: UserInContextOfUserMe['locationName'];
        location_latitude: UserInContextOfUserMe['locationLatitude'];
        location_longitude: UserInContextOfUserMe['locationLongitude'];
        favorite_rapper_spotify_id: UserInContextOfUserMe['favoriteRapperSpotifyId'];
        favorite_rapper_name: UserInContextOfUserMe['favoriteRapperName'];
        favorite_song_spotify_id: UserInContextOfUserMe['favoriteSongSpotifyId'];
        favorite_song_name: UserInContextOfUserMe['favoriteSongName'];
        favorite_song_artist_name: UserInContextOfUserMe['favoriteSongArtistName'];
        instagram_handle: UserInContextOfUserMe['instagramHandle'];
        soundcloud_handle: UserInContextOfUserMe['soundcloudHandle'];
      }>
    >`
      SELECT
        clerk_user.*,

        -- Compute whether the user in the table is being followed by the user 
        EXISTS (
          SELECT id
          FROM clerk_user_follows
          WHERE
            clerk_user_follows.user_id IN (${Prisma.join([userMe.id])}) AND
            clerk_user_follows.follows_user_id = clerk_user.id
        ) AS computed_is_being_followed_by_user_me,

        -- Compute whether the user in the table is following the user
        EXISTS (
          SELECT id
          FROM clerk_user_follows
          WHERE
            clerk_user_follows.user_id = clerk_user.id AND
            clerk_user_follows.follows_user_id IN (${Prisma.join([userMe.id])})
        ) AS computed_is_following_user_me
      FROM clerk_user
      WHERE
        clerk_user.id IN (${Prisma.join(ids)});
    `;

    const results = rawResults.map(
      (user): UserInContextOfUserMe => ({
        id: user.id,
        profileImageUrl: user.profile_image_url,
        handle: user.handle,
        name: user.name,
        computedScore: user.computed_score,
        computedFollowersCount: user.computed_followers_count,
        computedFollowingCount: user.computed_following_count,
        computedIsBeingFollowedByUserMe: user.computed_is_being_followed_by_user_me,
        computedIsFollowingUserMe: user.computed_is_following_user_me,

        intro: user.intro,
        locationName: user.location_name,
        locationLatitude: user.location_latitude,
        locationLongitude: user.location_longitude,
        favoriteRapperSpotifyId: user.favorite_rapper_spotify_id,
        favoriteRapperName: user.favorite_rapper_name,
        favoriteSongSpotifyId: user.favorite_song_spotify_id,
        favoriteSongName: user.favorite_song_name,
        favoriteSongArtistName: user.favorite_song_artist_name,
        instagramHandle: user.instagram_handle,
        soundcloudHandle: user.soundcloud_handle,
      }),
    );

    return ids.map((id) => results.find((r) => r.id === id) || null);
  },

  async updateByIdInContextOfUserMe(
    id: User['id'],
    fieldsToUpdate: Partial<
      Pick<
        UserInContextOfUserMe,
        | 'intro'
        | 'locationName'
        | 'locationLatitude'
        | 'locationLongitude'
        | 'favoriteRapperSpotifyId'
        | 'favoriteRapperName'
        | 'favoriteSongSpotifyId'
        | 'favoriteSongName'
        | 'favoriteSongArtistName'
        | 'instagramHandle'
        | 'soundcloudHandle'
      >
    >,
    userMe: UserMe,
  ): Promise<UserInContextOfUserMe | null> {
    const result = await prisma.user.update({
      where: { id },
      data: fieldsToUpdate,
      select: { id: true },
    });

    return User.getByIdInContextOfUserMe(result.id, userMe);
  },

  // Returns a list of all battle ids that the given user was a battler / participant in, as well as
  // the count of battles in the non paginated list.
  //
  // This list can either be sorted in TRENDING or RECENT order.
  async getBattleIdsParticipatedIn(
    userId: User['id'],
    userMe: UserMe,
    sort: 'RECENT' | 'TRENDING' = 'RECENT',
    includeEmptyForfeitedBattles: boolean = false,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<[Array<BattleWithParticipants['id']>, number]> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    let selectFieldClauses = Prisma.sql`battle.id`;
    let whereClauses = Prisma.sql`
        -- Filter out battles that the given user didn't participate in
        EXISTS (
          SELECT
            battle_participant.id
          FROM battle_participant
          WHERE
            battle_participant.battle_id = battle.id AND
            battle_participant.user_id = ${userId}
        ) AND

        -- Only include battles that the user has permission to view
        (
          battle.computed_privacy_level = 'PUBLIC' OR
          -- To view a private battle, a user must have participated in the battle
          (battle.computed_privacy_level = 'PRIVATE' AND EXISTS (
            SELECT id FROM battle_participant
            WHERE
              battle_participant.battle_id = battle.id AND 
              battle_participant.user_id = ${userMe.id}
          ))
        ) AND

        (
          (
            -- Exclude battles that didn't start (ie, battles where a user forfeited early on, etc)
            battle.started_at IS NOT NULL AND

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
          )

          -- OR optionally, if a parameter was set, show incomplete battles where a user forfeited
          ${
            includeEmptyForfeitedBattles
              ? Prisma.sql`OR battle.computed_has_been_forfeited`
              : Prisma.empty
          }
        )
    `;
    let orderBy = Prisma.sql`battle.id`;

    switch (sort) {
      case 'RECENT':
        orderBy = Prisma.sql`created_at DESC`;
        break;
      case 'TRENDING':
        selectFieldClauses = Prisma.sql`
            ${selectFieldClauses},
            (${generateTrendingSqlFragment(Prisma.sql`battle`, Prisma.sql`id`)}) as trending_score
        `;

        // The trending feed should only show public battles
        whereClauses = Prisma.sql`
          ${whereClauses} AND
          battle.computed_privacy_level = 'PUBLIC'
        `;

        orderBy = Prisma.sql`
          -- Show battles with the highest trending score first, as they have been
          -- voted on most recently
          trending_score DESC,
          -- Of battles with the same trending score, show battles that have been created first
          created_at DESC
        `;
        break;
    }

    const results = await prisma.$queryRaw<Array<{ id: Battle['id'] }>>`
      SELECT ${selectFieldClauses}
      FROM battle
      WHERE ${whereClauses}
      ORDER BY ${orderBy}
      LIMIT ${Prisma.raw(`${take}`)}
      OFFSET ${Prisma.raw(`${skip}`)}
    `;

    const totalCount = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(battle.id) AS count FROM battle
      WHERE ${whereClauses}
    `;

    return [
      results.map((r) => r.id),

      // FIXME: for some reason, prisma returns a BigInt for this total value -
      // convert this into a regular number...
      (new Number(totalCount[0].count) as number) + 0,
    ];
  },

  async refreshFromDatabase(user: Pick<User, 'id'>): Promise<ExpandedUser> {
    const updatedUser = await User.getById(user.id);
    if (!updatedUser) {
      throw new Error(`Error refreshing user from database: user ${user.id} not found!`);
    }
    return updatedUser;
  },

  // Given a user, get all users that are currently following the user
  async getFollowing(
    user: User,
    userMe: UserMe,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<[Array<UserInContextOfUserMe>, number]> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    const rawUserIds = await prisma.user.findMany({
      where: {
        followedBy: {
          some: {
            userId: user.id,
          },
        },
      },
      select: { id: true },
      take,
      skip,
    });
    const userCount = await prisma.user.count({
      where: {
        followedBy: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    const users = await User.getByIdsInContextOfUserMe(
      rawUserIds.map((u) => u.id),
      userMe,
    );
    return [users.filter((u): u is UserInContextOfUserMe => u !== null), userCount];
  },

  // Given a user, get all users that are currently being followed by the user
  async getFollowers(
    user: User,
    userMe: UserMe,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<[Array<UserInContextOfUserMe>, number]> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    const rawUserIds = await prisma.user.findMany({
      where: {
        following: {
          some: {
            followsUserId: user.id,
          },
        },
      },
      select: { id: true },
      take,
      skip,
    });
    const userCount = await prisma.user.count({
      where: {
        followedBy: {
          some: {
            followsUserId: user.id,
          },
        },
      },
    });

    const users = await User.getByIdsInContextOfUserMe(
      rawUserIds.map((u) => u.id),
      userMe,
    );
    return [users.filter((u): u is UserInContextOfUserMe => u !== null), userCount];
  },

  // Given a user, begin following the specified user id
  async followUser(userMe: User, userToFollowId: User['id']): Promise<ExpandedUser | null> {
    if (userMe.id === userToFollowId) {
      // A user cannot follow themselves.
      return null;
    }

    return prisma.$transaction(async (tx) => {
      // NOTE: there is a unique constraint on `UserFollows` to ensure that a user can only follow
      // another user once.
      let userFollow;
      try {
        userFollow = await tx.userFollows.create({
          data: {
            userId: userMe.id,
            followsUserId: userToFollowId,
          },
        });
      } catch (err) {
        console.error(`Error with user ${userMe.id} following ${userToFollowId}:`, err);
        return null;
      }

      // Distribute that the new userfollow row was created to all connected clients
      pusher.trigger(`private-user-${userMe.id}-follows`, 'userFollow.create', userFollow);
      pusher.trigger(`private-user-${userToFollowId}-follows`, 'userFollow.create', userFollow);

      // If following the user was successful, then update the computed follow count fields on the
      // user
      const updatedUser = await tx.user.update({
        where: {
          id: userMe.id,
        },
        data: {
          computedFollowingCount: {
            increment: 1,
          },
        },
        select: EXPANDED_USER_FIELDS,
      });
      pusher.trigger(`private-user-${updatedUser.id}`, 'user.update', updatedUser);

      const updatedOtherUser = await tx.user.update({
        where: {
          id: userToFollowId,
        },
        data: {
          computedFollowersCount: {
            increment: 1,
          },
        },
        select: EXPANDED_USER_FIELDS,
      });
      pusher.trigger(`private-user-${updatedOtherUser.id}`, 'user.update', updatedOtherUser);

      return updatedUser;
    });
  },

  // Given a user, unfollow the specified user id
  async unfollowUser(userMe: User, userToUnfollowId: User['id']): Promise<ExpandedUser | null> {
    if (userMe.id === userToUnfollowId) {
      // A user cannot unfollow themselves.
      return null;
    }

    return prisma.$transaction(async (tx) => {
      // NOTE: there should only ever be one userfollow row linking two users, and this is verified
      // with a database constraint.
      // This is a `findMany` mostly to be thorough, and this is probably overkill
      const userFollows = await tx.userFollows.findMany({
        where: {
          userId: userMe.id,
          followsUserId: userToUnfollowId,
        },
      });

      const deleteResult = await tx.userFollows.deleteMany({
        where: {
          id: { in: userFollows.map((f) => f.id) },
        },
      });

      if (deleteResult.count === 0) {
        return null;
      }

      for (const userFollow of userFollows) {
        // Distribute the newly deleted userfollow row to all connected clients
        pusher.trigger(`private-user-${userMe.id}-follows`, 'userFollow.delete', userFollow);
        pusher.trigger(`private-user-${userToUnfollowId}-follows`, 'userFollow.delete', userFollow);
      }

      // Remove a count of the deleted rows from the computed counts
      const updatedUser = await tx.user.update({
        where: {
          id: userMe.id,
        },
        data: {
          computedFollowingCount: {
            decrement: deleteResult.count,
          },
        },
        select: EXPANDED_USER_FIELDS,
      });
      pusher.trigger(`private-user-${updatedUser.id}`, 'user.update', updatedUser);

      const updatedOtherUser = await tx.user.update({
        where: {
          id: userToUnfollowId,
        },
        data: {
          computedFollowersCount: {
            decrement: deleteResult.count,
          },
        },
        select: EXPANDED_USER_FIELDS,
      });
      pusher.trigger(`private-user-${updatedOtherUser.id}`, 'user.update', updatedOtherUser);

      return updatedUser;
    });
  },

  // This function, when called, will recompute the cached following / followers values for ALL users in the
  // database. It will loop through the whole users table, from start to end, and compute the
  // counts for each user, storing the result.
  //
  // NOTE: This whole thing is kinda frankly an overoptimization. Ideally, this count could be
  // computed on read, but prisma makes getting the count of a related model in a `findMany`
  // impossible, so to compute this for a list of users would require writing a `n+1` query.
  async forceRecomputeFollowingFollowers(users: Array<User> | 'all' = 'all') {
    const userData =
      users === 'all'
        ? await prisma.user.findMany({
            select: { id: true, computedFollowersCount: true, computedFollowingCount: true },
          })
        : users;

    let updateCount = 0;
    for (const user of userData) {
      const followingCount = await prisma.userFollows.count({
        where: {
          userId: user.id,
        },
      });
      const followersCount = await prisma.userFollows.count({
        where: {
          followsUserId: user.id,
        },
      });

      if (
        user.computedFollowingCount !== followingCount ||
        user.computedFollowersCount !== followersCount
      ) {
        console.log(
          `[${user.id}] updating... following:${user.computedFollowingCount} -> ${followingCount}, followers:${user.computedFollowersCount} -> ${followersCount}`,
        );

        const updatedUser = await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            computedFollowingCount: followingCount,
            computedFollowersCount: followersCount,
          },
          select: EXPANDED_USER_FIELDS,
        });
        pusher.trigger(`private-user-${updatedUser.id}`, 'user.update', updatedUser);
        updateCount += 1;
      }
    }
    console.log(`Updated ${updateCount} users.`);
  },

  async setLastViewedBattle(
    userId: User['id'],
    lastViewedBattleId: Battle['id'] | null,
    timeSpentWatchingBattleInMilliseconds: PrismaBattleView['timeSpentWatchingBattleInMilliseconds'],
  ) {
    await prisma.battleView.create({
      data: {
        userId,
        battleId: lastViewedBattleId,
        completedViewingAt: new Date(),
        timeSpentWatchingBattleInMilliseconds,
      },
    });
  },

  async isChallengingAnotherUser(user: User) {
    const count = await prisma.challenge.count({
      where: {
        status: 'PENDING',
        createdByUserId: user.id,
      },
    });
    return count > 0;
  },

  // When called, this function will recompute the user's clout score value taking into account new
  // battles that have been won or lost. This function MUST be called after any operation related to
  // a battle changing winner / looser for the clout score to update.
  //
  // By default, this function starts at the beginning of time, starting with the default clout
  // score assigned to a user when they join the app (see `USER_INITIAL_SCORE`), and recomputes the
  // score by aggregating through ALL battles that the user has been part of throughout ALL time.
  //
  // As a performance optimization, this function also accepts an optional timestamp `startingAt`,
  // and if specified, the clout score aggregation will ONLY be computed from this timestamp until
  // the current time, using the cached timestamp stored on the most recent battle before
  // `startingAt. It is strongly recommended this second parameter to be included to keep things
  // fast!
  async updateComputedCloutScore(users: Array<User>, startingAt?: Date, tx?: PrismaTransaction) {
    const run = async (tx: PrismaTransaction) => {
      // Find the battle that was the last one that happened before or at `startingAt`
      //
      // This battle's cached user scores on the participant will be used as a base to start
      // aggregating from
      const startingBattle = await tx.battle.findFirst({
        where: {
          // Get all battles that the specified user has participated in
          participants: {
            some: {
              userId: {
                in: users.map((u) => u.id),
              },
            },
          },
          createdAt: startingAt
            ? {
                // Filter out battles that have not started yet
                lte: startingAt,
              }
            : {},
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          participants: {
            select: {
              id: true,
              userId: true,
              userComputedScoreAtBattleCreatedAt: true,
              computedDidWinOrTieBattle: true,
            },
          },
        },
      });

      if (!startingBattle) {
        console.warn(
          `WARNING: no battles found to aggregate for user(s) ${users
            .map((u) => u.id)
            .join(', ')}, skipping...`,
        );
        return users;
      }

      // Store a cache of all user
      const userScoresCache = new Map<User['id'], number>();
      for (const participant of startingBattle.participants) {
        if (participant.userComputedScoreAtBattleCreatedAt !== null) {
          userScoresCache.set(participant.userId, participant.userComputedScoreAtBattleCreatedAt);
        } else {
          userScoresCache.set(participant.userId, USER_INITIAL_SCORE);
        }
      }

      let nextScorableBattle;
      for (let index = 0; true; index += 1) {
        // FIXME: this `skip` approach could potentially prove to not work so well - this shouldn't
        // ever happen (and if it does, maybe there are bigger problems), but this approach doesn't
        // work very well if a new battle is started at any other timestamp than "now". If a battle
        // is started at an old timestamp while this process is halfway through, it's going to cause
        // the pagination to offset by one and result in either a battle being skipped or repeated.
        nextScorableBattle = await tx.battle.findFirst({
          skip: index,
          where: {
            // Get all battles that a user that has been touched has participated in
            participants: {
              some: {
                userId: {
                  in: Array.from(userScoresCache.keys()),
                },
              },
            },
            createdAt: {
              // And don't process battles before the start time
              gte: startingBattle.createdAt,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            participants: {
              select: {
                id: true,
                userId: true,
                userComputedScoreAtBattleCreatedAt: true,
                computedDidWinOrTieBattle: true,
              },
            },
          },
        });
        if (!nextScorableBattle) {
          break;
        }

        const logPrefix = `[${`${index + 1}`.padStart(5, '0')} (${nextScorableBattle.id})]`;

        // Get the participants from the battle
        const participantA = nextScorableBattle.participants[0];
        if (!participantA) {
          continue;
        }
        const participantB = nextScorableBattle.participants[1];
        if (!participantB) {
          continue;
        }
        if (participantA.userComputedScoreAtBattleCreatedAt === null) {
          console.warn(
            logPrefix,
            `WARNING: When computing user ${participantA.userId} score, participant ${participantA.id} had a null userComputedScoreAtBattleCreatedAt value - skipping...`,
          );
          continue;
        }
        if (participantB.userComputedScoreAtBattleCreatedAt === null) {
          console.warn(
            logPrefix,
            `WARNING: When computing user ${participantB.userId} score, participant ${participantB.id} had a null userComputedScoreAtBattleCreatedAt value - skipping...`,
          );
          continue;
        }

        let participantAScore = userScoresCache.get(participantA.userId) ?? USER_INITIAL_SCORE;
        if (participantA.userComputedScoreAtBattleCreatedAt !== participantAScore) {
          console.log(
            logPrefix,
            `Updating pre-battle cached score of ${participantA.id} from ${participantA.userComputedScoreAtBattleCreatedAt} to ${participantAScore}`,
          );
          await BattleParticipant.updateUserComputedScoreAtBattleCreatedAt(
            participantA.id,
            participantAScore,
            tx,
          );
        }

        let participantBScore = userScoresCache.get(participantB.userId) ?? USER_INITIAL_SCORE;
        if (participantB.userComputedScoreAtBattleCreatedAt !== participantBScore) {
          console.log(
            logPrefix,
            `Updating pre-battle cached score of ${participantB.id} from ${participantB.userComputedScoreAtBattleCreatedAt} to ${participantBScore}`,
          );
          await BattleParticipant.updateUserComputedScoreAtBattleCreatedAt(
            participantB.id,
            participantBScore,
            tx,
          );
        }

        // Figure out the result value for the elo calculation
        const result = computeBattleResult(participantA, participantB);

        let newParticipantAScore = participantAScore;
        let newParticipantBScore = participantBScore;
        if (
          nextScorableBattle.computedPrivacyLevel === 'PUBLIC' &&
          (nextScorableBattle.computedHasReceivedVotes ||
            nextScorableBattle.computedHasBeenForfeited)
        ) {
          // Run the elo algorithm to figure out the next score value
          // More info: https://mattmazzola.medium.com/understanding-the-elo-rating-system-264572c7a2b4
          [newParticipantAScore, newParticipantBScore] = Elo.executeMatch(
            participantAScore,
            participantBScore,
            result,
          );
        }
        console.log(
          logPrefix,
          `a(${participantA.userId}):${`${participantAScore}`.padEnd(6, ' ')} b(${
            participantB.userId
          }):${`${participantBScore}`.padEnd(6, ' ')} ${`=(${result})=`.padEnd(
            7,
            '=',
          )}> a:${`${newParticipantAScore}`.padEnd(6, ' ')} b:${`${newParticipantBScore}`.padEnd(
            6,
            ' ',
          )}`,
        );

        userScoresCache.set(participantA.userId, newParticipantAScore);
        userScoresCache.set(participantB.userId, newParticipantBScore);
      }

      // Finally, update the score for all users that were touched
      console.log(`Updating final scores for ${userScoresCache.size} user(s)...`);
      console.log(userScoresCache);
      await Promise.all(
        Array.from(userScoresCache).map(async ([userId, userScore]) => {
          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
              computedScore: userScore,
            },
          });
          pusher.trigger(`private-user-${updatedUser.id}`, 'user.update', updatedUser);
        }),
      );
      console.log(`Updating final scores for ${userScoresCache.size} user(s)... done`);

      return users.map((user) => ({
        ...user,
        computedScore: userScoresCache.get(user.id)!,
      }));
    };

    if (tx) {
      return run(tx);
    } else {
      return prisma.$transaction(run);
    }
  },

  // This function, when called, will recompute the cached clout score value for ALL users in the
  // database. It will paginate through the whole battles table, from start to end, and run the Elo
  // calculation for each battle, storing the results.
  //
  // This needs to exist so that if any of the elo constants are changed, at least in the early
  // days, all scores can be easily recomputed for all users.
  //
  // NOTE: this can't just call `updateComputedCloutScore` for each user, because this function
  // relies on cached intermediate data in each participant (userComputedScoreAtBattleCreatedAt).
  // The calculation this function does needs to instead run through all battles, not filtering by
  // participant, and keep a map in memory of participant scores and effectively rehydrate that
  // cached field at the same time
  async forceRecomputeCloutScores(users: Array<User> | 'all' = 'all', pageSize: number = 25) {
    const userIds = users === 'all' ? 'all' : users.map((user) => user.id);

    const userScoresCache = new Map<User['id'], number>();
    const getUserScore = async (battle: BattleWithParticipants, userId: User['id']) => {
      if (userIds !== 'all' && !userIds.includes(userId)) {
        // The user specified wasn't refreshed, so get the user's pre-cached score from when the
        // battle started.
        for (const participant of battle.participants) {
          if (participant.userId === userId) {
            return participant.userComputedScoreAtBattleCreatedAt || USER_INITIAL_SCORE;
          }
        }
      }

      const score = userScoresCache.get(userId);
      if (typeof score === 'number') {
        return score;
      } else {
        userScoresCache.set(userId, USER_INITIAL_SCORE);
        return USER_INITIAL_SCORE;
      }
    };

    // Aggregate through all battles to re-score them
    let page = 1;
    while (true) {
      const battles = await Battle.all(page, pageSize, ['createdAt', 'asc']);
      if (battles.length === 0) {
        break;
      }

      for (let battleIndex = 0; battleIndex < battles.length; battleIndex += 1) {
        let battle = battles[battleIndex];

        const logPrefix = `[${`${page}`.padStart(3, '0')} => ${`${battleIndex + 1}`.padStart(
          3,
          '0',
        )} of ${`${battles.length}`.padStart(3, '0')} (${battle.id})]`;

        // Update the cached `computedDidWinOrTieBattle` fields on the battleparticipant's
        // associated with the battle.
        //
        // NOTE: this should only do something if the battle has received votes but
        // Battle.updateComputedWinningParticipants wasn't called when they were processed
        const updated = await Battle.updateComputedWinningParticipants(battle, prisma, false);
        if (updated) {
          battle = await Battle.refreshFromDatabase(battle);
        }

        const participantA = battle.participants[0];
        if (!participantA) {
          // console.log(logPrefix, `WARNING: battle ${battle.id} participantA not found, skipping...`);
          continue;
        }
        const participantB = battle.participants[1];
        if (!participantB) {
          // console.log(logPrefix, `WARNING: battle ${battle.id} participantB not found, skipping...`);
          continue;
        }

        const participantAScore = await getUserScore(battle, participantA.userId);
        const participantBScore = await getUserScore(battle, participantB.userId);

        const battleEffectsSpecifiedUsers =
          userScoresCache.has(participantA.userId) || userScoresCache.has(participantB.userId);
        if (userIds !== 'all' && !battleEffectsSpecifiedUsers) {
          // console.log(logPrefix, `WARNING: battle ${battle.id} is not effected by specified users or dependants, skipping...`);
          continue;
        }

        await BattleParticipant.updateUserComputedScoreAtBattleCreatedAt(
          participantA.id,
          participantAScore,
        );
        await BattleParticipant.updateUserComputedScoreAtBattleCreatedAt(
          participantB.id,
          participantBScore,
        );

        // Figure out the result value for the elo calculation
        const result = computeBattleResult(participantA, participantB);
        let newParticipantAScore = participantAScore;
        let newParticipantBScore = participantBScore;
        if (
          battle.computedPrivacyLevel === 'PUBLIC' &&
          (battle.computedHasReceivedVotes || battle.computedHasBeenForfeited)
        ) {
          [newParticipantAScore, newParticipantBScore] = Elo.executeMatch(
            participantAScore,
            participantBScore,
            result,
          );
        }

        // Update both participants in the cache
        userScoresCache.set(participantA.userId, newParticipantAScore);
        userScoresCache.set(participantB.userId, newParticipantBScore);

        console.log(
          logPrefix,
          `a(${participantA.userId}):${`${participantAScore}`.padEnd(6, ' ')} b(${
            participantB.userId
          }):${`${participantBScore}`.padEnd(6, ' ')} ${`=(${result})=`.padEnd(
            7,
            '=',
          )}> a:${`${newParticipantAScore}`.padEnd(6, ' ')} b:${`${newParticipantBScore}`.padEnd(
            6,
            ' ',
          )}`,
        );
      }
      page += 1;
    }

    // Finally, update the score for all users that were touched
    console.log(`Updating final scores for ${userScoresCache.size} user(s)...`);
    await Promise.all(
      Array.from(userScoresCache).map(async ([userId, userScore]) => {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            computedScore: userScore,
          },
        });
        pusher.trigger(`private-user-${updatedUser.id}`, 'user.update', updatedUser);
      }),
    );
    console.log(`Updating final scores for ${userScoresCache.size} user(s)... done`);

    return userScoresCache;
  },

  // When called, generates a history of all a user's battles that can be viewed in the online
  // https://barz-elo-demo.surge.sh tool.
  //
  // Encoded in the query parameters, information about the precached data that was stored on each
  // battle was also included. This allows one to easily verify to make sure that all the
  // calculations line up for a given user's score and to confirm there were not any math or caching
  // related errors in the computation.
  async generateWebViewerLink(
    userIds: Array<User['id']> | 'all',
    prefix: string = 'https://barz-elo-demo.surge.sh',
    take: 'all' | number = 'all',
    idSlice: number = -3,
  ) {
    const battleQueryResult = await prisma.battle.findMany({
      where: {
        participants: {
          every: {
            user: {
              name: {
                not: {
                  equals: null,
                },
              },
            },
          },

          // Filter the list based off the users specified
          some:
            userIds !== 'all'
              ? {
                  userId: {
                    in: userIds,
                  },
                }
              : undefined,
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            userId: true,
            computedDidWinOrTieBattle: true,
            userComputedScoreAtBattleCreatedAt: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: take !== 'all' ? take : undefined,
    });

    const constants = DEFAULT_CONSTANTS;

    let playerId = 0;
    const playersMap = new Map<string, [string, number]>();
    for (const battle of battleQueryResult) {
      for (const participant of battle.participants) {
        const key = `${participant.user.name} (${participant.userId.slice(idSlice)})`;
        if (playersMap.has(key)) {
          continue;
        }
        if (participant.userComputedScoreAtBattleCreatedAt !== USER_INITIAL_SCORE) {
          console.warn(
            `WARNING: '${key}' initial score of ${USER_INITIAL_SCORE} doesn't match the userComputedScoreAtBattleCreatedAt value on the first battle (${USER_INITIAL_SCORE} != ${participant.userComputedScoreAtBattleCreatedAt})`,
          );
          console.warn(
            `This might indicate that there are battles from BEFORE the battles that effected the initial score of this user.`,
          );
          console.warn(
            `A good first debugging step here is to include data for the other user in the initial battle`,
          );
        }
        playersMap.set(key, [`${playerId}`, USER_INITIAL_SCORE]);
        playerId += 1;
      }
    }
    const players = Array.from(playersMap).map(([name, [id, score]]) => ({ id, name, score }));

    const battles = battleQueryResult
      .map((battle) => {
        if (battle.participants.length < 2) {
          return null;
        }
        const playerOne = playersMap.get(
          `${battle.participants[0].user.name} (${battle.participants[0].userId.slice(idSlice)})`,
        );
        const playerTwo = playersMap.get(
          `${battle.participants[1].user.name} (${battle.participants[1].userId.slice(idSlice)})`,
        );
        return {
          id: battle.id,
          // NOTE: Only enable public battles that have received votes, and have not been forfeited
          // This ensures that the logic around battles without votes not effecting the scoring still
          // works in the web tool
          enabled:
            battle.computedPrivacyLevel === 'PUBLIC' &&
            (battle.computedHasReceivedVotes || battle.computedHasBeenForfeited),
          playerOneId: playerOne ? playerOne[0] : null,
          playerTwoId: playerTwo ? playerTwo[0] : null,
          result: computeBattleResult(battle.participants[0], battle.participants[1]),
          playerOneScoreComputed: battle.participants[0].userComputedScoreAtBattleCreatedAt,
          playerTwoScoreComputed: battle.participants[1].userComputedScoreAtBattleCreatedAt,
        };
      })
      .filter((b) => b != null);

    const params = new URLSearchParams();
    params.set('players', JSON.stringify(players));
    params.set('battles', JSON.stringify(battles));
    params.set('constants', JSON.stringify(constants));

    return `${prefix}#${params.toString()}`;
  },
};

export default User;
