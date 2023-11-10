import request from 'supertest';
import assert from 'assert';
import { User as PrismaUser } from '@prisma/client';

import createApp from '../src/index.ts';
import prisma from '../src/lib/prisma.ts';
import User from '../src/lib/user.ts';
import Battle, { BattleWithParticipantsAndCheckinsAndVotesAndEvents } from '../src/lib/battle.ts';
import BattleParticipant from '../src/lib/battle-participant.ts';

describe('Users', () => {
  let user: PrismaUser;
  beforeEach(async () => {
    // Create a fake user account to use in making requests
    user = await prisma.user.create({ data: { clerkId: 'user_123' } });
  });

  it('should be able to get ALL details for the currently active user', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Request details on the current user
    const userResponse = await request(app).get('/v1/users/me').expect(200);

    // And make sure the data comes back for the right user
    assert.strictEqual(userResponse.body.id, user.id);

    // Make sure that certain sensitive details like the phone number are returned
    assert.strictEqual(userResponse.body.phoneNumber, user.phoneNumber);
  });
  it('should be able to get a limited set of details for arbitrary users', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Create a secondary fake user account
    const secondFakeUser = await prisma.user.create({
      data: {
        clerkId: 'BOGUS',
        handle: 'BOGUS',
        phoneNumber: '555-555-5555',
      },
    });

    // Request details on an arbitrary user
    const userResponse = await request(app).get(`/v1/users/${secondFakeUser.id}`).expect(200);

    // And make sure the data comes back for the right user
    assert.strictEqual(userResponse.body.id, secondFakeUser.id);

    // Make sure that certain sensitive details like the phone number are NOT returned for
    // arbitrary users
    assert.notStrictEqual(userResponse.body.phoneNumber, secondFakeUser.phoneNumber);
  });
  it('should be able to follow another user', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Create a secondary user account
    const secondUser = await prisma.user.create({
      data: {
        clerkId: 'BOGUS',
        handle: 'BOGUS',
        phoneNumber: '555-555-5555',
      },
    });

    // Attempt to follow that second user
    await request(app).post(`/v1/users/${secondUser.id}/follow`).expect(204);

    // Make sure that the user "following" database model now exists
    const followRow = await prisma.userFollows.findFirst({
      where: { userId: user.id, followsUserId: secondUser.id },
    });
    assert.notStrictEqual(followRow, null);
  });
  it('should not be able to follow themselves', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    await request(app).post(`/v1/users/${user.id}/follow`).expect(400);
  });
  it('should be able to unfollow another user', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Create a secondary user account
    const secondUser = await prisma.user.create({
      data: {
        clerkId: 'BOGUS',
        handle: 'BOGUS',
        phoneNumber: '555-555-5555',
      },
    });

    // Make the authed user follow the second user
    await User.followUser(user, secondUser.id);

    // Attempt to unfollow that second user
    await request(app).post(`/v1/users/${secondUser.id}/unfollow`).expect(204);

    // Make sure that the user "following" database model now no longer exists
    const followRow = await prisma.userFollows.findFirst({
      where: { userId: user.id, followsUserId: secondUser.id },
    });
    assert.strictEqual(followRow, null);
  });
  it('should not be able to unfollow themselves', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    await request(app).post(`/v1/users/${user.id}/unfollow`).expect(400);
  });
  it('should change the following / follower computed totals when users follow and unfollow each other', async () => {
    let firstUser = user;
    // Create a secondary user account
    let secondUser = await prisma.user.create({
      data: {
        clerkId: 'user_456',
        handle: 'BOGUS',
        phoneNumber: '555-555-5555',
      },
    });
    let thirdUser = await prisma.user.create({
      data: {
        clerkId: 'user_789',
        handle: 'BOGUS',
        phoneNumber: '555-555-5555',
      },
    });

    const firstUserApp = createApp({ requireAuth: false, authedUserId: firstUser.clerkId! });
    const secondUserApp = createApp({ requireAuth: false, authedUserId: secondUser.clerkId! });
    const thirdUserApp = createApp({ requireAuth: false, authedUserId: thirdUser.clerkId! });

    // FIRST: Make `firstUser` follow `secondUser`
    await request(firstUserApp).post(`/v1/users/${secondUser.id}/follow`).expect(204);

    // Refetch users from the database
    firstUser = await prisma.user.findFirstOrThrow({ where: { id: firstUser.id } });
    secondUser = await prisma.user.findFirstOrThrow({ where: { id: secondUser.id } });
    thirdUser = await prisma.user.findFirstOrThrow({ where: { id: thirdUser.id } });

    // Make sure that `firstUser` is following 1 user
    assert.strictEqual(firstUser.computedFollowersCount, 0);
    assert.strictEqual(firstUser.computedFollowingCount, 1);

    // Make sure that `secondUser` is being followed by 1 user
    assert.strictEqual(secondUser.computedFollowersCount, 1);
    assert.strictEqual(secondUser.computedFollowingCount, 0);

    // Make sure that `thirdUser` is being followed by 0 users
    assert.strictEqual(thirdUser.computedFollowersCount, 0);
    assert.strictEqual(thirdUser.computedFollowingCount, 0);

    // SECOND: Make `firstUser` follow `thirdUser`
    await request(firstUserApp).post(`/v1/users/${thirdUser.id}/follow`).expect(204);

    // Refetch users from the database
    firstUser = await prisma.user.findFirstOrThrow({ where: { id: firstUser.id } });
    secondUser = await prisma.user.findFirstOrThrow({ where: { id: secondUser.id } });
    thirdUser = await prisma.user.findFirstOrThrow({ where: { id: thirdUser.id } });

    // Make sure that `firstUser` is following 2 users
    assert.strictEqual(firstUser.computedFollowersCount, 0);
    assert.strictEqual(firstUser.computedFollowingCount, 2);

    // Make sure that `secondUser` is being followed by 1 user
    assert.strictEqual(secondUser.computedFollowersCount, 1);
    assert.strictEqual(secondUser.computedFollowingCount, 0);

    // Make sure that `thirdUser` is being followed by 1 user
    assert.strictEqual(thirdUser.computedFollowersCount, 1);
    assert.strictEqual(thirdUser.computedFollowingCount, 0);

    // THIRD: Make `secondUser` follow `thirdUser`
    await request(secondUserApp).post(`/v1/users/${thirdUser.id}/follow`).expect(204);

    // Refetch users from the database
    firstUser = await prisma.user.findFirstOrThrow({ where: { id: firstUser.id } });
    secondUser = await prisma.user.findFirstOrThrow({ where: { id: secondUser.id } });
    thirdUser = await prisma.user.findFirstOrThrow({ where: { id: thirdUser.id } });

    // Make sure that `firstUser` is STILL just following 2 users
    assert.strictEqual(firstUser.computedFollowersCount, 0);
    assert.strictEqual(firstUser.computedFollowingCount, 2);

    // Make sure that `secondUser` is being followed by 1 user, and now following 1 user
    assert.strictEqual(secondUser.computedFollowersCount, 1);
    assert.strictEqual(secondUser.computedFollowingCount, 1);

    // Make sure that `thirdUser` is being followed by 2 users
    assert.strictEqual(thirdUser.computedFollowersCount, 2);
    assert.strictEqual(thirdUser.computedFollowingCount, 0);

    // FOURTH: Make `firstUser` unfollow `thirdUser`
    await request(firstUserApp).post(`/v1/users/${thirdUser.id}/unfollow`).expect(204);

    // Refetch users from the database
    firstUser = await prisma.user.findFirstOrThrow({ where: { id: firstUser.id } });
    secondUser = await prisma.user.findFirstOrThrow({ where: { id: secondUser.id } });
    thirdUser = await prisma.user.findFirstOrThrow({ where: { id: thirdUser.id } });

    // Make sure that `firstUser` is now just following 1 user
    assert.strictEqual(firstUser.computedFollowersCount, 0);
    assert.strictEqual(firstUser.computedFollowingCount, 1);

    // Make sure that `secondUser` is STILL being followed by 1 user and following 1 user
    assert.strictEqual(secondUser.computedFollowersCount, 1);
    assert.strictEqual(secondUser.computedFollowingCount, 1);

    // Make sure that `thirdUser` is now being followed by just 1 user
    assert.strictEqual(thirdUser.computedFollowersCount, 1);
    assert.strictEqual(thirdUser.computedFollowingCount, 0);

    // FIFTH: Attempt to have `thirdUser` unfollow `firstUser`
    // Note that `thirdUser` isn't following anyone, so this should fail
    await request(thirdUserApp).post(`/v1/users/${firstUser.id}/unfollow`).expect(400);
  });
  it('should be able to update their own bio details', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Update bio details of the user, and make sure that the request is successful
    const response = await request(app)
      .put(`/v1/users/${user.id}`)
      .send({ intro: 'TEST INTRO' })
      .expect(200);

    // Make sure the user sent back in the response has the updated data
    assert.strictEqual(response.body.intro, 'TEST INTRO');

    // Make sure that the user was updated in the database
    const updatedUser = await User.refreshFromDatabase(user);
    assert.strictEqual(updatedUser.intro, 'TEST INTRO');
  });
  it(`should NOT be able to update their own bio details if data is malformed in the body`, async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Make sure that field types are validated to be correct
    await request(app).put(`/v1/users/${user.id}`).send({ intro: 12345 }).expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ locationName: 12345 }).expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ locationLatitude: 'bogus' }).expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ locationLongitude: 'bogus' }).expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ favoriteRapperName: 12345 }).expect(400);
    await request(app)
      .put(`/v1/users/${user.id}`)
      .send({ favoriteRapperSpotifyId: 12345 })
      .expect(400);
    await request(app)
      .put(`/v1/users/${user.id}`)
      .send({ favoriteSongSpotifyId: 12345 })
      .expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ favoriteSongName: 12345 }).expect(400);
    await request(app)
      .put(`/v1/users/${user.id}`)
      .send({ favoriteSongArtistName: 12345 })
      .expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ instagramHandle: 12345 }).expect(400);
    await request(app).put(`/v1/users/${user.id}`).send({ soundcloudHandle: 12345 }).expect(400);

    // Make sure that fields that are non-nullable fail if null is passed
    await request(app).put(`/v1/users/${user.id}`).send({ intro: null }).expect(400);
  });
  it(`should NOT be able to update a DIFFERENT USER's bio details`, async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    const differentUser = await prisma.user.create({
      data: {
        clerkId: 'BOGUS',
        handle: 'BOGUS',
        phoneNumber: '555-555-5555',
      },
    });

    // Update bio details of the user, and make sure that the request failed
    await request(app)
      .put(`/v1/users/${differentUser.id}`)
      .send({ intro: 'TEST INTRO' })
      .expect(404);

    // Make sure that the different user was NOT updated in the database
    const updatedDifferentUser = await User.refreshFromDatabase(differentUser);
    assert.notStrictEqual(updatedDifferentUser.intro, 'TEST INTRO');
  });

  describe('List battle recordings associated with user', () => {
    it('should return a paginated list of battles a user is associated with, with RECENT sort order', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });
      const secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSSECONDUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5552',
        },
      });

      // Create a few fake battles
      let battles: Array<BattleWithParticipantsAndCheckinsAndVotesAndEvents> = [];
      for (let i = 0; i < 4; i += 1) {
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        const battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Simulate the steps that would (roughly) happen in a real battle
        await Battle.startBattle(battle.id);
        await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
        await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
        await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
        await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
        await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');
        await Battle.completeBattle(battle.id);
        await BattleParticipant.updateProcessedVideoStatus(
          participantA,
          'COMPLETED',
          'path/to/fake.mp4',
        );
        await BattleParticipant.updateProcessedVideoStatus(
          participantB,
          'COMPLETED',
          'path/to/fake.mp4',
        );
        battles.push(await Battle.refreshFromDatabase(battle));
      }

      // Make sure that the first page has two battles, battle[3] and battle[2]
      let response = await request(app)
        .get(`/v1/users/${firstUser.id}/battles/recordings?sort=RECENT&page=1&pageSize=2`)
        .expect(200);
      assert.strictEqual(response.body.total, 4);
      assert.strictEqual(response.body.next, true);
      assert.strictEqual(response.body.results.length, 2);
      assert.strictEqual(response.body.results[0].battleId, battles[3].id);
      assert.strictEqual(response.body.results[1].battleId, battles[2].id);

      // Make sure that the second page is the final page and has two battles, battle[1] and battle[0]
      response = await request(app)
        .get(`/v1/users/${firstUser.id}/battles/recordings?sort=RECENT&page=2&pageSize=2`)
        .expect(200);
      assert.strictEqual(response.body.total, 4);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 2);
      assert.strictEqual(response.body.results[0].battleId, battles[1].id);
      assert.strictEqual(response.body.results[1].battleId, battles[0].id);
    });
    it('should return a paginated list of battles a user is associated with, with RECENT sort order, including forfeits', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });
      const secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSSECONDUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5552',
        },
      });

      // Create a fake battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      const battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battle.id);
      await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');
      await Battle.completeBattle(battle.id);
      await BattleParticipant.updateProcessedVideoStatus(
        participantA,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      await BattleParticipant.updateProcessedVideoStatus(
        participantB,
        'COMPLETED',
        'path/to/fake.mp4',
      );

      // Create a battle that was forfeited
      const forfeitedParticipantA = await BattleParticipant.create(firstUser.id);
      const forfeitedParticipantB = await BattleParticipant.create(secondUser.id);
      let forfeitedBattle = await Battle.create(
        [forfeitedParticipantA, forfeitedParticipantB],
        'PUBLIC',
      );
      await Battle.startBattle(forfeitedBattle.id);
      await Battle.makeBattlesInactive([[forfeitedBattle.id, forfeitedParticipantA.id]]);
      forfeitedBattle = await Battle.refreshFromDatabase(forfeitedBattle);

      // Make sure that the forfeited battle was included
      let response = await request(app)
        .get(
          `/v1/users/${firstUser.id}/battles/recordings?sort=RECENT&page=1&includeEmptyForfeitedBattles=true`,
        )
        .expect(200);
      assert.strictEqual(response.body.total, 2);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 2);
      assert(response.body.results.map((b: any) => b.battleId).includes(forfeitedBattle.id));
    });
    it('should return a paginated list of battles a user is associated with, with RECENT sort order, including private battles the user has participated in', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });
      const secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSSECONDUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5552',
        },
      });

      // Create a private battle that does NOT involve `user`
      const battleWithoutUserParticipantA = await BattleParticipant.create(firstUser.id);
      const battleWithoutUserParticipantB = await BattleParticipant.create(secondUser.id);
      const battleWithoutUser = await Battle.create(
        [battleWithoutUserParticipantA, battleWithoutUserParticipantB],
        'PRIVATE',
      );

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battleWithoutUser.id);
      await BattleParticipant.performCheckin(battleWithoutUserParticipantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(battleWithoutUserParticipantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(battleWithoutUserParticipantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(battleWithoutUserParticipantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(battleWithoutUserParticipantA, 20_000, 'BATTLE');
      await Battle.completeBattle(battleWithoutUser.id);
      await BattleParticipant.updateProcessedVideoStatus(
        battleWithoutUserParticipantA,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      await BattleParticipant.updateProcessedVideoStatus(
        battleWithoutUserParticipantB,
        'COMPLETED',
        'path/to/fake.mp4',
      );

      // Create a private battle that DOES involve `user`
      const battleWithUserParticipantA = await BattleParticipant.create(user.id);
      const battleWithUserParticipantB = await BattleParticipant.create(secondUser.id);
      const battleWithUser = await Battle.create(
        [battleWithUserParticipantA, battleWithUserParticipantB],
        'PRIVATE',
      );

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battleWithUser.id);
      await BattleParticipant.performCheckin(battleWithUserParticipantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(battleWithUserParticipantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(battleWithUserParticipantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(battleWithUserParticipantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(battleWithUserParticipantA, 20_000, 'BATTLE');
      await Battle.completeBattle(battleWithUser.id);
      await BattleParticipant.updateProcessedVideoStatus(
        battleWithUserParticipantA,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      await BattleParticipant.updateProcessedVideoStatus(
        battleWithUserParticipantB,
        'COMPLETED',
        'path/to/fake.mp4',
      );

      // Make sure that ONLY the battle involving `user` was returned:
      let response = await request(app)
        .get(`/v1/users/${user.id}/battles/recordings?sort=RECENT&page=1`)
        .expect(200);
      assert.strictEqual(response.body.total, 1);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 1);
      assert.strictEqual(response.body.results[0].battleId, battleWithUser.id);
    });
    it('should return a paginated list of battles a user is associated with, with TRENDING sort order', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });
      const secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSSECONDUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5552',
        },
      });

      // Create a few fake battles
      let battles: Array<BattleWithParticipantsAndCheckinsAndVotesAndEvents> = [];
      for (let i = 0; i < 4; i += 1) {
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        const battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Simulate the steps that would (roughly) happen in a real battle
        await Battle.startBattle(battle.id);
        await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
        await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
        await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
        await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
        await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');
        await Battle.completeBattle(battle.id);
        await BattleParticipant.updateProcessedVideoStatus(
          participantA,
          'COMPLETED',
          'path/to/fake.mp4',
        );
        await BattleParticipant.updateProcessedVideoStatus(
          participantB,
          'COMPLETED',
          'path/to/fake.mp4',
        );
        battles.push(await Battle.refreshFromDatabase(battle));
      }

      // Cast five votes on battle of index 1
      await BattleParticipant.castVoteFor(battles[1], battles[1].participants[0].id, user, 0, 0, 5);

      // Cast one vote on battle of index 2
      await BattleParticipant.castVoteFor(battles[2], battles[2].participants[0].id, user, 0, 0, 1);

      // Make sure that the first page has two battles, battle[1] (the one with more votes) and battle[2]
      let response = await request(app)
        .get(`/v1/users/${firstUser.id}/battles/recordings?sort=TRENDING&page=1&pageSize=2`)
        .expect(200);
      assert.strictEqual(response.body.total, 4);
      assert.strictEqual(response.body.next, true);
      assert.strictEqual(response.body.results.length, 2);
      assert.strictEqual(response.body.results[0].battleId, battles[1].id);
      assert.strictEqual(response.body.results[1].battleId, battles[2].id);

      // Make sure that the second page is the final page and has two battles, battle[4] and battle[0]
      // Since neither of these battles received votes, put them at the end
      response = await request(app)
        .get(`/v1/users/${firstUser.id}/battles/recordings?sort=TRENDING&page=2&pageSize=2`)
        .expect(200);
      assert.strictEqual(response.body.total, 4);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 2);
      assert.strictEqual(response.body.results[0].battleId, battles[3].id);
      assert.strictEqual(response.body.results[1].battleId, battles[0].id);
    });
    it('should include private battles that a user has participated in', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });

      // Create a single battle, but make it PRIVATE
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(
        // NOTE: participantB is associated with `user`, there is no `secondUser`!
        user.id,
      );
      let battle = await Battle.create(
        [participantA, participantB],
        'PRIVATE', // <== THIS IS THE IMPORTANT BIT
      );

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battle.id);
      await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');
      await Battle.completeBattle(battle.id);
      await BattleParticipant.updateProcessedVideoStatus(
        participantA,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      await BattleParticipant.updateProcessedVideoStatus(
        participantB,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that the returned battle list contains the battle, since `user` was associated
      // with the battle (as a participant)
      let response = await request(app)
        .get(`/v1/users/${firstUser.id}/battles/recordings?sort=RECENT`)
        .expect(200);
      assert.strictEqual(response.body.total, 1);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 1);
      assert.strictEqual(response.body.results[0].battleId, battle.id);
    });
    it('should NOT include private battles that a user has NOT participated in', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });
      const secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSSECONDUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5552',
        },
      });

      // Create a single battle, but make it PRIVATE
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create(
        [participantA, participantB],
        'PRIVATE', // <== THIS IS THE IMPORTANT BIT
      );

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battle.id);
      await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');
      await Battle.completeBattle(battle.id);
      await BattleParticipant.updateProcessedVideoStatus(
        participantA,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      await BattleParticipant.updateProcessedVideoStatus(
        participantB,
        'COMPLETED',
        'path/to/fake.mp4',
      );
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that the returned battle list is empty - the private battle did NOT include
      // `user` in the battle.
      let response = await request(app)
        .get(`/v1/users/${firstUser.id}/battles/recordings?sort=RECENT`)
        .expect(200);
      assert.strictEqual(response.body.total, 0);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 0);
    });
    it(`should include FORFEITED battles that HAVEN'T STARTED that a user has participated in`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSFIRSTUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5551',
        },
      });
      const secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSSECONDUSER',
          handle: 'BOGUSSECOND',
          phoneNumber: '555-555-5552',
        },
      });

      // Create a single public battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Immediately forfeit it
      await Battle.makeBattlesInactive([[battle.id, participantA.id]]);
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that the returned battle list contains our battle
      let response = await request(app)
        .get(
          `/v1/users/${firstUser.id}/battles/recordings?sort=RECENT&includeEmptyForfeitedBattles=true`,
        )
        .expect(200);
      assert.strictEqual(response.body.total, 1);
      assert.strictEqual(response.body.next, false);
      assert.strictEqual(response.body.results.length, 1);
    });
  });
});
