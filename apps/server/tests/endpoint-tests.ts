import request from 'supertest';
import assert from 'assert';
import MockDate from 'mockdate';
import { v4 as uuidv4 } from 'uuid';
import { User as PrismaUser, BattleBeat as PrismaBattleBeat } from '@prisma/client';
import { addSeconds, addMinutes } from 'date-fns';

import createApp from '../src/index.ts';
import prisma from '../src/lib/prisma.ts';
import BattleParticipant from '../src/lib/battle-participant.ts';
import Battle, {
  BattleWithParticipants,
  BattleWithParticipantsAndCheckinsAndVotesAndEvents,
} from '../src/lib/battle.ts';
import BattleComment from '../src/lib/battle-comment.ts';
import User from '../src/lib/user.ts';
import delay from '../src/lib/delay.ts';
import { RecordingsObjectStorage } from '../src/lib/object-storage.ts';
import { run as runConnectionStatusChangeWorker } from '../src/worker/connection-status-change-worker.ts';
import { run as runBattleParticipantMatchingWorker } from '../src/worker/battle-participant-matching-worker.ts';
import { run as runBattleParticipantVideoGenerationWorker } from '../src/worker/battle-participant-video-generation-worker.ts';
import { run as runBattleVideoExportGenerationWorker } from '../src/worker/battle-video-export-generation-worker.ts';
import { run as runBattleAutoForfeitWorker } from '../src/worker/battle-auto-forfeit-worker.ts';
import { FixMe } from '../src/lib/fixme.ts';
import { MOCK_MKV_VIDEO_PATH, MOCK_MKA_AUDIO_PATH, MOCK_MP4_PATH, MOCK_512_THUMBNAIL_PATH } from './setup.ts';

