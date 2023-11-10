import {
  Prisma,
  BattleComment as PrismaBattleComment,
  BattleCommentVote as PrismaBattleCommentVote,
} from '@prisma/client';
import Battle, { BattleWithParticipants } from './battle.ts';
import User from './user.ts';
import prisma from './prisma.ts';
import pusher from './pusher.ts';
// import { FixMe } from './fixme.ts';

type BattleComment = Pick<PrismaBattleComment, 'id' | 'commentedAt' | 'text' | 'battleId'> & {
  user: User;
  computedVoteTotal: number;
  computedHasBeenVotedOnByUserMe: boolean | null;
};

export type BattleCommentVote = PrismaBattleCommentVote;

const BattleComment = {
  async getById(
    id: BattleComment['id'],
    userMe?: User,
    forBattleId?: Battle['id'],
  ): Promise<BattleComment | null> {
    const results = await BattleComment.getByIds([id], userMe, forBattleId);
    return results[0] || null;
  },

  async getByIds(
    ids: Array<BattleComment['id']>,
    userMe?: User,
    forBattleId?: Battle['id'],
  ): Promise<Array<BattleComment | null>> {
    if (ids.length === 0) {
      return [];
    }

    const rawResults = await prisma.$queryRaw<
      Array<{
        id: BattleComment['id'];
        commented_at: BattleComment['commentedAt'];
        text: BattleComment['text'];
        battle_id: BattleComment['battleId'];
        computed_vote_total: BigInt;
        computed_has_been_voted_on_by_user_me: BattleComment['computedHasBeenVotedOnByUserMe'];
        user_id: User['id'];
        user_profile_image_url: User['profileImageUrl'];
        user_handle: User['handle'];
        user_name: User['name'];
        user_computed_score: User['computedScore'];
        user_computed_followers_count: User['computedFollowersCount'];
        user_computed_following_count: User['computedFollowingCount'];
      }>
    >`
      SELECT
        battle_comment.id,
        battle_comment.commented_at,
        battle_comment.text,
        battle_comment.battle_id,
        battle_comment.battle_id,
        (
          SELECT count(id)
          FROM battle_comment_vote
          WHERE
            battle_comment_vote.comment_id = battle_comment.id AND
            battle_comment_vote.deleted_at IS NULL
        ) AS computed_vote_total,

        -- Compute whether the given user has voted on the comment
        EXISTS (
          SELECT id
          FROM battle_comment_vote
          WHERE
            battle_comment_vote.comment_id = battle_comment.id AND
            battle_comment_vote.deleted_at IS NULL AND
            battle_comment_vote.cast_by_user_id IN (${Prisma.join(
              userMe ? [userMe.id] : ['BOGUS'],
            )})
        ) AS computed_has_been_voted_on_by_user_me,

        clerk_user.id AS user_id,
        clerk_user.profile_image_url AS user_profile_image_url,
        clerk_user.handle AS user_handle,
        clerk_user.name AS user_name,
        clerk_user.computed_score AS user_computed_score,
        clerk_user.computed_followers_count AS user_computed_followers_count,
        clerk_user.computed_following_count AS user_computed_following_count
      FROM battle_comment
      LEFT JOIN clerk_user
        ON clerk_user.id = battle_comment.user_id
      WHERE
        battle_comment.id IN (${Prisma.join(ids)}) AND
        battle_comment.deleted_at IS NULL
    `;

    // FIXME: it should be possible to do this final filter within the above SQL with something
    // like the below in the WHERE:
    // ${forBattleId ? Prisma.sql`battle_comment.battle_id = '${forBattleId}' AND` : Prisma.empty}
    //
    // However, for an as yet unknown reason, this seems to result in the query always returning an
    // empty queryset when `forBattleId` is specified. So, do this last filter in memory since in
    // practice it should be filtering out anything in happy path cases.
    const filteredResults = rawResults.filter((comment) => {
      if (!forBattleId) {
        return true;
      }
      return forBattleId === comment.battle_id;
    });

    const results = filteredResults.map((comment) => ({
      id: comment.id,
      commentedAt: comment.commented_at,
      text: comment.text,
      battleId: comment.battle_id,
      computedHasBeenVotedOnByUserMe: userMe ? comment.computed_has_been_voted_on_by_user_me : null,
      // FIXME: for some reason, prisma returns a BigInt for this computed_vote_total value -
      // convert this into a regular number...
      computedVoteTotal: (new Number(comment.computed_vote_total) as number) + 0,
      user: {
        id: comment.user_id,
        profileImageUrl: comment.user_profile_image_url,
        handle: comment.user_handle,
        name: comment.user_name,
        computedScore: comment.user_computed_score,
        computedFollowersCount: comment.user_computed_followers_count,
        computedFollowingCount: comment.user_computed_following_count,
      },
    }));

    return ids.map((id) => results.find((r) => r.id === id) || null);
  },

  async refreshFromDatabase(
    battleComment: Pick<BattleComment, 'id'>,
    userMe?: User,
  ): Promise<BattleComment> {
    const updatedBattleComment = await BattleComment.getById(battleComment.id, userMe);
    if (!updatedBattleComment) {
      throw new Error(
        `Error refreshing battleComment from database: battleComment ${battleComment.id} not found!`,
      );
    }
    return updatedBattleComment;
  },

  async listForBattle(
    battleId: Battle['id'],
    userMe: User,
    page: number,
    pageSize: number = 25,
  ): Promise<Array<BattleComment>> {
    if (page < 0) {
      page = 1;
    }
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    const rawResults = await prisma.battleComment.findMany({
      orderBy: { createdAt: 'desc' },
      where: {
        battleId,

        // Exclude soft deleted comments
        deletedAt: null,
      },
      select: { id: true },
      skip,
      take,
    });

    const results = await BattleComment.getByIds(
      rawResults.map((r) => r.id),
      userMe,
    );
    return results.filter((comment): comment is BattleComment => comment !== null);
  },

  async countForBattle(battleId: Battle['id']) {
    return prisma.battleComment.count({
      where: {
        battleId,

        // Exclude soft deleted comments
        deletedAt: null,
      },
    });
  },

  // When called, creates a new comment on a battle
  async createForBattle(
    battle: BattleWithParticipants,
    userId: User['id'],
    text: BattleComment['text'],
    offsetMilliseconds: number,
    now = new Date(),
  ) {
    if (
      battle.computedPrivacyLevel !== 'PUBLIC' &&
      !battle.participants.find((p) => p.userId === userId)
    ) {
      throw new Error(
        `Unable to create comment for private battle ${battle.id} for user ${userId} since this user did not participate in the battle!`,
      );
    }

    const result = await prisma.battleComment.create({
      data: {
        commentedAt: now,
        commentedAtOffsetMilliseconds: offsetMilliseconds,
        text,
        battleId: battle.id,
        userId,
      },
    });

    const comment: BattleComment = {
      id: result.id,
      battleId: battle.id,
      commentedAt: result.commentedAt,
      text: result.text,
      computedVoteTotal: 0,
      computedHasBeenVotedOnByUserMe: null,
      user: (await User.getById(userId))!,
    };

    pusher.trigger(`private-battle-${battle.id}-comments`, 'battleComment.create', comment);
    return comment;
  },

  // When called, changes the text of a comment.
  // NOTE: a user can only edit their own comments
  async changeText(
    battleComment: BattleComment,
    asUserId: User['id'],
    newText: BattleComment['text'],
  ) {
    const result = await prisma.battleComment.updateMany({
      where: {
        id: battleComment.id,
        userId: asUserId,
      },
      data: {
        text: newText,
      },
    });

    if (result.count === 0) {
      return null;
    }

    const updatedBattleComment: BattleComment = { ...battleComment, text: newText };

    pusher.trigger(`private-battle-${battleComment.battleId}-comments`, 'battleComment.create', {
      ...updatedBattleComment,
      computedHasBeenVotedOnByUserMe: null,
    });
    return updatedBattleComment;
  },

  // When called, casts a vote on a comment that is on a battle
  // NOTE: this is NOT for a "vote" on a battle, this is for a vote on a comment!!
  async voteForCommentAsUser(
    battleComment: BattleComment,
    userId: User['id'],
    now = new Date(),
  ): Promise<BattleComment | null> {
    const voteAlreadyExists = await prisma.battleCommentVote.findFirst({
      where: {
        commentId: battleComment.id,
        castByUserId: userId,
        deletedAt: null,
      },
    });
    if (voteAlreadyExists) {
      return null;
    }

    const commentVote = await prisma.battleCommentVote.create({
      data: {
        commentId: battleComment.id,
        castAt: now,
        castByUserId: userId,
      },
    });

    // Send an event that the client can use to highlight the vote indicator
    pusher.trigger(
      `private-battle-${battleComment.battleId}-user-${userId}-commentvotes`,
      'battleCommentVote.create',
      commentVote,
    );

    const updatedComment: BattleComment = {
      ...battleComment,
      computedVoteTotal: await prisma.battleCommentVote.count({
        where: {
          commentId: battleComment.id,
          // Exclude soft deleted comments
          deletedAt: null,
        },
      }),
      computedHasBeenVotedOnByUserMe: true,
    };

    pusher.trigger(`private-battle-${battleComment.battleId}-comments`, 'battleComment.update', {
      ...updatedComment,
      computedHasBeenVotedOnByUserMe: null,
    });
    return updatedComment;
  },

  // When called, soft deletes a vote that was cast by a given user on a comment
  // NOTE: this is NOT for a "vote" on a battle, this is for a vote on a comment!!
  async deleteCommentVoteForUser(
    battleComment: BattleComment,
    userId: User['id'],
    now = new Date(),
  ) {
    const result = await prisma.battleCommentVote.updateMany({
      where: {
        commentId: battleComment.id,
        castByUserId: userId,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
      },
    });

    if (result.count === 0) {
      return null;
    }

    // Send an event that the client can use to un-highlight the vote indicator
    pusher.trigger(
      `private-battle-${battleComment.battleId}-user-${userId}-commentvotes`,
      'battleCommentVote.delete',
      { commentId: battleComment.id },
    );

    const updatedComment: BattleComment = {
      ...battleComment,
      computedVoteTotal: await prisma.battleCommentVote.count({
        where: {
          commentId: battleComment.id,
          // Exclude soft deleted comments
          deletedAt: null,
        },
      }),
      computedHasBeenVotedOnByUserMe: false,
    };

    pusher.trigger(`private-battle-${battleComment.battleId}-comments`, 'battleComment.update', {
      ...updatedComment,
      computedHasBeenVotedOnByUserMe: null,
    });
    return updatedComment;
  },

  // When called, soft deletes a comment from the database
  async delete(battleComment: BattleComment, now = new Date()) {
    await prisma.battleComment.update({
      where: {
        id: battleComment.id,
      },
      data: {
        deletedAt: now,
      },
    });

    pusher.trigger(`private-battle-${battleComment.battleId}-comments`, 'battleComment.delete', {
      id: battleComment.id,
    });
  },
};

export default BattleComment;
