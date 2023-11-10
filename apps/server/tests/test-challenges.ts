import request from 'supertest';
import assert from 'assert';
import { User as PrismaUser } from '@prisma/client';
import MockDate from 'mockdate';

import createApp from '../src/index.ts';
import prisma from '../src/lib/prisma.ts';
import User from '../src/lib/user.ts';
import Battle from '../src/lib/battle.ts';
import Challenge from '../src/lib/challenge.ts';

describe('Challenges', () => {
  let user: PrismaUser;

  let userOne: User;
  let userTwo: User;
  let userThree: User;
  let challengeOne: Challenge;
  let challengeTwo: Challenge;
  let challengeThree: Challenge;
  beforeEach(async () => {
    // Create a fake user account to use in making requests
    user = await prisma.user.create({ data: { clerkId: 'user_123' } });

    // Make some users for the main user account to challenge
    userOne = await User.refreshFromDatabase(
      await prisma.user.create({ data: { name: 'User One' } }),
    );
    userTwo = await User.refreshFromDatabase(
      await prisma.user.create({ data: { name: 'User One' } }),
    );
    userThree = await User.refreshFromDatabase(
      await prisma.user.create({ data: { name: 'User Three' } }),
    );

    // Make a few pre-existing challenges
    challengeOne = await Challenge.createInContextOfUserMe(user, userOne);
    challengeTwo = await Challenge.createInContextOfUserMe(user, userTwo);
    challengeThree = await Challenge.createInContextOfUserMe(userOne, userThree);
  });

  afterEach(() => MockDate.reset());

  it('should be able to get all pending challenges that a given user is involved with', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    const response = await request(app).get('/v1/challenges/pending').expect(200);

    // Make sure that there are only two challenges that the given user is associated with
    assert.strictEqual(response.body.total, 2);
    assert.strictEqual(response.body.next, false);
    assert.strictEqual(response.body.results.length, 2);

    // They should be sorted from most recently created to least recently created
    assert.strictEqual(response.body.results[0].id, challengeTwo.id);
    assert.strictEqual(response.body.results[1].id, challengeOne.id);
  });
  it('should be able to get many pages of pending challenges', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    // Remove all the pre-existing challenges
    await prisma.challenge.deleteMany({
      where: {
        id: { in: [challengeOne.id, challengeTwo.id, challengeThree.id] },
      },
    });

    // Create a bunch of new challenges
    for (let i = 0; i < 12; i += 1) {
      const newUser = await User.refreshFromDatabase(
        await prisma.user.create({ data: { name: `User ${i}` } }),
      );
      await Challenge.createInContextOfUserMe(user, newUser);
    }

    // Request the first page
    let response = await request(app).get('/v1/challenges/pending?page=1&pageSize=5').expect(200);

    // Make sure that the first page has 5 items
    assert.strictEqual(response.body.total, 12);
    assert.strictEqual(response.body.next, true);
    assert.strictEqual(response.body.results.length, 5);

    // Request the second page
    response = await request(app).get('/v1/challenges/pending?page=2&pageSize=5').expect(200);

    // Make sure that the second page also has 5 items
    assert.strictEqual(response.body.total, 12);
    assert.strictEqual(response.body.next, true);
    assert.strictEqual(response.body.results.length, 5);

    // Request the third page
    response = await request(app).get('/v1/challenges/pending?page=3&pageSize=5').expect(200);

    // Make sure that the third page only has 2 items, and that there is no next page
    assert.strictEqual(response.body.total, 12);
    assert.strictEqual(response.body.next, false);
    assert.strictEqual(response.body.results.length, 2);
  });

  it('should be able to create a new challenge', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    const userToChallenge = await User.refreshFromDatabase(
      await prisma.user.create({ data: { name: `User To Challenge` } }),
    );

    const response = await request(app)
      .post('/v1/challenges')
      .send({ userToChallengeId: userToChallenge.id })
      .expect(201);

    // Make sure the request contains a challenge which has the user ids in it
    assert.strictEqual(response.body.challengedUserId, userToChallenge.id);
    assert.strictEqual(response.body.createdByUserId, user.id);

    // Make sure that the challenge also exists in the database
    const challenge = await Challenge.getById(response.body.id);
    assert.notStrictEqual(challenge, null);
    assert.strictEqual(challenge!.challengedUserId, userToChallenge.id);
    assert.strictEqual(challenge!.createdByUserId, user.id);
  });
  it('should remove pre-existing challenges when creating a new challenge', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    const userToChallengeA = await User.refreshFromDatabase(
      await prisma.user.create({ data: { name: `User To Challenge A` } }),
    );
    const userToChallengeB = await User.refreshFromDatabase(
      await prisma.user.create({ data: { name: `User To Challenge B` } }),
    );

    // Creaet a challenge for a user
    const responseOne = await request(app)
      .post('/v1/challenges')
      .send({ userToChallengeId: userToChallengeA.id })
      .expect(201);

    // Make sure that the challenge exists, and it is PENDING
    let one = await Challenge.getById(responseOne.body.id);
    assert.notStrictEqual(one, null);
    assert.strictEqual(one!.status, 'PENDING');

    // Then, challenge another user
    const responseTwo = await request(app)
      .post('/v1/challenges')
      .send({ userToChallengeId: userToChallengeB.id })
      .expect(201);

    // Make sure that the newly created challenge exists, and is PENDING
    const two = await Challenge.getById(responseTwo.body.id);
    assert.notStrictEqual(two, null);
    assert.strictEqual(two!.status, 'PENDING');

    // However, now the original challenge should be in CANCELLED status
    // Only one PENDING challenge can be issued by a user at a time
    one = await Challenge.refreshFromDatabase(one!);
    assert.notStrictEqual(one, null);
    assert.strictEqual(one!.status, 'CANCELLED');
  });

  it('should be able to get a challenge that the user is associated with', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    const response = await request(app).get(`/v1/challenges/${challengeOne.id}`).expect(200);

    assert.strictEqual(response.body.id, challengeOne.id);
  });
  it('should NOT be able to get a challenge that the user is NOT associated with', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    await request(app).get(`/v1/challenges/${challengeThree.id}`).expect(404);
  });

  it('should be able to cancel a challenge that is in PENDING status', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    const response = await request(app).put(`/v1/challenges/${challengeOne.id}/cancel`).expect(200);

    assert.strictEqual(response.body.id, challengeOne.id);
    assert.strictEqual(response.body.status, 'CANCELLED');
    assert.notStrictEqual(response.body.cancelledAt, null);
  });
  it('should NOT be able to cancel a CANCELLED challenge', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    await Challenge.cancelChallenge(challengeOne, user);
    await request(app).put(`/v1/challenges/${challengeOne.id}/cancel`).expect(400);
  });
  it('should NOT be able to cancel a STARTED challenge', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

    await Challenge.startChallenge(challengeOne, user);
    await request(app).put(`/v1/challenges/${challengeOne.id}/cancel`).expect(400);
  });

  describe('Waiting Room Workflow', () => {
    it('should be able to create a challenge, start it, and have a battle be created', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const otherUser = await prisma.user.create({
        data: { name: 'Other User App', clerkId: 'user_456' },
      });
      const otherUserApp = createApp({ requireAuth: false, authedUserId: otherUser.clerkId! });

      // Step 1: Create the challenge
      const response = await request(app)
        .post('/v1/challenges')
        .send({ userToChallengeId: otherUser.id })
        .expect(201);
      const challengeId = response.body.id;

      // Step 2: After otherUser hears about the challenge, simulate them joining the waiting room.
      //
      // When joining a waiting room of an already completed challenge, the mobile app checks the
      // user in:
      await request(otherUserApp).put(`/v1/challenges/${challengeId}/checkin`).expect(204);

      // Because both users last reached out to the server within a short time interval, the
      // challenge should now be in STARTED status
      let challenge = await Challenge.getById(challengeId);
      assert.notStrictEqual(challenge, null);
      assert.strictEqual(challenge!.status, 'STARTED');
      assert.notStrictEqual(challenge!.battleId, null);

      // And make sure that the battle exists in the database
      assert.notStrictEqual(await Battle.getById(challenge!.battleId!), null);
    });

    it('should be able to create a challenge, leave the waiting room, and then have both users rejoin before creating a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const otherUser = await prisma.user.create({
        data: { name: 'Other User App', clerkId: 'user_456' },
      });
      const otherUserApp = createApp({ requireAuth: false, authedUserId: otherUser.clerkId! });

      // This test requires tight control over the current time.
      MockDate.set(new Date('2020-01-01T00:00:00Z'));

      // Step 1: Create the challenge
      const response = await request(app)
        .post('/v1/challenges')
        .send({ userToChallengeId: otherUser.id })
        .expect(201);
      const challengeId = response.body.id;

      // Step 2: Simulate leaving the waiting room
      await request(app).put(`/v1/challenges/${challengeId}/leave`).expect(204);

      // Now, advance time forward 2 minutes
      MockDate.set(new Date('2020-01-01T00:02:00Z'));

      // Step 3: Now that some time has past, simulate `otherUser` joining the waiting room
      await request(otherUserApp).put(`/v1/challenges/${challengeId}/checkin`).expect(204);

      // This checkin request should send a `challenge.requestCheckIn` pusher message
      // FIXME: add mocking / assertion to verify this

      // Advance time forward 1 second
      MockDate.set(new Date('2020-01-01T00:02:01Z'));

      // Step 4: After receiving the pusher message, the original user also checks in
      await request(app).put(`/v1/challenges/${challengeId}/checkin`).expect(204);

      // Now that both users have checked in, the challenge should now be in STARTED status
      let challenge = await Challenge.getById(challengeId);
      assert.notStrictEqual(challenge, null);
      assert.strictEqual(challenge!.status, 'STARTED');
      assert.notStrictEqual(challenge!.battleId, null);

      // And make sure that the battle exists in the database
      assert.notStrictEqual(await Battle.getById(challenge!.battleId!), null);
    });

    describe('Explicitly Leaving Waiting Room', () => {
      it('should be able to leave the waiting room of a challenge that is in PENDING status', async () => {
        const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

        await request(app).put(`/v1/challenges/${challengeOne.id}/leave`).expect(204);

        // Make sure that the challenge was updated
        challengeOne = await Challenge.refreshFromDatabase(challengeOne);
        assert.strictEqual(challengeOne.challengedUserInWaitingRoom, false);
      });
      it('should NOT be able to leave the waiting room of a CANCELLED challenge', async () => {
        const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

        await Challenge.cancelChallenge(challengeOne, user);
        await request(app).put(`/v1/challenges/${challengeOne.id}/leave`).expect(400);
      });
      it('should NOT be able to leave the waiting room of a STARTED challenge', async () => {
        const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

        await Challenge.startChallenge(challengeOne, user);
        await request(app).put(`/v1/challenges/${challengeOne.id}/leave`).expect(400);
      });
    });
  });
});