describe('Tests', () => {
  let user: PrismaUser;
  let beatId: PrismaBattleBeat['id'];
  beforeEach(async () => {
    // Create a fake user account
    user = await prisma.user.create({ data: { clerkId: 'user_123' } });

    // Create a fake beat
    const beat = await prisma.battleBeat.create({ data: { beatKey: 'sample_quiet.mp3' } });
    beatId = beat.id;
  });

  it('should make a request to GET /', async () => {
    const app = createApp({ requireAuth: false, authedUserId: 'user_123' });
    await request(app).get('/').expect(200);
  });

  describe('Participants', () => {
    afterEach(() => {
      MockDate.reset();
    });

    it('should be able to create a participant', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create a participant via the api
      const response = await request(app).post('/v1/participants').expect(201);

      // Make sure that the participant id that was returned back exists in the database
      const matchingParticipantCount = await prisma.battleParticipant.count({
        where: {
          id: response.body.id,
        },
      });
      assert.strictEqual(matchingParticipantCount, 1);
    });
    it('should be able to create a participant with a RANDOM matching algorithm', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create a participant via the api
      const response = await request(app)
        .post('/v1/participants')
        .send({ matchingAlgorithm: 'RANDOM' })
        .expect(201);

      // Make sure that the participant id that was returned back exists in the database
      const matchingParticipantCount = await prisma.battleParticipant.count({
        where: {
          id: response.body.id,
          matchingAlgorithm: 'RANDOM',
        },
      });
      assert.strictEqual(matchingParticipantCount, 1);
    });
    it('should be able to get a participant by id', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create a participant associated with that user account
      const participant = await BattleParticipant.create(user.id);

      // Get the participant
      const response = await request(app).get(`/v1/participants/${participant.id}`).expect(200);

      // And make sure that a body was returned with the correct participant id
      assert.strictEqual(response.body.id, participant.id);
    });
    it('should fail to get a participant when the specified id is invalid', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app).get('/v1/participants/FAKEID').expect(404);
    });

    describe(`Battle Matching`, async () => {
      let userA: PrismaUser,
        userB: PrismaUser,
        participantA: BattleParticipant,
        participantB: BattleParticipant;
      beforeEach(async () => {
        // Construct an example battle
        userA = await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        });
        userB = await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        });
        participantA = await BattleParticipant.create(userA.id);
        participantB = await BattleParticipant.create(userB.id);
      });

      it('should match two users with EXACTLY the same score (5,000 vs 5,000)', async () => {
        // Make sure that the two users have the same score
        assert.strictEqual(userA.computedScore, userB.computedScore);

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Finally, make sure that the participants were assigned to the same battle
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        participantB = await BattleParticipant.refreshFromDatabase(participantB);
        assert.notStrictEqual(participantA.battleId, null);
        assert.notStrictEqual(participantB.battleId, null);
        assert.strictEqual(participantA.battleId, participantB.battleId);
      });
      it('should match two users with SIMILAR scores immediately (5,000 vs 5,500)', async () => {
        // User A's score is 5000
        // Update User B's score to be 5500:
        userB = await prisma.user.update({
          where: { id: userB.id },
          data: { computedScore: 5500 },
        });

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Finally, make sure that the participants were assigned to the same battle
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        participantB = await BattleParticipant.refreshFromDatabase(participantB);
        assert.notStrictEqual(participantA.battleId, null);
        assert.notStrictEqual(participantB.battleId, null);
        assert.strictEqual(participantA.battleId, participantB.battleId);
      });
      it('should match two users with scores that are somewhat close, but it might take a few seconds (5,000 vs 9,000)', async () => {
        // User A's score is 5000
        // Update User B's score to be 9000:
        userB = await prisma.user.update({
          where: { id: userB.id },
          data: { computedScore: 9000 },
        });

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });
        // Ensure that the match didn't succeed
        assert.strictEqual(participantA.battleId, null);
        assert.strictEqual(participantB.battleId, null);

        // Advance time forwards 15 seconds
        MockDate.set(addSeconds(new Date(), 15));

        // Run the battle matching algorithm AGAIN!
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Finally, make sure that the participants were assigned to the same battle
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        participantB = await BattleParticipant.refreshFromDatabase(participantB);
        assert.notStrictEqual(participantA.battleId, null);
        assert.notStrictEqual(participantB.battleId, null);
        assert.strictEqual(participantA.battleId, participantB.battleId);
      });
      it('should match two users with scores that are very far apart, but it might take a few minutes (5,000 vs 12,000)', async () => {
        // User A's score is 5000
        // Update User B's score to be 12000:
        userB = await prisma.user.update({
          where: { id: userB.id },
          data: { computedScore: 12000 },
        });

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });
        // Ensure that the match didn't succeed
        assert.strictEqual(participantA.battleId, null);
        assert.strictEqual(participantB.battleId, null);

        // Advance time forwards 60 seconds
        MockDate.set(addSeconds(new Date(), 60));

        // Run the battle matching algorithm AGAIN!
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Finally, make sure that the participants were assigned to the same battle
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        participantB = await BattleParticipant.refreshFromDatabase(participantB);
        assert.notStrictEqual(participantA.battleId, null);
        assert.notStrictEqual(participantB.battleId, null);
        assert.strictEqual(participantA.battleId, participantB.battleId);
      });
      it('should not match two users with scores that are incredibly far apart, even after many minutes (5,000 vs 100,000)', async () => {
        // User A's score is 5000
        // Update User B's score to be 100k:
        userB = await prisma.user.update({
          where: { id: userB.id },
          data: { computedScore: 100_000 },
        });

        // Advance time forwards 15 minutes
        MockDate.set(addMinutes(new Date(), 15));

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });
        // Ensure that the match didn't succeed
        assert.strictEqual(participantA.battleId, null);
        assert.strictEqual(participantB.battleId, null);
      });
      it('should match two users even if they have a large score difference (5,000 vs 100,000) when the machingAlgorithm is RANDOM', async () => {
        // NOTE: the reason this RANDOM algorithm exists is for development purposes, so that for testing any two
        // users can be matched automatically.

        // User A's score is 5000
        // Update User B's score to be 100k:
        userB = await prisma.user.update({
          where: { id: userB.id },
          data: { computedScore: 100_000 },
        });

        // Update participantA's `matchingAlgorithm` to be RANDOM:
        await prisma.battleParticipant.update({
          where: { id: participantA.id },
          data: { matchingAlgorithm: 'RANDOM' },
        });
        participantA = await BattleParticipant.refreshFromDatabase(participantA);

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Finally, make sure that the participants were assigned to the same battle
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        participantB = await BattleParticipant.refreshFromDatabase(participantB);
        assert.notStrictEqual(participantA.battleId, null);
        assert.notStrictEqual(participantB.battleId, null);
        assert.strictEqual(participantA.battleId, participantB.battleId);
      });
      it('should terminate the matching process if a battle participant is matching for over 30 minutes', async () => {
        // Advance time forwards 45 minutes
        MockDate.set(addMinutes(new Date(), 45));

        // Run the battle matching algorithm
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Make sure that the participants matching was terminated
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        assert.notStrictEqual(participantA.madeInactiveAt, null);
        assert.strictEqual(participantA.madeInactiveReason, 'MATCHING_TIMED_OUT');
      });

      it('should only associate enabled beats with a battle when performing matching', async () => {
        // Delete all beats in the list
        await prisma.battleBeat.deleteMany({});

        // Make two new beats, one that is enabled, and one that is disabled
        const enabledBeat = await prisma.battleBeat.create({
          data: { beatKey: 'enabled.mp3', enabled: true },
        });
        const disabledBeat = await prisma.battleBeat.create({
          data: { beatKey: 'disabled_mp3', enabled: false },
        });

        // Run the battle matching algorithm (the users have the same score, so they will definitely
        // match)
        await runBattleParticipantMatchingWorker({
          version: 1,
          type: 'MATCH_ONE_PARTICIPANT',
          battleParticipantId: participantA.id,
        });

        // Finally, make sure that the participants were assigned to the same battle
        participantA = await BattleParticipant.refreshFromDatabase(participantA);
        participantB = await BattleParticipant.refreshFromDatabase(participantB);
        assert.strictEqual(participantA.battleId, participantB.battleId);

        // And that the beat associated with the battle is the enabled beat
        const battle = await Battle.getById(participantA.battleId);
        assert.strictEqual(battle.beatId, enabledBeat.id);
      });
    });

    it.skip(
      'should be able to generate a twilio token for a given participant so they can join the twilio video call',
    );
    it('should be unable to mark a participant as ready if they are not a member of a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create a participant via the api
      const participantResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Mark that participant as ready
      await request(app)
        .put(`/v1/participants/${participantResponse.body.id}/ready`)
        // This should fail, because the participant is not part of a battle.
        .expect(400);
    });
    it('should be able to mark a participant as ready that is a member of a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match them for battle
      await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      MockDate.set(new Date('2020-01-01T00:00:00Z'));

      // Mark that participant as ready for battle
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/ready`).expect(204);

      // And after that, the `readyForBattleAt` field should be set to be non-null
      const updatedParticipant = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantAResponse.body.id },
      });
      assert.strictEqual(
        updatedParticipant.readyForBattleAt?.toISOString(),
        '2020-01-01T00:00:00.000Z',
      );
    });
    it('should start the associated battle when all participants are ready', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match them for battle
      let battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      MockDate.set(new Date('2020-01-01T00:00:00Z'));

      // Mark participant A as ready for battle
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/ready`).expect(204);

      // Get the latest data from the database for all participants and the battle
      let updatedParticipantA = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantAResponse.body.id },
      });
      let updatedParticipantB = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantBResponse.body.id },
      });
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that after the first ready call, the `readyForBattleAt` value is set on updatedParticipantA ONLY
      assert.strictEqual(
        updatedParticipantA.readyForBattleAt?.toISOString(),
        '2020-01-01T00:00:00.000Z',
      );
      assert.strictEqual(updatedParticipantB.readyForBattleAt, null);

      // And that the battle has NOT started - participant B is not ready yet!
      assert.strictEqual(battle.startedAt, null);

      MockDate.set(new Date('2020-01-01T00:00:05Z'));

      // Finally, mark participant B as ready for battle
      await request(app).put(`/v1/participants/${participantBResponse.body.id}/ready`).expect(204);

      // Get the latest data from the database for all participants and the battle
      updatedParticipantA = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantAResponse.body.id },
      });
      updatedParticipantB = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantBResponse.body.id },
      });
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that now BOTH participants are ready for battle
      assert.strictEqual(
        updatedParticipantA.readyForBattleAt?.toISOString(),
        '2020-01-01T00:00:00.000Z',
      );
      assert.strictEqual(
        updatedParticipantB.readyForBattleAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );

      // And that the battle HAS now started, since both participants are ready!
      assert.strictEqual(battle.startedAt?.toISOString(), '2020-01-01T00:00:05.000Z');
    });
    it('should let a participant check in to the server to let the server know that the participant is still active', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      MockDate.set(new Date('2020-01-01T00:00:00Z'));

      const participantResponse = await request(app).post('/v1/participants').expect(201);

      // Make sure the participant is initially online
      assert.strictEqual(participantResponse.body.connectionStatus, 'ONLINE');

      const participantId = participantResponse.body.id;

      // Make sure that one initial checkin was created
      let numberOfCheckins = await prisma.battleParticipantCheckin.count({
        where: { battleParticipantId: participantId },
      });
      assert.strictEqual(numberOfCheckins, 1);

      // Move time forward 2 seconds
      MockDate.set(new Date('2020-01-01T00:00:02Z'));

      // Make a checkin request, which should make a new checkin in the database
      await request(app).put(`/v1/participants/${participantId}/checkin`).expect(204);

      // Make sure that a checkin was created
      let checkins = await prisma.battleParticipantCheckin.findMany({
        where: { battleParticipantId: participantId },
        orderBy: { checkedInAt: 'asc' },
      });
      assert.strictEqual(checkins.length, 2);
      assert.strictEqual(checkins[1].checkedInAt.toISOString(), '2020-01-01T00:00:02.000Z');

      // Make sure that the participant is still online and was not made inactive after that checkin
      let participant = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      assert.strictEqual(participant.connectionStatus, 'ONLINE');
      assert.strictEqual(participant.madeInactiveAt, null);

      // Advance time further, this time 30 seconds
      MockDate.set(new Date('2020-01-01T00:00:32Z'));

      // Run the connection status change worker - this worker looks at checkins and moves
      // participants that are ONLINE to be OFFLINE if there have not been any checkins in a while
      await runConnectionStatusChangeWorker();

      // Make sure that the participant went offline
      participant = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      assert.strictEqual(participant.connectionStatus, 'OFFLINE');
    });
    it('should allow a participant to specify a state, context, and milliseconds video offset when checking in to give the server more information', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      MockDate.set(new Date('2020-01-01T00:00:00Z'));

      const participantResponse = await request(app).post('/v1/participants').expect(201);
      const participantId = participantResponse.body.id;

      // Make sure that no checkins were initially created
      let numberOfCheckins = await prisma.battleParticipantCheckin.count({
        where: { battleParticipantId: participantId },
      });
      assert.strictEqual(numberOfCheckins, 1);

      // Move time forward 2 seconds
      MockDate.set(new Date('2020-01-01T00:00:02Z'));

      // Make a checkin request, which should make a new checkin in the database
      await request(app)
        .put(`/v1/participants/${participantId}/checkin`)
        .send({
          currentState: 'CUSTOM_STATE',
          currentContext: { dummy: 'state machine context' },
          videoStreamOffsetMilliseconds: 999,
        })
        .expect(204);

      // Make sure that a checkin was created
      let checkins = await prisma.battleParticipantCheckin.findMany({
        where: { battleParticipantId: participantId },
        orderBy: { checkedInAt: 'asc' },
      });
      assert.strictEqual(checkins.length, 2);
      assert.strictEqual(checkins[1].checkedInAt.toISOString(), '2020-01-01T00:00:02.000Z');

      // And make sure that the specified custom metadata was included in the checkin
      assert.strictEqual(checkins[1].state, 'CUSTOM_STATE');
      assert.strictEqual(JSON.stringify(checkins[1].context), '{"dummy":"state machine context"}');
      assert.strictEqual(checkins[1].videoStreamOffsetMilliseconds, 999);
    });
    it('should be able to leave a PUBLIC BATTLE AFTER it starts and have it be marked as a forfeit', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      let battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Mark both participants as ready for battle
      MockDate.set(new Date('2020-01-01T00:00:00Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/ready`).expect(204);
      await request(app).put(`/v1/participants/${participantBResponse.body.id}/ready`).expect(204);

      // Now, the battle has started!

      // Now, as participant A, make a request to leave the battle
      MockDate.set(new Date('2020-01-01T00:00:05Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/leave`).expect(204);

      const updatedParticipantA = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantAResponse.body.id },
      });
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that after this request, the battle has been forced to complete
      assert.strictEqual(battle.completedAt?.toISOString(), '2020-01-01T00:00:05.000Z');
      assert.strictEqual(battle.madeInactiveAt?.toISOString(), '2020-01-01T00:00:05.000Z');

      // And that the reason why the battle was terminated was the generic / default reason
      assert.strictEqual(battle.madeInactiveReason, 'PARTICIPANT_LEFT_BATTLE');

      // The participant should have ALSO been made inactive
      assert.strictEqual(
        updatedParticipantA.madeInactiveAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );

      // And finally, the participant should have been marked as having forfeit, because the battle
      // started when they left
      assert.strictEqual(
        updatedParticipantA.forfeitedAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );
    });
    it('should be able to leave a PUBLIC BATTLE BEFORE the participant is matched and have no consequences', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create a sample participant via the api
      const participantAResponse = await request(app).post('/v1/participants').expect(201);

      // Now, as participant A, make a request to leave
      MockDate.set(new Date('2020-01-01T00:00:05Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/leave`).expect(204);

      const updatedParticipantA = await BattleParticipant.getById(participantAResponse.body.id);

      // The participant should have been made inactive
      assert.strictEqual(
        updatedParticipantA!.madeInactiveAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );

      // And finally, the participant should NOT have been marked as forfeiting, because the battle
      // hasn't yet been started
      assert.strictEqual(updatedParticipantA!.forfeitedAt, null);
    });
    it('should be able to leave a PUBLIC BATTLE AFTER it is complete with no consequences', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      let battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Mark both participants as ready for battle
      MockDate.set(new Date('2020-01-01T00:00:00Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/ready`).expect(204);
      await request(app).put(`/v1/participants/${participantBResponse.body.id}/ready`).expect(204);

      // Simulate the steps that would (roughly) happen in a real battle
      await request(app)
        .put(`/v1/participants/${participantAResponse.body.id}/checkin`)
        .send({
          currentState: 'COIN_TOSS',
          videoStreamOffsetMilliseconds: 0,
        })
        .expect(204);
      await request(app)
        .put(`/v1/participants/${participantBResponse.body.id}/checkin`)
        .send({
          currentState: 'COIN_TOSS',
          videoStreamOffsetMilliseconds: 0,
        })
        .expect(204);
      await request(app)
        .put(`/v1/participants/${participantAResponse.body.id}/checkin`)
        .send({
          currentState: 'WARM_UP',
          videoStreamOffsetMilliseconds: 10_000,
        })
        .expect(204);
      await request(app)
        .put(`/v1/participants/${participantBResponse.body.id}/checkin`)
        .send({
          currentState: 'WAITING',
          videoStreamOffsetMilliseconds: 10_000,
        })
        .expect(204);
      await request(app)
        .put(`/v1/participants/${participantAResponse.body.id}/checkin`)
        .send({
          currentState: 'BATTLE',
          videoStreamOffsetMilliseconds: 20_000,
        })
        .expect(204);

      // Eventually, all the state machines should go into "complete"
      await request(app)
        .put(`/v1/participants/${participantAResponse.body.id}/checkin`)
        .send({
          currentState: 'COMPLETE',
          videoStreamOffsetMilliseconds: 25_000,
        })
        .expect(204);
      await request(app)
        .put(`/v1/participants/${participantBResponse.body.id}/checkin`)
        .send({
          currentState: 'COMPLETE',
          videoStreamOffsetMilliseconds: 25_000,
        })
        .expect(204);

      // Now, as participant A, make a request to leave the battle
      MockDate.set(new Date('2020-01-01T00:00:05Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/leave`).expect(204);

      const updatedParticipantA = await prisma.battleParticipant.findUniqueOrThrow({
        where: { id: participantAResponse.body.id },
      });
      battle = await Battle.refreshFromDatabase(battle);

      // Make sure that the participant should have been made inactive
      assert.strictEqual(
        updatedParticipantA.madeInactiveAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );

      // Make sure the participant did NOT get marked as having forfeit - they left after the battle
      // completed
      assert.strictEqual(updatedParticipantA.forfeitedAt, null);
    });
    it('should only mark the first user to leave a public battle after it starts as forfeitting', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      let battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Mark both participants as ready for battle
      MockDate.set(new Date('2020-01-01T00:00:00Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/ready`).expect(204);
      await request(app).put(`/v1/participants/${participantBResponse.body.id}/ready`).expect(204);

      // Now, the battle has started!

      // Now, as participant A, make a request to leave the battle
      MockDate.set(new Date('2020-01-01T00:00:05Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/leave`).expect(204);

      const updatedParticipantA = await BattleParticipant.getById(participantAResponse.body.id);

      // Make sure that participantA has been marked as no longer in the battle
      assert.strictEqual(
        updatedParticipantA!.madeInactiveAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );

      // Make sure participantA was marked as having forfeit, since they left after the battle
      // started
      assert.strictEqual(
        updatedParticipantA!.forfeitedAt?.toISOString(),
        '2020-01-01T00:00:05.000Z',
      );

      // Now, as participant N, leave the battle
      MockDate.set(new Date('2020-01-01T00:00:10Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/leave`).expect(204);

      const updatedParticipantB = await BattleParticipant.getById(participantBResponse.body.id);

      // Make sure that participantB has been marked as no longer in the battle
      assert.strictEqual(
        updatedParticipantB!.madeInactiveAt?.toISOString(),
        '2020-01-01T00:00:10.000Z',
      );

      // Make sure participantB was NOT marked as having forfeit, since participantA already did
      // forfeit
      assert.strictEqual(updatedParticipantB!.forfeitedAt, null);
    });
    it('should be able to publish events generated while running the state machine to the server', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      let battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Mark both participants as ready for battle
      MockDate.set(new Date('2020-01-01T00:00:00Z'));
      await request(app).put(`/v1/participants/${participantAResponse.body.id}/ready`).expect(204);
      await request(app).put(`/v1/participants/${participantBResponse.body.id}/ready`).expect(204);

      // The battle has started!

      // Now, simulate participant A registering a state machine event which participant B should
      // receive
      const stateMachineEventUuid = uuidv4();
      const response = await request(app)
        .post(`/v1/participants/${participantAResponse.body.id}/state-machine-events`)
        .send({
          uuid: stateMachineEventUuid,
          payload: {
            type: 'MOVE_TO_NEXT_PARTICIPANT',
          },
        })
        .expect(200);

      // Make sure the body contains the expected data
      assert.strictEqual(response.body.battleId, battle.id);
      assert.strictEqual(response.body.clientGeneratedUuid, stateMachineEventUuid);
      assert.strictEqual(response.body.triggeredByParticipantId, participantAResponse.body.id);
      assert.deepStrictEqual(response.body.payload, { type: 'MOVE_TO_NEXT_PARTICIPANT' });

      // And finally, also make sure that the event was saved into the database
      const stateMachineEvent = await prisma.battleParticipantStateMachineEvent.findUniqueOrThrow({
        where: {
          id: response.body.id,
        },
      });
      assert.strictEqual(stateMachineEvent.battleId, battle.id);
      assert.strictEqual(stateMachineEvent.clientGeneratedUuid, stateMachineEventUuid);
      assert.strictEqual(stateMachineEvent.triggeredByParticipantId, participantAResponse.body.id);
      assert.deepStrictEqual(stateMachineEvent.payload, { type: 'MOVE_TO_NEXT_PARTICIPANT' });
    });
  });

  describe('Battles', () => {
    it('should be able to get a battle from the server by id', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      const battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Request the battle from the server
      const response = await request(app).get(`/v1/battles/${battle.id}`).expect(200);

      // And make sure the right data comes back
      assert.strictEqual(response.body.id, battle.id);
    });
    it('should fail to get a battle from the server with an invalid id', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app).get('/v1/battles/FAKEID').expect(404);
    });
    it('should be able to get a battle state machine definition matching the configured timeouts', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      const battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Request the state machine definition from the server
      const response = await request(app)
        .get(`/v1/battles/${battle.id}/state-machine-definition`)
        .expect(200);

      // And make sure the state transitions take the correct amounts of time
      // NOTE: this code may end up being brittle if the state machine is substantialyl reformatted.
      const coinTossLengthMilliseconds = parseInt(
        Object.keys(response.body.states['COIN_TOSS'].after)[0],
        10,
      );
      assert.strictEqual(coinTossLengthMilliseconds, 10_000); // NOTE: right now, this 10_000 number is hardcoded in the state machine.

      const timeBetweenWarmUpAndBattleMilliseconds = parseInt(
        Object.keys(response.body.states['WARM_UP'].after)[0],
        10,
      );
      assert.strictEqual(timeBetweenWarmUpAndBattleMilliseconds, battle.warmupLengthSeconds * 1000);

      const timeBetweenBattleAndEndOfTurnMilliseconds = parseInt(
        Object.keys(response.body.states['BATTLE'].after)[0],
        10,
      );
      assert.strictEqual(
        timeBetweenBattleAndEndOfTurnMilliseconds,
        (battle.turnLengthSeconds - battle.warmupLengthSeconds) * 1000,
      );
    });
    it(`should be able to get a battle's projected outcome before starting`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create two participants via the api
      const participantAResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);
      const participantBResponse = await request(app)
        .post('/v1/participants')
        .send({
          /* TODO: add fields in here */
        })
        .expect(201);

      // Match the two created participants for battle
      const battle = await Battle.create(
        [
          (await BattleParticipant.getById(participantAResponse.body.id)) as BattleParticipant,
          (await BattleParticipant.getById(participantBResponse.body.id)) as BattleParticipant,
        ],
        'PUBLIC',
      );

      // Request the outcome of the battle participant scores from the server
      const response = await request(app)
        .get(`/v1/battles/${battle.id}/projected-outcome`)
        .expect(200);

      // And make sure that they are at least specified and seem roughly correct
      assert.strictEqual(typeof response.body.startingScore, 'number');
      assert.strictEqual(typeof response.body.projectedScores.win, 'number');
      assert.strictEqual(typeof response.body.projectedScores.loss, 'number');
      assert.strictEqual(typeof response.body.projectedScores.tie, 'number');
      assert(response.body.projectedScores.win >= response.body.startingScore);
      assert(response.body.projectedScores.loss <= response.body.startingScore);
    });
  });

  describe('Battle Participant - Video Encoding', () => {
    let secondUser: PrismaUser;
    let participantA: BattleParticipant;
    let participantB: BattleParticipant;
    let battle: Battle;

    beforeEach(async () => {
      // Remove mock video files
      await RecordingsObjectStorage.remove('raw/RT_VIDEO_A.mkv');
      await RecordingsObjectStorage.remove('raw/RT_AUDIO_A.mka');
      await RecordingsObjectStorage.remove('raw/RT_VIDEO_B.mkv');
      await RecordingsObjectStorage.remove('raw/RT_AUDIO_B.mka');

      // Create a secondary fake user account
      secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUS',
          handle: 'BOGUS',
          phoneNumber: '555-555-5555',
        },
      });

      // Create two participants associated with that user account with some twilio track ids
      participantA = await BattleParticipant.create(user.id);
      participantA = await BattleParticipant.storeTwilioTrackIds(
        participantA,
        'MT_AUDIO_A',
        'MT_VIDEO_A',
        'MT_DATA_A',
      );

      participantB = await BattleParticipant.create(secondUser.id);
      participantB = await BattleParticipant.storeTwilioTrackIds(
        participantB,
        'MT_AUDIO_B',
        'MT_VIDEO_B',
        'MT_DATA_B',
      );

      battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Make the battle participant inactive, as if they left the battle
      [participantA] = await BattleParticipant.markInactive([participantA.id]);
    });

    describe('Twilio Video Webhook - recording-complete event', () => {
      it('should be able to process a audio webhook then a video webhook', async () => {
        const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

        // Make a webhook request simulating the audio recording completing
        await request(app)
          .post(`/v1/battles/${battle.id}/twilio-video-room-webhook`)
          .send(
            'StatusCallbackEvent=recording-completed&Type=audio&SourceSid=MT_AUDIO_A&RecordingSid=RT_AUDIO_A',
          )
          .expect(204);

        // Make sure that the audio recording id was stored on participant A
        participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
        assert.strictEqual(participantA.twilioAudioRecordingId, 'RT_AUDIO_A');
        assert.strictEqual(participantA.twilioVideoRecordingId, null);

        // Now, make a webhook request simulating the video recording completing
        await request(app)
          .post(`/v1/battles/${battle.id}/twilio-video-room-webhook`)
          .send(
            'StatusCallbackEvent=recording-completed&Type=video&SourceSid=MT_VIDEO_A&RecordingSid=RT_VIDEO_A',
          )
          .expect(204);

        // Make sure that the video recording id was stored on participant A
        participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
        assert.strictEqual(participantA.twilioAudioRecordingId, 'RT_AUDIO_A');
        assert.strictEqual(participantA.twilioVideoRecordingId, 'RT_VIDEO_A');

        // And make sure that the participant is now queuing for the video to be encoded
        assert.strictEqual(participantA.processedVideoStatus, 'QUEUEING');
      });
    });

    it('should combine together mkv and mka files into a final mp4 file', async function (this: FixMe) {
      // Increase timeout, since this test is converting a video via ffmpeg
      // NOTE: this might need to be increased in the future on other systems!
      this.timeout(10_000);

      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Copy demo videos into object storage, as if they were put there by twilio video
      await RecordingsObjectStorage.putFromFilesystem('raw/RT_VIDEO_A.mkv', MOCK_MKV_VIDEO_PATH);
      await RecordingsObjectStorage.putFromFilesystem('raw/RT_AUDIO_A.mka', MOCK_MKA_AUDIO_PATH);

      // Make a series of webhook request simulating the AUDIO recording completing...
      await request(app)
        .post(`/v1/battles/${battle.id}/twilio-video-room-webhook`)
        .send(
          'StatusCallbackEvent=recording-completed&Type=audio&SourceSid=MT_AUDIO_A&RecordingSid=RT_AUDIO_A',
        )
        .expect(204);
      // ... and then the VIDEO recording completing
      await request(app)
        .post(`/v1/battles/${battle.id}/twilio-video-room-webhook`)
        .send(
          'StatusCallbackEvent=recording-completed&Type=video&SourceSid=MT_VIDEO_A&RecordingSid=RT_VIDEO_A',
        )
        .expect(204);

      // Make sure that the participant is now queuing for the video to be encoded
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
      assert.strictEqual(participantA.processedVideoStatus, 'QUEUEING');

      // Run the video encoding worker
      await runBattleParticipantVideoGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_PARTICIPANT_VIDEO',
        battleParticipantId: participantA.id,
      });

      // Make sure that the participant video encoding was successful!
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
      assert.strictEqual(participantA.processedVideoStatus, 'COMPLETED');

      // Make sure that after the video encoding worker is done, the video generation worker placed
      // a video into the right output location in object storage
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`encoded/${battle.id}/${participantA.id}.mp4`),
        null,
      );
    });
    it('should not process the participant video if it is not associated with a battle', async () => {
      // Copy demo videos into object storage, as if they were put there by twilio video
      await RecordingsObjectStorage.putFromFilesystem('raw/RT_VIDEO_A.mkv', MOCK_MKV_VIDEO_PATH);
      await RecordingsObjectStorage.putFromFilesystem('raw/RT_AUDIO_A.mka', MOCK_MKA_AUDIO_PATH);

      // Create a brand new participant, with no metadata associated
      const participantNew = await BattleParticipant.create(user.id);

      // Run the video encoding worker
      await runBattleParticipantVideoGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_PARTICIPANT_VIDEO',
        battleParticipantId: participantNew.id,
      });

      // Make sure that the participant video encoding fails!
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
      assert.strictEqual(participantA.processedVideoStatus, null);
    });
    it('should not process the participant video if it does not have associated twilio video recording metadata', async () => {
      // Unset the twilio video metadata from the battle participant
      await prisma.battleParticipant.update({
        where: { id: participantA.id },
        data: {
          twilioVideoRecordingId: null,
          twilioAudioRecordingId: null,
        },
      });
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;

      // Run the video encoding worker
      await runBattleParticipantVideoGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_PARTICIPANT_VIDEO',
        battleParticipantId: participantA.id,
      });

      // Make sure that the participant video encoding fails
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
      assert.strictEqual(participantA.processedVideoStatus, null);
    });
    it('should fail to combine together video files if one file is missing', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Copy demo videos into object storage, as if they were put there by twilio video
      // NOTE: SKIP COPYING THE BELOW FILE!
      // await RecordingsObjectStorage.putFromFilesystem('raw/RT_VIDEO_A.mkv', MOCK_VIDEO_PATH);
      await RecordingsObjectStorage.putFromFilesystem('raw/RT_AUDIO_A.mka', MOCK_MKA_AUDIO_PATH);

      // Make a series of webhook request simulating the AUDIO recording completing...
      await request(app)
        .post(`/v1/battles/${battle.id}/twilio-video-room-webhook`)
        .send(
          'StatusCallbackEvent=recording-completed&Type=audio&SourceSid=MT_AUDIO_A&RecordingSid=RT_AUDIO_A',
        )
        .expect(204);
      // ... and then the VIDEO recording completing
      await request(app)
        .post(`/v1/battles/${battle.id}/twilio-video-room-webhook`)
        .send(
          'StatusCallbackEvent=recording-completed&Type=video&SourceSid=MT_VIDEO_A&RecordingSid=RT_VIDEO_A',
        )
        .expect(204);

      // Make sure that the participant is now queuing for the video to be encoded
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
      assert.strictEqual(participantA.processedVideoStatus, 'QUEUEING');

      // Run the video encoding worker
      await runBattleParticipantVideoGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_PARTICIPANT_VIDEO',
        battleParticipantId: participantA.id,
      });

      // Make sure that the participant video encoding failed
      participantA = (await BattleParticipant.getById(participantA.id)) as BattleParticipant;
      assert.strictEqual(participantA.processedVideoStatus, 'ERROR');
    });
    it(
      'should ensure that the final seconds of the video after the battle has transitioned into COMPLETE are muted',
    );
    it('should generate thumbnails for the video files and write them to s3');
  });

  describe('Battle - Video Export', () => {
    let secondUser: PrismaUser;
    let participantA: BattleParticipant;
    let participantB: BattleParticipant;
    let battle: Battle;

    beforeEach(async () => {
      // Create a secondary fake user account
      secondUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUS',
          handle: 'BOGUS',
          phoneNumber: '555-555-5555',
        },
      });

      // Create two participants associated with that user account with some twilio track ids
      participantA = await BattleParticipant.create(user.id);
      participantA = await BattleParticipant.storeTwilioTrackIds(
        participantA,
        'MT_AUDIO_A',
        'MT_VIDEO_A',
        'MT_DATA_A',
      );

      participantB = await BattleParticipant.create(secondUser.id);
      participantB = await BattleParticipant.storeTwilioTrackIds(
        participantB,
        'MT_AUDIO_B',
        'MT_VIDEO_B',
        'MT_DATA_B',
      );

      battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Make the battle participant inactive, as if they left the battle
      [participantA] = await BattleParticipant.markInactive([participantA.id]);

      // Remove mock video files
      await RecordingsObjectStorage.remove('raw/RT_VIDEO_A.mkv');
      await RecordingsObjectStorage.remove('raw/RT_AUDIO_A.mka');
      await RecordingsObjectStorage.remove('raw/RT_VIDEO_B.mkv');
      await RecordingsObjectStorage.remove('raw/RT_AUDIO_B.mka');
      await RecordingsObjectStorage.remove(`encoded/${battle.id}/${participantA.id}.mp4`);
      await RecordingsObjectStorage.remove(`encoded/${battle.id}/${participantB.id}.mp4`);
    });

    it('should generate a battle video export for a battle with two mp4 participant videos WITHOUT THUMBNAILS', async function (this: FixMe) {
      // Increase timeout, since this test is converting a video via ffmpeg
      // NOTE: this might need to be increased in the future on other systems!
      this.timeout(10_000);

      const participantAEncodedVideoKey = `encoded/${battle.id}/${participantA.id}.mp4`;
      const participantBEncodedVideoKey = `encoded/${battle.id}/${participantB.id}.mp4`;

      // Copy mock encoded videos into object storage, as if they were put there by twilio video
      await RecordingsObjectStorage.putFromFilesystem(participantAEncodedVideoKey, MOCK_MP4_PATH);
      await RecordingsObjectStorage.putFromFilesystem(participantBEncodedVideoKey, MOCK_MP4_PATH);

      // Update test participants to be associated with mock encoded video data
      await BattleParticipant.updateProcessedVideoStatus(
        participantA,
        'COMPLETED',
        participantAEncodedVideoKey,
      );
      await BattleParticipant.updateProcessedVideoStatus(
        participantB,
        'COMPLETED',
        participantBEncodedVideoKey,
      );

      // Run the video encoding worker
      await runBattleVideoExportGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_EXPORT_VIDEO',
        battleId: battle.id,
      });

      // Make sure that generating the battle video export was successful!
      battle = (await Battle.getById(battle.id)) as Battle;
      assert.strictEqual(battle.exportedVideoStatus, 'COMPLETED');

      // Make sure that after the video encoding worker is done, the video generation worker placed
      // a video into the right output location in object storage
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export.mp4`),
        null,
      );
    });
    it('should generate a battle video export for a battle with two mp4 participant videos WITH THUMBNAILS', async function (this: FixMe) {
      // Increase timeout, since this test is converting a video via ffmpeg
      // NOTE: this might need to be increased in the future on other systems!
      this.timeout(10_000);

      // Copy mock encoded videos into object storage, as if they were put there by the participant
      // video generation worker
      const participantAEncodedVideoKey = `encoded/${battle.id}/${participantA.id}.mp4`;
      const participantBEncodedVideoKey = `encoded/${battle.id}/${participantB.id}.mp4`;
      await RecordingsObjectStorage.putFromFilesystem(participantAEncodedVideoKey, MOCK_MP4_PATH);
      await RecordingsObjectStorage.putFromFilesystem(participantBEncodedVideoKey, MOCK_MP4_PATH);

      // Update test participants to be associated with mock encoded video data
      await BattleParticipant.updateProcessedVideoStatus(
        participantA,
        'COMPLETED',
        participantAEncodedVideoKey,
      );
      await BattleParticipant.updateProcessedVideoStatus(
        participantB,
        'COMPLETED',
        participantBEncodedVideoKey,
      );

      // Copy mock encoded thumbnails into object storage, as if they were put there by the
      // participant generation worker
      const participantAEncoded512ThumbnailKey = `encoded/${battle.id}/${participantA.id}-512.jpg`;
      const participantBEncoded512ThumbnailKey = `encoded/${battle.id}/${participantB.id}-512.jpg`;
      await RecordingsObjectStorage.putFromFilesystem(participantAEncoded512ThumbnailKey, MOCK_512_THUMBNAIL_PATH);
      await RecordingsObjectStorage.putFromFilesystem(participantBEncoded512ThumbnailKey, MOCK_512_THUMBNAIL_PATH);

      // Create two thumbnail entries for these keys
      await prisma.battleParticipantThumbnail.create({
        data: {
          battleParticipantId: participantA.id,
          size: 512,
          key: participantAEncoded512ThumbnailKey,
        },
      });
      await prisma.battleParticipantThumbnail.create({
        data: {
          battleParticipantId: participantB.id,
          size: 512,
          key: participantBEncoded512ThumbnailKey,
        },
      });

      // Run the video encoding worker
      await runBattleVideoExportGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_EXPORT_VIDEO',
        battleId: battle.id,
      });

      // Make sure that generating the battle video export was successful!
      battle = (await Battle.getById(battle.id)) as Battle;
      assert.strictEqual(battle.exportedVideoStatus, 'COMPLETED');

      // Make sure that after the video encoding worker is done, the video generation worker placed
      // a video into the right output location in object storage
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export.mp4`),
        null,
      );

      // Make sure that thumbnails were written to the object storage by the export video generation
      // worker
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export-32.jpg`),
        null,
      );
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export-64.jpg`),
        null,
      );
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export-128.jpg`),
        null,
      );
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export-256.jpg`),
        null,
      );
      assert.notStrictEqual(
        await RecordingsObjectStorage.get(`export/${battle.id}/export-512.jpg`),
        null,
      );
    });
    it('should be unable to generate a battle video export for a battle with ONE mp4 participant video', async () => {
      const participantAEncodedVideoKey = `encoded/${battle.id}/${participantA.id}.mp4`;

      // Copy mock encoded videos into object storage FOR ONE PARTICIPANT
      await RecordingsObjectStorage.putFromFilesystem(participantAEncodedVideoKey, MOCK_MP4_PATH);
      // await RecordingsObjectStorage.putFromFilesystem(participantBEncodedVideoKey, MOCK_MP4_PATH);

      // Update test participants to be associated with mock encoded video data FOR ONE PARTICIPANT
      await BattleParticipant.updateProcessedVideoStatus(
        participantA,
        'COMPLETED',
        participantAEncodedVideoKey,
      );
      // await BattleParticipant.updateProcessedVideoStatus(participantB, 'COMPLETED', participantBEncodedVideoKey);

      // Run the video encoding worker
      await runBattleVideoExportGenerationWorker({
        version: 1,
        type: 'GENERATE_BATTLE_EXPORT_VIDEO',
        battleId: battle.id,
      });

      // Make sure that generating the battle video export didn't happen
      battle = (await Battle.getById(battle.id)) as Battle;
      assert.strictEqual(battle.exportedVideoStatus, null);
    });
    it(
      'should generate a battle video export with more than two participants in a battle (the resulting video just includes the first two)',
    );
    it(
      'should generate a battle video export that only includes a time range starting post-COIN_TOSS and ending pre-COMPLETE',
    );
  });

  describe('Battle - Auto Forfeit', () => {
    afterEach(() => {
      MockDate.reset();
    });

    it(`should auto forfeit a battle when a user hasn't checked in after 10 seconds`, async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battle.id);
      await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');

      // Move the time up 15 seconds
      MockDate.set(addSeconds(new Date(), 15));

      // Mark all participants as offline because they haven't checked in after 15 seconds
      await runConnectionStatusChangeWorker();

      // Run the auto forfeit worker
      await runBattleAutoForfeitWorker();

      // Make sure that the battle has been forfeited
      battle = await Battle.refreshFromDatabase(battle);
      assert.notStrictEqual(battle.madeInactiveAt, null);
    });
    it(`should NOT auto forfeit a battle when a user has checked in recently`, async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battle.id);
      await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');

      // Run both workers
      await runConnectionStatusChangeWorker();
      await runBattleAutoForfeitWorker();

      // Make sure that the battle has NOT been forfeited
      battle = await Battle.refreshFromDatabase(battle);
      assert.strictEqual(battle.madeInactiveAt, null);
    });
    it(`should auto forfeit a battle when a user backgrounds the app while battling`, async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Simulate the steps that would (roughly) happen in a real battle
      await Battle.startBattle(battle.id);
      await BattleParticipant.performCheckin(participantA, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantB, 0, 'COIN_TOSS');
      await BattleParticipant.performCheckin(participantA, 10_000, 'WARM_UP');
      await BattleParticipant.performCheckin(participantB, 10_000, 'WAITING');
      await BattleParticipant.performCheckin(participantA, 20_000, 'BATTLE');

      // Make participant A background the app
      await BattleParticipant.updateAppState(participantA, 'BACKGROUND');

      // Move the time up 15 seconds
      MockDate.set(addSeconds(new Date(), 15));

      // Run the auto forfeit worker
      await runBattleAutoForfeitWorker();

      // Make sure that the battle has been forfeited
      battle = await Battle.refreshFromDatabase(battle);
      assert.notStrictEqual(battle.madeInactiveAt, null);
    });
    it(`should NOT auto forfeit a battle if a user hasn't checked in after 1 second`, async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Move the time up 1 second
      MockDate.set(addSeconds(new Date(), 1));

      // Mark all participants as offline because they haven't checked in after 15 seconds
      await runConnectionStatusChangeWorker();

      // Run the auto forfeit worker
      await runBattleAutoForfeitWorker();

      // Make sure that the battle has NOT been forfeited
      battle = await Battle.refreshFromDatabase(battle);
      assert.strictEqual(battle.madeInactiveAt, null);
    });

    it(`should auto forfeit a battle if a user never checks in after 15 seconds`, async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Move the time up 15 seconds
      MockDate.set(addSeconds(new Date(), 15));

      // Mark all participants as offline because they haven't checked in after 15 seconds
      await runConnectionStatusChangeWorker();

      // Run the auto forfeit worker
      await runBattleAutoForfeitWorker();

      // Make sure that the battle has been forfeited
      battle = await Battle.refreshFromDatabase(battle);
      assert.notStrictEqual(battle.madeInactiveAt, null);
    });
  });

  describe('Home Feed', () => {
    it('should return a sorted list of all trending battles', async () => {
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

      // Cast a 2 votes on the battle at index 2:
      await BattleParticipant.castVoteFor(
        battles[2],
        battles[2].participants[0].id,
        user,
        10_000,
        10_500,
        2,
      );

      // Cast 1 vote on the battle at index 0:
      await BattleParticipant.castVoteFor(
        battles[0],
        battles[0].participants[0].id,
        user,
        10_000,
        10_500,
        1,
      );

      const trendingBattlesResponse = await request(app)
        .get('/v1/battles/home?feed=TRENDING')
        .expect(200);

      // console.log(trendingBattlesResponse.body)

      // Make sure that the first battle is battles[2]
      assert.strictEqual(trendingBattlesResponse.body.results[0].battleId, battles[2].id);

      // and the seconds battle is battles[0]
      assert.strictEqual(trendingBattlesResponse.body.results[1].battleId, battles[0].id);
    });
    it('should return a sorted list of all following battles', async () => {
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
      const thirdUser = await prisma.user.create({
        data: {
          clerkId: 'BOGUSTHIRDUSER',
          handle: 'BOGUSTHIRD',
          phoneNumber: '555-555-5553',
        },
      });

      // Create a few fake battles
      let battles: Array<BattleWithParticipantsAndCheckinsAndVotesAndEvents> = [];
      for (let i = 0; i < 4; i += 1) {
        const participantA = await BattleParticipant.create(firstUser.id);
        // NOTE: For the first battle, make it `firstUser` vs `thirdUser`:
        const participantB = await BattleParticipant.create(i === 0 ? thirdUser.id : secondUser.id);
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

      // Make the authed user follow `thirdUser`
      await User.followUser(user, thirdUser.id);

      // Get the first page of home page battles on the following feed:
      const followingBattlesResponse = await request(app)
        .get('/v1/battles/home?feed=FOLLOWING')
        .expect(200);

      // console.log(followingBattlesResponse.body)

      // Make sure that only one battle was returned
      assert.strictEqual(followingBattlesResponse.body.results.length, 1);

      // Make sure the first and only battle is battles[0]
      assert.strictEqual(followingBattlesResponse.body.results[0].battleId, battles[0].id);
    });
    it('should NOT return a private battle in the trending feed', async () => {
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

      // Cast a vote on the private battle
      await BattleParticipant.castVoteFor(battle, participantA.id, user, 10_000, 10_500, 1);

      const trendingBattlesResponse = await request(app)
        .get('/v1/battles/home?feed=TRENDING')
        .expect(200);

      // Make sure that no battles are returned, because the battle that was generated is private
      assert.strictEqual(trendingBattlesResponse.body.results.length, 0);
    });
  });

  describe('User Battle Voting', () => {
    describe('Vote casting causing user score recomputations', () => {
      it('should not allow voting in battles that have not started yet', async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 9999, // NOTE: this score is higher
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000, // NOTE: this score is lower
            },
          }),
        );

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // NOTE: the battle has not started yet!

        // Attempt to cast a vote in the battle
        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);

        const updatedFirstUser = await User.refreshFromDatabase(firstUser);
        const updatedSecondUser = await User.refreshFromDatabase(secondUser);

        // Verify that both user's scores did not change, since votes cannot be cast before a battle
        // officially starts
        assert.equal(firstUser.computedScore, updatedFirstUser.computedScore);
        assert.equal(secondUser.computedScore, updatedSecondUser.computedScore);
      });
      it('should leave user scores alone after initially starting a battle IF the users have the same score', async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Officially start the battle
        await Battle.startBattle(battle.id);
        battle = await Battle.refreshFromDatabase(battle);

        const updatedFirstUser = await User.refreshFromDatabase(firstUser);
        const updatedSecondUser = await User.refreshFromDatabase(secondUser);

        // Verify that both user's scores did not change, since they have the same initial score, and
        // the probability of either winning was 50% either way
        assert.equal(firstUser.computedScore, updatedFirstUser.computedScore);
        assert.equal(secondUser.computedScore, updatedSecondUser.computedScore);
      });
      it(`should NOT change a user's score when a battle has not received any votes`, async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 9999, // NOTE: this score is higher
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000, // NOTE: this score is lower
            },
          }),
        );

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Officially start the battle
        await Battle.startBattle(battle.id);
        battle = await Battle.refreshFromDatabase(battle);

        let previousFirstUser = firstUser;
        let previousSecondUser = secondUser;
        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that the `computedHasReceivedVotes` is false on the battle, since no votes have
        // been received
        assert.equal(battle.computedHasReceivedVotes, false);

        // Also verify that both user's scores stayed the same, since no votes have been cast
        assert.equal(previousFirstUser.computedScore, firstUser.computedScore);
        assert.equal(previousSecondUser.computedScore, secondUser.computedScore);

        // Now, cast a vote for participantA
        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);
        battle = await Battle.refreshFromDatabase(battle);

        // Verify that the `computedHasReceivedVotes` is now true, since a vote was cast
        assert.equal(battle.computedHasReceivedVotes, true);

        // And also verify that now, after the vote was cast, both user's scores changed
        previousFirstUser = firstUser;
        previousSecondUser = secondUser;
        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(firstUser);
        assert.notEqual(previousFirstUser.computedScore, firstUser.computedScore);
        assert.notEqual(previousSecondUser.computedScore, secondUser.computedScore);
      });
      it(`should change a user's score when a vote changes a battle's outcome`, async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Officially start the battle
        await Battle.startBattle(battle.id);
        battle = await Battle.refreshFromDatabase(battle);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);
        let firstUserPreviousScore = firstUser.computedScore;
        let secondUserPreviousScore = secondUser.computedScore;

        // Simulate a vote being cast for participantA (first user) in the battle
        // This changes the outcome of the battle, making participantA (firstUser) the winner
        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that the first user's score went up, and the second user's score went down due to
        // the battle changing outcome
        assert(firstUser.computedScore > firstUserPreviousScore);
        assert(secondUser.computedScore < secondUserPreviousScore);
      });
      it(`should change a user's score when they forfeit a PUBLIC battle BEFORE it has started`, async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);
        let firstUserPreviousScore = firstUser.computedScore;
        let secondUserPreviousScore = secondUser.computedScore;

        // Make `participantA` leave the battle prior to it being started
        //
        // This simulates leaving the battle while on the "found opponent" step
        await Battle.makeBattlesInactive([[battle.id, participantA.id]]);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that the first user's score went down, and the second user's score went up due to
        // the forfeit occurring
        assert(firstUser.computedScore < firstUserPreviousScore);
        assert(secondUser.computedScore > secondUserPreviousScore);
      });
      it(`should change a user's score when they forfeit a PUBLIC battle AFTER it has started`, async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Officially start the battle
        await Battle.startBattle(battle.id);
        battle = await Battle.refreshFromDatabase(battle);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);
        let firstUserPreviousScore = firstUser.computedScore;
        let secondUserPreviousScore = secondUser.computedScore;

        // Now, make `participantA` leave the battle, but since the battle has already started, then
        // this is considered a "forfeit" and `participantA` is penalized
        await Battle.makeBattlesInactive([[battle.id, participantA.id]]);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that the first user's score went down, and the second user's score went up due to
        // the forfeit occurring
        assert(firstUser.computedScore < firstUserPreviousScore);
        assert(secondUser.computedScore > secondUserPreviousScore);
      });
      it(`should NOT change a user's score when they forfeit a PRIVATE battle AFTER it has started`, async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );

        // Create a new PRIVATE battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PRIVATE');

        // Officially start the battle
        await Battle.startBattle(battle.id);
        battle = await Battle.refreshFromDatabase(battle);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);
        let firstUserPreviousScore = firstUser.computedScore;
        let secondUserPreviousScore = secondUser.computedScore;

        // Now, make `participantA` leave the battle, but since the battle has already started, then
        // this is considered a "forfeit"
        await Battle.makeBattlesInactive([[battle.id, participantA.id]]);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that there was no change in score
        assert.strictEqual(firstUser.computedScore, firstUserPreviousScore);
        assert.strictEqual(secondUser.computedScore, secondUserPreviousScore);
      });
      it(`should change a user's score back and forth when a series of votes change a battle's outcome repeatedly`, async () => {
        let firstUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'ONE',
              handle: 'ONE',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let secondUser = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'TWO',
              handle: 'TWO',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        const firstUserInitialScore = firstUser.computedScore;
        const secondUserInitialScore = secondUser.computedScore;

        // Create a new battle
        const participantA = await BattleParticipant.create(firstUser.id);
        const participantB = await BattleParticipant.create(secondUser.id);
        let battle = await Battle.create([participantA, participantB], 'PUBLIC');

        // Officially start the battle
        await Battle.startBattle(battle.id);
        battle = await Battle.refreshFromDatabase(battle);
        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        //
        // FIRST VOTE
        //
        // Simulate a vote being cast for participantA (first user) in the battle
        // This changes the outcome of the battle, making participantA (firstUser) the winner
        let firstUserPreviousScore = firstUser.computedScore;
        let secondUserPreviousScore = secondUser.computedScore;

        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that the first user's score went up, and the second user's score went down due to
        // the battle changing outcome
        assert(firstUser.computedScore > firstUserPreviousScore);
        assert(secondUser.computedScore < secondUserPreviousScore);

        //
        // SECOND VOTE
        //
        // Simulate a vote being cast for participantB (second user) in the battle
        // This makes the battle a tie again
        firstUserPreviousScore = firstUser.computedScore;
        secondUserPreviousScore = secondUser.computedScore;

        await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0);

        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that the user's scores reset back to their initial values now that the battle is a
        // tie again
        assert.equal(firstUser.computedScore, firstUserInitialScore);
        assert.equal(secondUser.computedScore, secondUserInitialScore);

        //
        // THIRD, FOURTH, FIFTH, ETC VOTE
        //
        firstUserPreviousScore = firstUser.computedScore;
        secondUserPreviousScore = secondUser.computedScore;
        // Simulate a series of votes being cast:
        // - participantB (second user)
        await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0);
        // - participantA (first user)
        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);
        // - participantA (first user)
        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);
        // - participantA (first user)
        await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0);
        // - participantB (second user)
        await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0);

        // The result: participantA has more votes at the end, and should have a higher score.
        firstUser = await User.refreshFromDatabase(firstUser);
        secondUser = await User.refreshFromDatabase(secondUser);

        // Verify that participant A's score is higher
        assert(firstUser.computedScore > firstUserPreviousScore);
        assert(secondUser.computedScore < secondUserPreviousScore);
      });
      it(`should change a user's score when an old battle's outcome changes`, async () => {
        //
        // PART ONE
        //

        // Create battle A
        let user_A = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: '_A',
              handle: '_A',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let user_APreviousScore = user_A.computedScore;
        let userAB = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'AB',
              handle: 'AB',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let userABPreviousScore = userAB.computedScore;
        const participantAA = await BattleParticipant.create(user_A.id);
        const participantAB = await BattleParticipant.create(userAB.id);
        let battleA = await Battle.create([participantAA, participantAB], 'PUBLIC');

        // Officially start battle A
        await Battle.startBattle(battleA.id);
        battleA = await Battle.refreshFromDatabase(battleA);
        user_A = await User.refreshFromDatabase(user_A);
        userAB = await User.refreshFromDatabase(userAB);

        // Place a vote in battle A, making battle A's winner participantAA
        await BattleParticipant.castVoteFor(battleA, participantAA.id, user, 0, 0);

        // Make sure that battle A's winning user (user_A) has a higher score
        user_A = await User.refreshFromDatabase(user_A);
        userAB = await User.refreshFromDatabase(userAB);
        assert(user_A.computedScore > user_APreviousScore);
        assert(userAB.computedScore < userABPreviousScore);

        user_APreviousScore = user_A.computedScore;
        userABPreviousScore = userAB.computedScore;

        //
        // PART TWO
        //

        // Create battle B
        // NOTE: user_A is ALSO part of battle B!
        let userBB = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'BB',
              handle: 'BB',
              phoneNumber: '555-555-5555',
              computedScore: 16000,
            },
          }),
        );
        let userBBPreviousScore = userBB.computedScore;
        const participantBA = await BattleParticipant.create(user_A.id);
        const participantBB = await BattleParticipant.create(userBB.id);
        let battleB = await Battle.create([participantBA, participantBB], 'PUBLIC');

        // Officially start battle B
        await Battle.startBattle(battleB.id);
        battleB = await Battle.refreshFromDatabase(battleB);
        user_A = await User.refreshFromDatabase(user_A);
        userBB = await User.refreshFromDatabase(userBB);

        // Place a vote in battle B, making battle B's winner participantBA
        await BattleParticipant.castVoteFor(battleB, participantBA.id, user, 0, 0);

        // Make sure that battle B's winning user (user_A) has a higher score
        user_A = await User.refreshFromDatabase(user_A);
        userBB = await User.refreshFromDatabase(userBB);
        assert(user_A.computedScore > user_APreviousScore);
        assert(userBB.computedScore < userBBPreviousScore);

        user_APreviousScore = user_A.computedScore;
        userBBPreviousScore = userBB.computedScore;

        //
        // PART THREE
        //

        // Now, let's flip around the outcome of battle A
        // Cast 2 votes for participantAB - now this makes participantAB the winner
        await BattleParticipant.castVoteFor(battleA, participantAB.id, user, 0, 0);
        await BattleParticipant.castVoteFor(battleA, participantAB.id, user, 0, 0);

        // Make sure that user_A has a lower score than before - they've now lost battle A
        user_A = await User.refreshFromDatabase(user_A);
        assert(user_A.computedScore < user_APreviousScore);
      });
      it(`should change a user's score after forfeiting a battle when an old battle's outcome changes`, async () => {
        //
        // PART ONE
        //

        // Create battle A
        let user_A = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: '_A',
              handle: '_A',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let user_APreviousScore = user_A.computedScore;
        let userAB = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'AB',
              handle: 'AB',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let userABPreviousScore = userAB.computedScore;
        const participantAA = await BattleParticipant.create(user_A.id);
        const participantAB = await BattleParticipant.create(userAB.id);
        let battleA = await Battle.create([participantAA, participantAB], 'PUBLIC');

        // Officially start battle A
        await Battle.startBattle(battleA.id);
        battleA = await Battle.refreshFromDatabase(battleA);
        user_A = await User.refreshFromDatabase(user_A);
        userAB = await User.refreshFromDatabase(userAB);

        // Place a vote in battle A, making battle A's winner participantAA
        await BattleParticipant.castVoteFor(battleA, participantAA.id, user, 0, 0);

        // Make sure that battle A's winning user (user_A) has a higher score
        user_A = await User.refreshFromDatabase(user_A);
        userAB = await User.refreshFromDatabase(userAB);
        assert(user_A.computedScore > user_APreviousScore);
        assert(userAB.computedScore < userABPreviousScore);

        user_APreviousScore = user_A.computedScore;
        userABPreviousScore = userAB.computedScore;

        //
        // PART TWO
        //

        // Create battle B
        // NOTE: user_A is ALSO part of battle B!
        let userBB = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'BB',
              handle: 'BB',
              phoneNumber: '555-555-5555',
              computedScore: 16000,
            },
          }),
        );
        let userBBPreviousScore = userBB.computedScore;
        const participantBA = await BattleParticipant.create(user_A.id);
        const participantBB = await BattleParticipant.create(userBB.id);
        let battleB = await Battle.create([participantBA, participantBB], 'PUBLIC');

        // Make `participantBA` leave the battle prior to it being started - this should
        // count as a forfeit
        await Battle.makeBattlesInactive([[battleB.id, participantBA.id]]);

        // Make sure that battle B's forfeit resulted in userBB having a higher score
        user_A = await User.refreshFromDatabase(user_A);
        userBB = await User.refreshFromDatabase(userBB);
        assert(user_A.computedScore < user_APreviousScore);
        assert(userBB.computedScore > userBBPreviousScore);

        user_APreviousScore = user_A.computedScore;
        userBBPreviousScore = userBB.computedScore;

        //
        // PART THREE
        //

        // Now, let's flip around the outcome of battle A
        // Cast 2 votes for participantAB - now this makes participantAB the winner
        await BattleParticipant.castVoteFor(battleA, participantAB.id, user, 0, 0);
        await BattleParticipant.castVoteFor(battleA, participantAB.id, user, 0, 0);

        // Make sure that user_A has a lower score than before - they've now lost battle A
        user_A = await User.refreshFromDatabase(user_A);
        assert(user_A.computedScore < user_APreviousScore);
      });
      it(`should only recompute battles at and after the battle that was voted on`, async () => {
        //
        // PART ONE
        //

        let user_A = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: '_A',
              handle: '_A',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        let user_APreviousScore = user_A.computedScore;

        // Create 5 battles that all are before the main battle
        // These exist so that this test can make sure that the scores of these battles are NOT ever
        // recalculated
        const battlesPre: Array<BattleWithParticipants> = [];
        for (let index = 0; index < 5; index += 1) {
          let userIndexB = await User.refreshFromDatabase(
            await prisma.user.create({
              data: {
                clerkId: `${index}B`,
                handle: `${index}B`,
                phoneNumber: '555-555-5555',
                computedScore: 5000,
              },
            }),
          );
          const participantIndexA = await BattleParticipant.create(user_A.id);
          const participantIndexB = await BattleParticipant.create(userIndexB.id);
          let battle = await Battle.create([participantIndexA, participantIndexB], 'PUBLIC');

          // Officially start battle A
          await Battle.startBattle(battle.id);
          battle = await Battle.refreshFromDatabase(battle);
          user_A = await User.refreshFromDatabase(user_A);
          userIndexB = await User.refreshFromDatabase(userIndexB);

          // Place a vote in battle A, making this battle's winner participantIndexA
          await BattleParticipant.castVoteFor(battle, participantIndexA.id, user, 0, 0);
          battlesPre.push(battle);
        }

        // Now, create a main battle to operate on
        let userMainB = await User.refreshFromDatabase(
          await prisma.user.create({
            data: {
              clerkId: 'AB',
              handle: 'AB',
              phoneNumber: '555-555-5555',
              computedScore: 5000,
            },
          }),
        );
        const participantMainA = await BattleParticipant.create(user_A.id);
        const participantMainB = await BattleParticipant.create(userMainB.id);
        let battleMain = await Battle.create([participantMainA, participantMainB], 'PUBLIC');

        // Officially start battle A
        await Battle.startBattle(battleMain.id);
        battleMain = await Battle.refreshFromDatabase(battleMain);
        user_A = await User.refreshFromDatabase(user_A);
        userMainB = await User.refreshFromDatabase(userMainB);

        // Place a vote in battle main, making battle main's winner participantMainA
        await BattleParticipant.castVoteFor(battleMain, participantMainA.id, user, 0, 0);

        //
        // PART TWO
        //

        // Now, update the 3rd battle that was made before the "main battle" to have incorrect
        // cached user score data
        await prisma.battleParticipant.update({
          where: {
            id: battlesPre[3].participants[0].id,
          },
          data: {
            userComputedScoreAtBattleCreatedAt: 9999_1234,
          },
        });

        // Place two votes in battle main, making battle main's winner now participantMainB
        await BattleParticipant.castVoteFor(battleMain, participantMainB.id, user, 0, 0, 2);

        // After doing this, the old cached user data should NOT have been updated
        //
        // Rationale: The way the system should work, it should only ever recompute data that it has
        // to recompute by default. Recomputing the data for battles before the battles it has to is
        // a waste of processing time and since the vote tabulating algorithm scales so poorly, this
        // is critical for performance.
        const result = await BattleParticipant.getById(battlesPre[3].participants[0].id);
        assert.strictEqual(result?.userComputedScoreAtBattleCreatedAt, 9999_1234);
      });
      it(
        `should change a user's score in an old battle, and have that change in score cascade and effect another user's score`,
      );
    });

    it('should be able to cast a single vote for a user', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 1 vote in the battle
      await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 1);

      // Make sure that only one vote was cast
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 1);
    });
    it('should be able to cast 5 votes for a user', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 5 votes in the battle
      await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 5);

      // Make sure that 5 votes were cast
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 5);
    });
    it('should not let a user cast more than 20 votes at once', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 30 votes in the battle
      await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 30);

      // Make sure that there are only 20 votes that were cast for the battle
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 20);
    });
    it('should not let a user cast more than 20 votes in one battle over two button presses', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 30 votes in the battle
      await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 15);
      await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 15);

      // Make sure that there are only 20 votes that were cast for the battle
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 20);
    });
    it('should not let a user cast a vote for a battle that they themselves participated in', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 1 vote in the battle AS FIRSTUSER!
      const result = await BattleParticipant.castVoteFor(
        battle,
        participantA.id,
        firstUser, // <=== THIS IS THE IMPORTANT FIELD
        0,
        0,
        1,
      );

      // Make sure that the operation failed
      assert.equal(result, null);

      // Make sure that only no votes were cast
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, null);
    });
    it('should not let a user cast votes on a private battle', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create(
        [participantA, participantB],
        'PRIVATE', // <== THIS IS THE IMPORTANT FIELD
      );

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Attempt to cast a vote in the battle
      const result = await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 1);

      // Make sure that the operation failed
      assert.equal(result, null);

      // Make sure that only no votes were cast
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, null);
    });
    it('should not let a user cast votes on a forfeited battle', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Forfeit the battle
      await Battle.makeBattlesInactive([[battle.id, participantA.id]]);
      battle = await Battle.refreshFromDatabase(battle);

      // Attempt to cast a vote in the battle
      const result = await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 1);

      // Make sure that the operation failed
      assert.equal(result, null);

      // Make sure that only no votes were cast
      const totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, null);
    });
    it('should change the `amount` of the first vote to the most recently voted for participant if a participant is voted for over 20 times', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 10 votes for partiaipant A, and 5 for participant b
      let firstVote = await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 10);
      await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0, 5);

      // Make sure that there are 15 votes that were cast for the battle
      let totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 15);

      // Now, cast 10 votes for participant B
      await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0, 10);

      // And make sure that there are only 20 votes at max in the system
      totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 20);

      // Also, make sure that the first vote now has an amount of 5
      assert(firstVote);
      const updatedFirstVote = await prisma.battleParticipantVote.findUniqueOrThrow({
        where: { id: firstVote.id },
      });
      assert.equal(updatedFirstVote.amount, 5);
    });
    it('should delete the first vote if a participant is voted for over 20 times', async () => {
      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create a new battle
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      let battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Officially start the battle
      await Battle.startBattle(battle.id);
      battle = await Battle.refreshFromDatabase(battle);

      // Cast 1 then 9 votes for partiaipant A, and 5 for participant b
      const firstVote = await BattleParticipant.castVoteFor(battle, participantA.id, user, 0, 0, 1);
      const secondVote = await BattleParticipant.castVoteFor(
        battle,
        participantA.id,
        user,
        0,
        0,
        9,
      );
      await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0, 5);

      // Make sure that there are 15 votes that were cast for the battle
      let totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 15);

      // Now, cast 10 votes for participant B
      await BattleParticipant.castVoteFor(battle, participantB.id, user, 0, 0, 10);

      // And make sure that there are only 20 votes at max in the system
      totalVotes = await prisma.battleParticipantVote.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          battleParticipant: {
            battleId: battle.id,
          },
        },
      });
      assert.equal(totalVotes._sum.amount, 20);

      // Make sure that the first vote was deleted
      assert(firstVote);
      const updatedFirstVote = await prisma.battleParticipantVote.findUnique({
        where: { id: firstVote.id },
      });
      assert.equal(updatedFirstVote, null);

      // And the second vote was reassigned to be 5
      assert(secondVote);
      const updatedSecondVote = await prisma.battleParticipantVote.findUniqueOrThrow({
        where: { id: secondVote.id },
      });
      assert.equal(updatedSecondVote.amount, 5);
    });
  });

  describe('User Battle Commenting', () => {
    let secondUser: PrismaUser;
    let battle: BattleWithParticipants;
    let oldestComment: BattleComment;

    beforeEach(async () => {
      // Create a secondary fake user account
      secondUser = await prisma.user.create({
        data: {
          clerkId: 'TWO',
          handle: 'TWO',
          phoneNumber: '555-555-5555',
        },
      });

      // Create a battle
      const participantA = await BattleParticipant.create(user.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      battle = await Battle.create([participantA, participantB], 'PUBLIC');

      // Create a few comments on the battle
      oldestComment = await BattleComment.createForBattle(battle, user.id, `Comment 0`, 0);
      for (let i = 1; i < 5; i += 1) {
        await BattleComment.createForBattle(battle, user.id, `Comment ${i}`, 0);
      }
    });

    it('should get the first page of the list all comments for a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const response = await request(app).get(`/v1/battles/${battle.id}/comments`).expect(200);

      // Make sure that 5 comments was returned
      assert.strictEqual(response.body.results.length, 5);

      // Make sure that there is no further data
      assert.strictEqual(response.body.next, false);

      // Make sure the last (ie, oldest) comment is `oldestComment`
      assert.strictEqual(response.body.results.at(-1).id, oldestComment.id);
    });
    it('should get the second and third page of the list of comments for a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Get page two, with a page size of 2
      // This should return item with index 2 and 3
      const pageTwoResponse = await request(app)
        .get(`/v1/battles/${battle.id}/comments?page=2&pageSize=2`)
        .expect(200);

      // Make sure that 2 comments was returned
      assert.strictEqual(pageTwoResponse.body.results.length, 2);

      // Make sure that there is indicated to be more data
      assert.strictEqual(pageTwoResponse.body.next, true);

      // Get page three, with a page size of 2
      // This should return item with index 4
      const pageThreeResponse = await request(app)
        .get(`/v1/battles/${battle.id}/comments?page=3&pageSize=2`)
        .expect(200);

      // Make sure that 1 comment was returned
      assert.strictEqual(pageThreeResponse.body.results.length, 1);

      // Make sure that there is indicated to be NO more data - we're on the final page
      assert.strictEqual(pageThreeResponse.body.next, false);

      // Make sure the one comment that was returned was the oldest comment
      assert.strictEqual(pageThreeResponse.body.results[0].id, oldestComment.id);
    });
    it('should change the computedHasBeenVotedOnByUserMe flag depending on who requests the comment list', async () => {
      // Make sure a vote has been cast for `oldestComment`
      await BattleComment.voteForCommentAsUser(oldestComment, user.id)!;

      // Request comments with the same user that created them
      let app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      let response = await request(app).get(`/v1/battles/${battle.id}/comments`).expect(200);

      // Make sure that the oldest comment item in the list has the flag set
      assert.strictEqual(response.body.results.at(-1).computedHasBeenVotedOnByUserMe, true);

      // Request comments with a different user than the user that created them
      app = createApp({ requireAuth: false, authedUserId: secondUser.clerkId! });
      response = await request(app).get(`/v1/battles/${battle.id}/comments`).expect(200);

      // Make sure that the oldest comment item in the list has the flag unset
      assert.strictEqual(response.body.results.at(-1).computedHasBeenVotedOnByUserMe, false);
    });
    it('should be able to create a comment associated with a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const response = await request(app)
        .post(`/v1/battles/${battle.id}/comments`)
        .send({ text: 'New comment text', commentedAtOffsetMilliseconds: 100 })
        .expect(201);

      // Make sure that the comment has the correct metadata from the body
      assert.strictEqual(response.body.text, 'New comment text');

      // Also make sure that the comment was created in the database and that it has the right
      // metadata associated
      const battleComment = await prisma.battleComment.findFirstOrThrow({
        where: { id: response.body.id },
      });
      assert.strictEqual(battleComment.text, 'New comment text');
      assert.strictEqual(battleComment.commentedAtOffsetMilliseconds, 100);
    });
    it(`should NOT be able to create a comment with a private battle if the user wasn't a participant in the battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Create a private battle that does NOT contain `user`
      const firstUser = await prisma.user.create({
        data: {
          clerkId: 'ONE',
          handle: 'ONE',
          phoneNumber: '555-555-5555',
        },
      });
      const participantA = await BattleParticipant.create(firstUser.id);
      const participantB = await BattleParticipant.create(secondUser.id);
      const privateBattle = await Battle.create([participantA, participantB], 'PRIVATE');

      // Make sure that creating a comment in this case fails
      await request(app)
        .post(`/v1/battles/${privateBattle.id}/comments`)
        .send({ text: 'New comment text', commentedAtOffsetMilliseconds: 100 })
        .expect(400);
    });
    it('should be able to vote for a comment associated with a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Ensure the initial vote total for a test comment starts at 0
      assert.strictEqual(oldestComment.computedVoteTotal, 0);

      // Cast a vote for this comment
      const response = await request(app)
        .post(`/v1/battles/${battle.id}/comments/${oldestComment.id}/vote`)
        .expect(200);

      // Ensure the vote total is now 1 for this comment
      assert.strictEqual(response.body.computedVoteTotal, 1);

      // Also ensure that now the flag indicating the current user voted on the comment is set
      assert.strictEqual(response.body.computedHasBeenVotedOnByUserMe, true);
    });
    it('should be able to unvote a comment associated with a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Make sure a vote has been cast for `oldestComment`
      oldestComment = (await BattleComment.voteForCommentAsUser(oldestComment, user.id))!;
      // Ensure the initial vote total for a test comment starts at 1
      assert.strictEqual(oldestComment.computedVoteTotal, 1);

      // Now, unvote the comment
      const response = await request(app)
        .post(`/v1/battles/${battle.id}/comments/${oldestComment.id}/unvote`)
        .expect(200);

      // Ensure the vote total is now 0 for this comment
      assert.strictEqual(response.body.computedVoteTotal, 0);

      // Also ensure that now the flag indicating the current user voted on the comment is unset
      assert.strictEqual(response.body.computedHasBeenVotedOnByUserMe, false);
    });
    it('should not be able to vote twice for the same comment on a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // First, vote for the comment
      await request(app)
        .post(`/v1/battles/${battle.id}/comments/${oldestComment.id}/vote`)
        .expect(200);

      // Now, vote for the comment AGAIN
      await request(app)
        .post(`/v1/battles/${battle.id}/comments/${oldestComment.id}/vote`)
        .expect(400);
      // ^ This should fail
    });
    it('should not be able to unvote twice the same comment on a battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      // Make sure a vote has been cast for `oldestComment`
      oldestComment = (await BattleComment.voteForCommentAsUser(oldestComment, user.id))!;

      // Now, unvote the comment
      await request(app)
        .post(`/v1/battles/${battle.id}/comments/${oldestComment.id}/unvote`)
        .expect(200);

      // Now, unvote the comment AGAIN
      await request(app)
        .post(`/v1/battles/${battle.id}/comments/${oldestComment.id}/unvote`)
        .expect(400);
      // ^ This should fail
    });
    it('should be able to edit the text associated with a comment', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      const response = await request(app)
        .put(`/v1/battles/${battle.id}/comments/${oldestComment.id}`)
        .send({ text: 'UPDATED comment text' })
        .expect(200);

      // Make sure that the comment has the correct metadata from the body
      assert.strictEqual(response.body.text, 'UPDATED comment text');

      // Also make sure that the comment was updated in the database and that it has the right
      // metadata associated
      oldestComment = await BattleComment.refreshFromDatabase(oldestComment);
      assert.strictEqual(oldestComment.text, 'UPDATED comment text');
    });
    it('should be able to delete a comment', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });

      await request(app)
        .delete(`/v1/battles/${battle.id}/comments/${oldestComment.id}`)
        .expect(204);

      // Also make sure that the comment was deleted from the database
      const result = await BattleComment.getById(oldestComment.id);
      assert.strictEqual(result, null);
    });
  });

  describe('User.forceRecomputeCloutScores', () => {
    it('should recompute a bunch of corrupted data to produce something meaningful', async function (this: FixMe) {
      // this.timeout(60_000 * 5);

      let firstUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'ONE',
            handle: 'ONE',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );
      let secondUser = await User.refreshFromDatabase(
        await prisma.user.create({
          data: {
            clerkId: 'TWO',
            handle: 'TWO',
            phoneNumber: '555-555-5555',
            computedScore: 5000,
          },
        }),
      );

      // Create battle A
      const participantAA = await BattleParticipant.create(firstUser.id);
      const participantAB = await BattleParticipant.create(secondUser.id);
      let battleA = await Battle.create([participantAA, participantAB], 'PUBLIC');
      await prisma.battle.update({ where: { id: battleA.id }, data: { startedAt: new Date() } });

      // Create battle B
      const participantBA = await BattleParticipant.create(firstUser.id);
      const participantBB = await BattleParticipant.create(secondUser.id);
      let battleB = await Battle.create([participantBA, participantBB], 'PUBLIC');
      await prisma.battle.update({ where: { id: battleB.id }, data: { startedAt: new Date() } });

      // Create battle C
      const participantCA = await BattleParticipant.create(firstUser.id);
      const participantCB = await BattleParticipant.create(secondUser.id);
      let battleC = await Battle.create([participantCA, participantCB], 'PUBLIC');
      await prisma.battle.update({ where: { id: battleC.id }, data: { startedAt: new Date() } });

      // Create battle D
      const participantDA = await BattleParticipant.create(firstUser.id);
      const participantDB = await BattleParticipant.create(secondUser.id);
      let battleD = await Battle.create([participantDA, participantDB], 'PUBLIC');
      await prisma.battle.update({ where: { id: battleD.id }, data: { startedAt: new Date() } });

      // Create battle E
      const participantEA = await BattleParticipant.create(firstUser.id);
      const participantEB = await BattleParticipant.create(secondUser.id);
      let battleE = await Battle.create([participantEA, participantEB], 'PUBLIC');
      await prisma.battle.update({ where: { id: battleD.id }, data: { startedAt: new Date() } });

      // Now, with all five battles created, assign votes to them
      //
      // NOTE: this is NOT being done with BattleParticipant.castVoteFor, because
      // I purposely want to avoid all the scoring logic being run automatically afterwards

      // Cast a vote for participantAA:
      await prisma.battleParticipantVote.create({
        data: {
          startedCastingAt: new Date(),
          startedCastingAtVideoStreamOffsetMilliseconds: 0,
          endedCastingAt: new Date(),
          endedCastingAtVideoStreamOffsetMilliseconds: 0,
          castByUserId: user.id,
          amount: 1,
          battleParticipantId: participantAA.id,
        },
      });

      // Cast a vote for participantBB:
      await prisma.battleParticipantVote.create({
        data: {
          startedCastingAt: new Date(),
          startedCastingAtVideoStreamOffsetMilliseconds: 0,
          endedCastingAt: new Date(),
          endedCastingAtVideoStreamOffsetMilliseconds: 0,
          castByUserId: user.id,
          amount: 1,
          battleParticipantId: participantBB.id,
        },
      });

      // Cast two votes for participantCA:
      await prisma.battleParticipantVote.create({
        data: {
          startedCastingAt: new Date(),
          startedCastingAtVideoStreamOffsetMilliseconds: 0,
          endedCastingAt: new Date(),
          endedCastingAtVideoStreamOffsetMilliseconds: 0,
          castByUserId: user.id,
          amount: 1,
          battleParticipantId: participantCA.id,
        },
      });
      await prisma.battleParticipantVote.create({
        data: {
          startedCastingAt: new Date(),
          startedCastingAtVideoStreamOffsetMilliseconds: 0,
          endedCastingAt: new Date(),
          endedCastingAtVideoStreamOffsetMilliseconds: 0,
          castByUserId: user.id,
          amount: 1,
          battleParticipantId: participantCA.id,
        },
      });

      // Make participantDA forfeit the battle:
      await prisma.battleParticipant.updateMany({
        where: {
          id: participantDA.id,
        },
        data: {
          forfeitedAt: new Date(),
        },
      });

      // for (let i = 0; i < 1000; i += 1) {
      //   i % 50 === 0 && console.log(i);
      //   const participantA = await BattleParticipant.create(firstUser.id);
      //   const participantB = await BattleParticipant.create(secondUser.id);
      //   let battle = await Battle.create([participantA, participantB], 'PUBLIC');
      //   await prisma.battle.update({ where: { id: battle.id }, data: { startedAt: new Date() }});

      //   await prisma.battleParticipantVote.create({
      //     data: {
      //       startedCastingAt: new Date(),
      //       startedCastingAtVideoStreamOffsetMilliseconds: 0,
      //       endedCastingAt: new Date(),
      //       endedCastingAtVideoStreamOffsetMilliseconds: 0,
      //       amount: 1,
      //       battleParticipantId: participantA.id,
      //     },
      //   });
      // }

      // Run the force recompute function:
      console.time();
      const finalScores = await User.forceRecomputeCloutScores();
      console.timeEnd();

      // Make sure that battles A, B, and C have `computedHasReceivedVotes` set to be true on them
      battleA = await Battle.refreshFromDatabase(battleA);
      assert.equal(battleA.computedHasReceivedVotes, true);
      assert.equal(battleA.computedHasBeenForfeited, false);

      battleB = await Battle.refreshFromDatabase(battleB);
      assert.equal(battleB.computedHasReceivedVotes, true);
      assert.equal(battleB.computedHasBeenForfeited, false);

      battleC = await Battle.refreshFromDatabase(battleC);
      assert.equal(battleC.computedHasReceivedVotes, true);
      assert.equal(battleC.computedHasBeenForfeited, false);

      // Battle D should have been forfeited
      battleD = await Battle.refreshFromDatabase(battleD);
      assert.equal(battleD.computedHasReceivedVotes, false);
      assert.equal(battleD.computedHasBeenForfeited, true);

      // And battle E it should still be false, since no votes were cast on this battle
      battleE = await Battle.refreshFromDatabase(battleE);
      assert.equal(battleE.computedHasReceivedVotes, false);
      assert.equal(battleE.computedHasBeenForfeited, false);

      console.log(finalScores);
      // TODO: how should I assert to make sure it worked?!?
    });
  });
});
