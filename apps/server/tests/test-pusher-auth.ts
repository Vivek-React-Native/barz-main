import request from 'supertest';
import { User as PrismaUser } from '@prisma/client';

import createApp from '../src/index.ts';
import prisma from '../src/lib/prisma.ts';
import BattleParticipant from '../src/lib/battle-participant.ts';
import Battle, { BattleWithParticipants } from '../src/lib/battle.ts';

describe('Pusher Auth', () => {
  let user: PrismaUser,
    userA: PrismaUser,
    userB: PrismaUser,
    publicBattleParticipantA: BattleParticipant,
    publicBattleParticipantB: BattleParticipant,
    publicBattle: BattleWithParticipants,
    privateBattleParticipantA: BattleParticipant,
    privateBattleParticipantB: BattleParticipant,
    privateBattle: BattleWithParticipants;
  beforeEach(async () => {
    // Create a fake user account unassociated with a battle
    user = await prisma.user.create({ data: { clerkId: 'user_123' } });

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
    publicBattleParticipantA = await BattleParticipant.create(userA.id);
    publicBattleParticipantB = await BattleParticipant.create(userB.id);
    publicBattle = await Battle.create(
      [publicBattleParticipantA, publicBattleParticipantB],
      'PUBLIC',
    );

    privateBattleParticipantA = await BattleParticipant.create(userA.id);
    privateBattleParticipantB = await BattleParticipant.create(userB.id);
    privateBattle = await Battle.create(
      [privateBattleParticipantA, privateBattleParticipantB],
      'PRIVATE',
    );
  });

  describe('Public Battles', () => {
    it('should let a user that is part of a public battle subscribe to that battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${publicBattle.id}` })
        .expect(200);
    });
    it('should NOT a user that is NOT part of a public battle subscribe to that battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${publicBattle.id}` })
        .expect(403);
    });

    it(`should let a user that is part of a public battle subscribe to that battle's results (used on home feed)`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${publicBattle.id}-results` })
        .expect(200);
    });
    it(`should let a user that is NOT part of a public battle subscribe to that battle's results (used on home feed for voting)`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${publicBattle.id}-results` })
        .expect(200);
    });
    it(`should let a user that is NOT part of a public battle subscribe to that battle's comments (used on home feed)`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${publicBattle.id}-comments` })
        .expect(200);
    });
    it(`should let any user subscribe to votes created for any participants in a public battle (used in home feed)`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${publicBattleParticipantA.id}-votes`,
        })
        .expect(200);
    });
    it(`should let a user that is part of a public battle subscribe to that battle's comments (used on home feed)`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${publicBattle.id}-comments` })
        .expect(200);
    });
    it(`should let a user subscribe to their own public battle comment vote changes`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battle-${publicBattle.id}-user-${userA.id}-commentvotes`,
        })
        .expect(200);
    });
    it(`should NOT let a user subscribe to other user's public battle comment vote changes`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battle-${publicBattle.id}-user-${userA.id}-commentvotes`,
        })
        .expect(403);
    });

    it(`should let a user that is part of a public battle subscribe to their own participant in that battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${publicBattleParticipantA.id}`,
        })
        .expect(200);
    });
    it(`should let a user that is part of a public battle subscribe to OTHER participants in that battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${publicBattleParticipantB.id}`,
        })
        .expect(200);
    });
    it(`should NOT let a user that is NOT part of a public battle subscribe to participants in that public battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${publicBattleParticipantA.id}`,
        })
        .expect(403);
    });
  });

  describe('Private Battles', () => {
    it('should let a user that is part of a private battle subscribe to that battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${privateBattle.id}` })
        .expect(200);
    });
    it('should NOT a user that is NOT part of a private battle subscribe to that battle', async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${privateBattle.id}` })
        .expect(403);
    });

    it(`should let a user that is part of a private battle subscribe to that battle's results`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${privateBattle.id}-results` })
        .expect(200);
    });
    it(`should NOT let a user that is NOT part of a private battle subscribe to that battle's results`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${privateBattle.id}-results` })
        .expect(403);
    });
    it(`should NOT let a user that is NOT part of a private battle subscribe to that battle's comments`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${privateBattle.id}-comments` })
        .expect(403);
    });
    it(`should NOT let any user subscribe to votes created for any participants in a private battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${privateBattleParticipantA.id}-votes`,
        })
        .expect(403);
    });
    it(`should let a user that is part of a private battle subscribe to that battle's comments (used in battle player)`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({ socketId: '', channelName: `private-battle-${privateBattle.id}-comments` })
        .expect(200);
    });
    it(`should let a user subscribe to their own private battle comment vote changes`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battle-${privateBattle.id}-user-${userA.id}-commentvotes`,
        })
        .expect(200);
    });
    it(`should NOT let antother user in the battle subscribe to other user's private battle comment vote changes`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userB.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battle-${privateBattle.id}-user-${userA.id}-commentvotes`,
        })
        .expect(403);
    });

    it(`should let a user that is part of a private battle subscribe to their own participant in that battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${privateBattleParticipantA.id}`,
        })
        .expect(200);
    });
    it(`should let a user that is part of a private battle subscribe to OTHER participants in that battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: userA.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${privateBattleParticipantB.id}`,
        })
        .expect(200);
    });
    it(`should NOT let a user that is NOT part of a private battle subscribe to participants in that private battle`, async () => {
      const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
      await request(app)
        .post('/v1/pusher/auth')
        .send({
          socketId: '',
          channelName: `private-battleparticipant-${privateBattleParticipantA.id}`,
        })
        .expect(403);
    });
  });

  it('should let anyone subscribe to user updates to get up to date clout scores', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
    await request(app)
      .post('/v1/pusher/auth')
      .send({ socketId: '', channelName: `private-user-${userA.id}` })
      .expect(200);
  });

  it('should not be able to subscribe to a bogus channel name', async () => {
    const app = createApp({ requireAuth: false, authedUserId: user.clerkId! });
    await request(app)
      .post('/v1/pusher/auth')
      .send({ socketId: '', channelName: 'bogus-channel-name' })
      .expect(403);
  });
});
