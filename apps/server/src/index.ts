import express, { Request, Response } from 'express';
import 'express-async-errors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import * as Sentry from '@sentry/node';
import { Webhook } from 'svix';
import ngrok from '@ngrok/ngrok';
import { fromUnixTime, isAfter } from 'date-fns';
import { readFile } from 'fs/promises';
import { z } from 'zod';
import fetch from 'node-fetch';

import jwt from 'jsonwebtoken';

import prisma from './lib/prisma.ts';
import pusher from './lib/pusher.ts';
import Battle, { BattlePrivacyLevel } from './lib/battle.ts';
import BattleComment from './lib/battle-comment.ts';
import BattleParticipant from './lib/battle-participant.ts';
import BattleStateMachine from './lib/battle-state-machine.ts';
import { BeatsObjectStorage } from './lib/object-storage.ts';
import {
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WEBHOOK_VERIFICATION_ENABLED,
  getPublicBaseUrl,
  monkeyPatchPublicBaseUrl,
  OBJECT_STORAGE_IMPLEMENTATION,
  SENTRY_DSN,
  CLERK_PUBLIC_KEY,
  CLERK_SVIX_WEBHOOK_SECRET,
  CLERK_SVIX_VERIFICATION_ENABLED,
  DEMO_USER_PHONE_NUMBER,
  DEMO_USER_PASSWORD,
  MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID,
} from './config.ts';
import { FixMe } from './lib/fixme.ts';
import User, { UserMe, USER_INITIAL_SCORE } from './lib/user.ts';
import Spotify from './lib/spotify.ts';

import { queueEventToFormBattleWithParticipant } from './worker/battle-participant-matching-worker.ts';
import generateNameNotAlreadyInUsersTable from './lib/rap-name-generator.ts';
import Challenge from './lib/challenge.ts';
import Elo from './lib/elo.ts';

type AuthProperty = {
  authIsOptional?: boolean;
  auth: {
    userClerkId: string;
    userMe: UserMe;
  };
};
declare global {
  namespace Express {
    interface Request extends AuthProperty {}
  }
}

type CreateAppOptions =
  | { requireAuth: true; overriddenPublicKey?: string }
  | { requireAuth: false; authedUserId: string };

function createApp(options: CreateAppOptions) {
  const MockedAuthMiddleware = (req: Request, res: Response, next: () => void) => {
    if (options.requireAuth) {
      res.status(500).send({ error: 'options.requireAuth is set!' });
      return;
    }

    console.warn('WARNING: options.requireAuth not set! This should never happen in production.');

    User.getByClerkId(options.authedUserId)
      .then((userMe) => {
        if (!userMe) {
          res.status(404).send({
            error: `User with clerk id ${req.auth.userClerkId} was not found! Does this user exist?`,
          });
          return;
        }

        req.auth = {
          userClerkId: options.authedUserId,
          userMe,
        };

        next();
      })
      .catch((err) => {
        console.error('Unable to look up user details:', err);
        res.status(401).send({ error: `Unable to look up user details!` });
      });
  };

  // ref: https://clerk.com/docs/request-authentication/validate-session-tokens#putting-it-all-together
  const ClerkAuthMiddleware = (req: Request, res: Response, next: () => void) => {
    const header = req.headers.authorization;

    if (!header) {
      if (!req.authIsOptional) {
        res.status(401).send({ error: 'Authorization header not specified!' });
      } else {
        next();
      }
      return;
    }

    const headerParts = header.split(' ');
    if (headerParts.length !== 2) {
      if (!req.authIsOptional) {
        res.status(401).send({
          error: `Malformed Authorization header - expected two words, found ${headerParts.length}`,
        });
      } else {
        next();
      }
      return;
    }

    if (headerParts[0] !== 'Bearer') {
      if (!req.authIsOptional) {
        res.status(401).send({
          error: `Malformed Authorization header - expected Bearer scheme, found ${headerParts[0]}`,
        });
      } else {
        next();
      }
      return;
    }

    const token = headerParts[1];
    if (token.length === 0) {
      if (!req.authIsOptional) {
        res.status(401).send({ error: 'Malformed Authorization header - missing token!' });
      } else {
        next();
      }
      return;
    }

    const publicKey =
      options.requireAuth && options.overriddenPublicKey
        ? options.overriddenPublicKey
        : CLERK_PUBLIC_KEY;
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, publicKey) as jwt.JwtPayload;
    } catch (error) {
      console.error('Error validating token:', (error as FixMe).message);
      if (!req.authIsOptional) {
        res.status(401).json({ error: 'Malformed Authorization header - invalid token!' });
      } else {
        next();
      }
      return;
    }

    const userClerkId = decoded.sub as string;
    if (!userClerkId) {
      console.error(`Error: userId was not a string in req.auth, found '${userClerkId}'!`);
      if (!req.authIsOptional) {
        res.status(401).send({ error: `Unable to look up user details!` });
      } else {
        next();
      }
      return;
    }

    User.getByClerkId(userClerkId)
      .then((userMe) => {
        if (!userMe) {
          res.status(404).send({
            error: `User with clerk id ${userClerkId} was not found! Does this user exist?`,
          });
          return;
        }

        req.auth = { userClerkId, userMe };

        next();
      })
      .catch((err) => {
        console.error('Unable to look up user details:', err);
        if (!req.authIsOptional) {
          res.status(401).send({ error: `Unable to look up user details!` });
        } else {
          next();
        }
      });
  };

  const RequireAuthMiddleware = options.requireAuth ? ClerkAuthMiddleware : MockedAuthMiddleware;
  const pusherAuthorizeChannel = options.requireAuth
    ? pusher.authorizeChannel.bind(pusher)
    : () => ({
        auth: 'MOCK',
        channel_data: 'MOCK',
        shared_secret: 'MOCK',
      });

  const app = express();
  app.use(morgan('tiny'));

  const jsonBodyParser = bodyParser.json();
  app.use((req, res, next) => {
    if (req.path === '/v1/users/clerk-webhook') {
      next();
    } else if (
      req.path.startsWith('/v1/battles/') &&
      req.path.endsWith('/twilio-video-room-webhook')
    ) {
      next();
    } else {
      jsonBodyParser(req, res, next);
    }
  });

  // Configure sentry for error reporting in production
  if (SENTRY_DSN) {
    let environment = 'unknown';
    if (getPublicBaseUrl().includes('api-staging')) {
      environment = 'staging';
    } else if (getPublicBaseUrl().includes('api')) {
      environment = 'production';
    }

    Sentry.init({
      dsn: SENTRY_DSN,
      environment,
      integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // enable Express.js middleware tracing
        new Sentry.Integrations.Express({ app }),
        // Automatically instrument Node.js libraries and frameworks
        ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
      ],

      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 0.1,
    });

    // RequestHandler creates a separate execution context, so that all
    // transactions/spans/breadcrumbs are isolated across requests
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
  }

  app.use((req, res, next) => {
    // FIXME: It might be a better idea to try to use a prebuilt package to do CORS rather than hacking
    // in the right header here.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    // NOTE: React Native aggressively caches GETs. This causes problems sometimes with stale data being
    // shown.
    res.setHeader('Cache-Control', 'max-age=0, private, must-revalidate');
    next();
  });

  app.get('/', async (req, res) => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url) as FixMe, { encoding: 'utf8' }),
    );

    res.send({
      name: 'Barz Server',
      version: packageJson.version,
    });
  });

  app.post('/trigger-error', async (req, res) => {
    throw new Error(`Test error: ${Math.random()}`);
  });

  // When a user enters a special phone number in the app, a request is made to this endpoint to get
  // a "ticket" value that can be sent back to the client to allow the client to sign in to this
  // demo user account.
  //
  // This is required so that vendors like apple can sign in to the app to review it.
  app.post('/demo-clerk-ticket', async (req, res) => {
    if (!DEMO_USER_PHONE_NUMBER || !DEMO_USER_PASSWORD) {
      res.status(400).send({ error: 'No demo user account set!' });
      return;
    }

    // Respond with a "ticket" value that can be passed directly into the clerk sign in function
    res.status(201).send({
      strategy: 'password',
      identifier: DEMO_USER_PHONE_NUMBER,
      password: DEMO_USER_PASSWORD,
    });
  });

  // NOTE: This endpoint is for testing to make sure that twilio video works correctly
  // It should not be used for anything production related
  app.get('/twilio-token/:room/:identity', RequireAuthMiddleware, async (req, res) => {
    // from: https://www.twilio.com/docs/video/tutorials/get-started-with-twilio-video-node-express-server#create-rooms
    // create an access token
    const token = new twilio.jwt.AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      // generate a random unique identity for this participant
      { identity: req.params.identity },
    );
    // create a video grant for this specific room
    const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
      room: req.params.room,
    });
    // add the video grant
    token.addGrant(videoGrant);
    // serialize the token and return it
    res.send({ token: token.toJwt() });
  });

  // ------------------------------------------------------------------------------
  // PARTICIPANTS
  // ------------------------------------------------------------------------------

  app.get('/v1/participants', RequireAuthMiddleware, async (req, res) => {
    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const sort =
      req.query.sortField && req.query.sortDirection
        ? ([`${req.query.sortField}`, `${req.query.sortDirection}`] as [
            keyof BattleParticipant,
            'asc' | 'desc',
          ])
        : undefined;

    let filter: FixMe;
    try {
      filter = JSON.parse(decodeURIComponent(`${req.query.filters}`));
    } catch {
      filter = undefined;
    }
    console.log(req.query.filters);

    const [results, count] = await Promise.all([
      BattleParticipant.all(page, pageSize, sort, filter),
      BattleParticipant.count(filter),
    ]);

    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results,
    });
  });

  app.get('/v1/participants/:id', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const userMe = await User.getByClerkId(req.auth.userClerkId);
    if (!userMe) {
      res.status(404).send({ error: `Cannot find user with clerk id ${req.auth.userClerkId}!` });
      return;
    }

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'read',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    res.send(battleParticipant);
  });

  app.post('/v1/participants', RequireAuthMiddleware, async (req: Request, res) => {
    const { userMe } = req.auth;

    // Create a new participant unassociated with any battle
    const battleParticipant = await BattleParticipant.createWithAlgorithm(
      userMe.id,
      req.body.matchingAlgorithm === 'RANDOM' ? ('RANDOM' as const) : ('DEFAULT' as const),
    );

    // Start the battle matching process with this new participant
    await queueEventToFormBattleWithParticipant(battleParticipant);

    res.status(201).send(battleParticipant);
  });

  app.post('/v1/participants/:id/twilio-token', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (!battleParticipant.battle) {
      res.status(400).send({
        error: `Battle Participant with id ${req.params.id} does not seem to be associated with a battle! This is required to generate a twilio token.`,
      });
      return;
    }

    // from: https://www.twilio.com/docs/video/tutorials/get-started-with-twilio-video-node-express-server#create-rooms
    // create an access token
    const token = new twilio.jwt.AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      // generate a random unique identity for this participant
      { identity: battleParticipant.id },
    );
    // create a video grant for this specific room
    const videoGrant = new twilio.jwt.AccessToken.VideoGrant({
      room: battleParticipant.battle.twilioRoomName,
    });
    // add the video grant
    token.addGrant(videoGrant);
    // serialize the token and return it
    res.send({ token: token.toJwt() });
  });

  app.put('/v1/participants/:id/privacy', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (!battleParticipant.battleId) {
      res.status(400).send({
        error: `Battle Participant with id ${req.params.id} is not associated with a battle, so cannot be marked as ready!`,
      });
      return;
    }

    const battleStartedViaChallenge =
      (await prisma.challenge.findFirst({
        where: {
          battleId: battleParticipant.battleId,
        },
      })) !== null;
    if (!battleStartedViaChallenge) {
      res.status(400).send({
        error: `Battle Participant with id ${req.params.id} is associated wit battle ${battleParticipant.battleId}, which was NOT started via a challenge! Non challenge battles currently are always PUBLIC.`,
      });
      return;
    }

    const requestedBattlePrivacyLevel: BattlePrivacyLevel = req.body.requestedBattlePrivacyLevel;
    if (requestedBattlePrivacyLevel !== 'PUBLIC' && requestedBattlePrivacyLevel !== 'PRIVATE') {
      res.status(400).send({
        error: `The 'requestedBattlePrivacyLevel' key in the body is not PUBLIC or PRIVATE! ${JSON.stringify(
          requestedBattlePrivacyLevel,
        )} was found instead.`,
      });
      return;
    }

    await BattleParticipant.setRequestedBattlePrivacyLevel(
      battleParticipant,
      requestedBattlePrivacyLevel,
    );

    res.status(204).end();
  });

  app.put('/v1/participants/:id/ready', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (!battleParticipant.battleId) {
      res.status(400).send({
        error: `Battle Participant with id ${req.params.id} is not associated with a battle, so cannot be marked as ready!`,
      });
      return;
    }

    await BattleParticipant.markParticipantAsReady(battleParticipant);

    res.status(204).end();
  });

  app.put('/v1/participants/:id/twilio-track-ids', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (typeof req.body.twilioAudioTrackId !== 'string') {
      res.status(400).send({
        error: `The 'twilioAudioTrackId' key in the body is not a string! ${JSON.stringify(
          req.body.twilioAudioTrackId,
        )} was found instead.`,
      });
      return;
    }
    if (typeof req.body.twilioVideoTrackId !== 'string') {
      res.status(400).send({
        error: `The 'twilioVideoTrackId' key in the body is not a string! ${JSON.stringify(
          req.body.twilioVideoTrackId,
        )} was found instead.`,
      });
      return;
    }
    if (typeof req.body.twilioDataTrackId !== 'string') {
      res.status(400).send({
        error: `The 'twilioDataTrackId' key in the body is not a string! ${JSON.stringify(
          req.body.twilioDataTrackId,
        )} was found instead.`,
      });
      return;
    }

    await BattleParticipant.storeTwilioTrackIds(
      battleParticipant,
      req.body.twilioAudioTrackId,
      req.body.twilioVideoTrackId,
      req.body.twilioDataTrackId,
    );

    res.status(204).end();
  });

  app.put('/v1/participants/:id/checkin', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (typeof req.body.currentState !== 'undefined' && typeof req.body.currentState !== 'string') {
      res.status(400).send({
        error: `The 'currentState' key in the body is set, and it is not a string! ${JSON.stringify(
          req.body.currentState,
        )} was found instead.`,
      });
      return;
    }

    await BattleParticipant.performCheckin(
      battleParticipant,
      req.body.videoStreamOffsetMilliseconds || null,
      req.body.currentState,
      req.body.currentContext,
    );

    res.status(204).end();
  });

  app.put('/v1/participants/:id/leave', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (battleParticipant.battleId) {
      await Battle.makeBattlesInactive(
        [[battleParticipant.battleId, battleParticipant.id]],
        req.query.reason ? `${req.query.reason}` : 'PARTICIPANT_LEFT_BATTLE',
      );
    } else {
      // If the participant is NOT associated with a battle, then just deactivate the participnant
      await BattleParticipant.markInactive([battleParticipant.id]);
    }

    res.status(204).end();
  });

  app.put('/v1/participants/:id/app-state', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    if (typeof req.body.appState !== 'string') {
      res.status(400).send({
        error: `The 'appSatte' key in the body is not a string! ${JSON.stringify(
          req.body.appState,
        )} was found instead.`,
      });
      return;
    }

    await BattleParticipant.updateAppState(battleParticipant, req.body.appState);

    res.status(204).end();
  });

  app.post('/v1/participants/:id/state-machine-events', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battleParticipant = await BattleParticipant.getByIdInContextOfUserMe(
      req.params.id,
      userMe,
      'write',
    );
    if (!battleParticipant) {
      res.status(404).send({ error: `Battle Participant with id ${req.params.id} not found!` });
      return;
    }

    const body = req.body || {};

    if (battleParticipant.battleId === null) {
      res.status(400).send({
        error: `Battle participant ${battleParticipant.id} does not have a battle associated! This is required to record a state machine event.`,
      });
      return;
    }

    if (typeof body.uuid !== 'string') {
      res.status(400).send({
        error: `The 'uuid' key in the body is not a string! ${JSON.stringify(
          body.uuid,
        )} was found instead.`,
      });
      return;
    }

    if (typeof body.payload === 'undefined') {
      res
        .status(400)
        .send({ error: `The 'payload' key in the body is not defined! This is required.` });
      return;
    }

    const stateMachineEvent = await BattleParticipant.recordStateMachineEvent(
      battleParticipant,
      body.uuid,
      body.payload,
    );

    res.send(stateMachineEvent);
  });

  // ------------------------------------------------------------------------------
  // BATTLES
  // ------------------------------------------------------------------------------

  // app.get('/v1/battles', RequireAuthMiddleware, async (req, res) => {
  app.get('/v1/battles', async (req, res) => {
    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const sort =
      req.query.sortField && req.query.sortDirection
        ? ([`${req.query.sortField}`, `${req.query.sortDirection}`] as [
            keyof Battle,
            'asc' | 'desc',
          ])
        : undefined;

    let filter: FixMe;
    try {
      filter = JSON.parse(decodeURIComponent(`${req.query.filters}`));
    } catch {
      filter = undefined;
    }

    const [results, count] = await Promise.all([
      Battle.all(page, pageSize, sort, filter),
      Battle.count(filter),
    ]);

    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results,
    });
  });

  app.get('/v1/battles/home', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;
    const lastBattleId = req.query.lastBattleId ? `${req.query.lastBattleId}` : null;

    const feed = `${req.query.feed || 'FOLLOWING'}`;
    if (feed !== 'TRENDING' && feed !== 'FOLLOWING') {
      res
        .status(400)
        .send({ error: `Unknown feed ${feed}! Please pass either FOLLOWING or TRENDING.` });
      return;
    }

    const data = await Battle.generateHomeFeedStartingAtBattle(
      lastBattleId,
      userMe.id,
      feed as 'TRENDING' | 'FOLLOWING',
    );
    if (!data) {
      res
        .status(404)
        .send({ error: `Unable to generate home feed starting at battle ${lastBattleId}` });
      return;
    }

    const nextLastBattle = data.length > 0 ? data.at(-1) : null;
    const nextLastBattleId = nextLastBattle ? nextLastBattle.battleId : null;

    res.send({
      next: nextLastBattleId
        ? `${getPublicBaseUrl()}/v1/battles/home?lastBattleId=${nextLastBattleId}`
        : null,
      nextLastBattleId,
      results: data,
    });
  });

  // app.get('/v1/battles/:id', RequireAuthMiddleware, async (req, res) => {
  app.get('/v1/battles/:id', async (req, res) => {
    const result = await Battle.getById(req.params.id);
    if (!result) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }
    res.send(result);
  });

  app.put('/v1/battles/:id/view', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    await User.setLastViewedBattle(
      userMe.id,
      req.params.id,
      req.body.timeSpentWatchingBattleInMilliseconds ?? null,
    );

    res.status(204).end();
  });

  // app.get('/v1/battles/:id/state-machine-definition', RequireAuthMiddleware, async (req, res) => {
  app.get('/v1/battles/:id/state-machine-definition', async (req, res) => {
    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    const machine = BattleStateMachine.create(battle);
    res.send(machine.config);
  });

  // app.get('/v1/battles/:id/beat', RequireAuthMiddleware, async (req, res) => {
  app.get('/v1/battles/:id/beat', async (req, res) => {
    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    const beat = await prisma.battleBeat.findUnique({
      where: {
        id: battle.beatId,
      },
      select: {
        id: true,
        beatKey: true,
      },
    });
    if (!beat) {
      res.status(404).send({
        error: `Beat ${battle.beatId} that (associated with battle ${battle.id}) not found!`,
      });
      return;
    }

    const beatUrl = await BeatsObjectStorage.getSignedUrl(beat.beatKey);

    res.send({ ...beat, beatUrl });
  });

  app.get('/v1/battles/:id/projected-outcome', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getByIdInContextOfUserMe(req.params.id, userMe, 'read');
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    const participant = battle.participants.find((p) => p.userId === userMe.id);
    if (!participant) {
      res.status(400).send({
        error: `Battle with id ${req.params.id} doesn't have a participant created by the authed user!`,
      });
      return;
    }
    if (typeof participant.userComputedScoreAtBattleCreatedAt !== 'number') {
      res.status(400).send({
        error: `Battle with id ${req.params.id} participant ${participant.id}'s userComputedScoreAtBattleCreatedAt is null!`,
      });
      return;
    }

    const otherParticipant = battle.participants.find((p) => p.id !== participant.id);
    if (!otherParticipant) {
      res.status(400).send({
        error: `Battle with id ${req.params.id} doesn't have another participant other than the one the authed user created (${participant.id})!`,
      });
      return;
    }
    if (typeof otherParticipant.userComputedScoreAtBattleCreatedAt !== 'number') {
      res.status(400).send({
        error: `Battle with id ${req.params.id} participant ${otherParticipant.id}'s userComputedScoreAtBattleCreatedAt is null!`,
      });
      return;
    }

    const participantStartScore = participant.userComputedScoreAtBattleCreatedAt;
    const otherParticipantStartScore = otherParticipant.userComputedScoreAtBattleCreatedAt;

    const [participantWinScore] = Elo.executeMatch(
      participantStartScore,
      otherParticipantStartScore,
      1,
    );
    const [participantLossScore] = Elo.executeMatch(
      participantStartScore,
      otherParticipantStartScore,
      0,
    );
    const [participantTieScore] = Elo.executeMatch(
      participantStartScore,
      otherParticipantStartScore,
      0.5,
    );

    res.send({
      startingScore: participantStartScore,
      projectedScores: {
        win: participantWinScore,
        loss: participantLossScore,
        tie: participantTieScore,
      },
    });
  });

  app.post('/v1/battles/:id/vote', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    if (battle.computedPrivacyLevel !== 'PUBLIC') {
      res
        .status(400)
        .send({ error: `Battle with id ${req.params.id} is not public and cannot be voted on!` });
      return;
    }

    if (battle.computedHasBeenForfeited) {
      res
        .status(400)
        .send({ error: `Battle with id ${req.params.id} was forfeited and cannot be voted on!` });
      return;
    }

    const participantId: BattleParticipant['id'] = req.body?.participantId;
    if (typeof participantId !== 'string') {
      res.status(400).send({
        error: `'participantId' body key must be a string, found ${participantId}`,
      });
      return;
    }
    const amount: number = req.body?.amount || 1;
    if (typeof amount !== 'number') {
      res.status(400).send({
        error: `'amount' body key must be numeric, found ${amount}`,
      });
      return;
    }
    const startedCastingAtVideoStreamOffsetMilliseconds: number =
      req.body?.startedCastingAtVideoStreamOffsetMilliseconds;
    if (typeof startedCastingAtVideoStreamOffsetMilliseconds !== 'number') {
      res.status(400).send({
        error: `'startedCastingAtVideoStreamOffsetMilliseconds' body key must be numeric, found ${amount}`,
      });
      return;
    }
    const endedCastingAtVideoStreamOffsetMilliseconds: number =
      req.body?.endedCastingAtVideoStreamOffsetMilliseconds;
    if (typeof endedCastingAtVideoStreamOffsetMilliseconds !== 'number') {
      res.status(400).send({
        error: `'endedCastingAtVideoStreamOffsetMilliseconds' body key must be numeric, found ${amount}`,
      });
      return;
    }
    const clientGeneratedUuid: string = req.body?.clientGeneratedUuid;
    if (typeof clientGeneratedUuid !== 'string') {
      res.status(400).send({
        error: `'clientGeneratedUuid' body key must be a string, found ${clientGeneratedUuid}`,
      });
      return;
    }

    const participant = battle.participants.find((p) => p.id === participantId);
    if (!participant) {
      res.status(400).send({
        error: `Unable to find battle participant ${participantId} associated with battle`,
      });
      return;
    }

    const result = await BattleParticipant.castVoteFor(
      battle,
      participant.id,
      userMe,
      startedCastingAtVideoStreamOffsetMilliseconds,
      endedCastingAtVideoStreamOffsetMilliseconds,
      amount,
      clientGeneratedUuid,
    );

    if (!result) {
      res.status(400).send({ error: 'Unable to cast vote!' });
      return;
    }

    // NOTE: right now, the vote rescoring happens syncronously in this endpoint. In the future
    // though, this may not happen - it's likely that at a certain scale, this endpoint would put
    // votes into a queue and have them be processed in a deferred fashion, and return something
    // like a 202.
    //
    // IMO, it's better to not expose the vote data here because that will result in the
    // client potentially assuming that the vote and associated score re-tabulation happens
    // immediately, which may not always be the case, and make our lives harder in the future.
    res.status(204).end();
  });

  app.post(
    '/v1/battles/:id/twilio-video-room-webhook',
    bodyParser.urlencoded({ extended: true }), // NOTE: twilio webhooks are NOT json encoded!
    async (req, res) => {
      // Verify that requests are coming from twilio's system
      // ref: https://www.twilio.com/docs/usage/security#validating-requests
      if (TWILIO_WEBHOOK_VERIFICATION_ENABLED) {
        const ok = twilio.validateExpressRequest(req, TWILIO_AUTH_TOKEN);
        if (!ok) {
          res.status(400).send({ error: 'invalid request - did this request come from twilio?' });
          return;
        }
      }

      const body: {
        AccountSid: string;
        RoomName: string;
        RoomSid: string;
        RoomStatus: 'in-progress' | 'completed' | 'failed';
        RoomType: string;
        StatusCallbackEvent:
          | 'room-created'
          | 'room-ended'
          | 'participant-connected'
          | 'participant-disconnected'
          | 'track-added-participant'
          | 'track-removed'
          | 'track-enabled'
          | 'track-disabled'
          | 'recording-started'
          | 'recording-completed'
          | 'recording-failed';
        Timestamp: string; // in ISO-6801 format!
        SequenceNumber: number;

        ParticipantSid?: string;
        ParticipantStatus?: 'connected' | 'disconnected';
        ParticipantDuration?: number;
        ParticipantIdentity?: FixMe;
        RoomDuration?: number; // In seconds
        TrackKind?: 'data' | 'audio' | 'video;';
        SourceSid?: string;
        RecordingSid?: string;
        Type?: 'audio' | 'video';
      } = req.body;

      switch (body.StatusCallbackEvent) {
        case 'recording-started':
          if (body.Type !== 'video') {
            break;
          }

          await prisma.battleParticipant.updateMany({
            where: {
              battleId: req.params.id,
              twilioVideoTrackId: body.SourceSid,
            },
            data: {
              // NOTE: this is NOT the body.Timestamp value, because I want to ensure that the clock
              // being used for all these timestamps is the server time. The twilio server's NTP may
              // not agree and given this is compared with other server-generated timestamps this is
              // important.
              videoStreamingStartedAt: new Date(),
            },
          });
          break;

        case 'recording-completed':
          const battle = await Battle.getById(req.params.id);
          if (!battle) {
            break;
          }

          // Update the recording id on the participant based off of which recording was completed
          let participant: BattleParticipant;
          switch (body.Type) {
            case 'audio': {
              if (typeof body.RecordingSid === 'undefined') {
                console.log(`RecordingSid is empty in body! Skipping...`);
                res.status(204).end();
                return;
              }

              const result =
                await BattleParticipant.getFirstParticipantAssociatedWithBattleWithTwilioAudioTrack(
                  battle.id,
                  body.SourceSid || null,
                );
              if (!result) {
                console.log(
                  `Unable to find a participant associated with ${battle.id} and with a audio track SID of ${body.SourceSid}`,
                );
                res.status(204).end();
                return;
              }
              participant = result;

              participant = await BattleParticipant.storeTwilioAudioRecordingId(
                participant,
                body.RecordingSid,
              );
              console.log(`Set twilioAudioRecordingId for participant ${participant.id}`);
              break;
            }

            case 'video': {
              if (typeof body.RecordingSid === 'undefined') {
                console.log(`RecordingSid is empty in body! Skipping...`);
                res.status(204).end();
                return;
              }

              const result =
                await BattleParticipant.getFirstParticipantAssociatedWithBattleWithTwilioVideoTrack(
                  battle.id,
                  body.SourceSid || null,
                );
              if (!result) {
                console.log(
                  `Unable to find a participant associated with ${battle.id} and with a video track SID of ${body.SourceSid}`,
                );
                res.status(204).end();
                return;
              }
              participant = result;

              participant = await BattleParticipant.storeTwilioVideoRecordingId(
                participant,
                body.RecordingSid,
              );
              console.log(`Set twilioVideoRecordingId for participant ${participant.id}`);
              break;
            }

            default: {
              console.log(`Unknown body type ${body.Type}! Skipping...`);
              res.status(204).end();
              return;
            }
          }

          // Once both recordings are complete, start transcoding the video
          if (participant.twilioVideoRecordingId && participant.twilioAudioRecordingId) {
            await BattleParticipant.beginTranscodingVideoForMobilePlayback(participant);
            console.log(
              `Started transcoding video for battle ${battle.id} and participant ${participant.id}`,
            );
          }
      }

      res.status(204).end();
    },
  );

  app.get(
    '/v1/battles/:id/recording',
    (req, _res, next) => {
      req.authIsOptional = true;
      next();
    },
    RequireAuthMiddleware,
    async (req, res) => {
      const battle = await Battle.getByIdInContextOfUserMe(
        req.params.id,
        req.auth?.userMe || null,
        'read',
      );
      if (!battle) {
        res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
        return;
      }

      res.send(await Battle.generatePlaybackData(battle));
    },
  );

  // ------------------------------------------------------------------------------
  // BATTLE COMMENTS
  // ------------------------------------------------------------------------------

  app.get('/v1/battles/:id/comments', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const [results, count] = await Promise.all([
      BattleComment.listForBattle(battle.id, userMe, page, pageSize),
      BattleComment.countForBattle(battle.id),
    ]);

    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results,
    });
  });

  app.post('/v1/battles/:id/comments', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    if (
      battle.computedPrivacyLevel !== 'PUBLIC' &&
      !battle.participants.find((p) => p.userId === userMe.id)
    ) {
      res.status(400).send({
        error: `Cannot post comment on private battle with id ${battle.id}, user ${userMe.id} was not a participant in the battle!`,
      });
      return;
    }

    if (typeof req.body.text !== 'string') {
      res.status(400).send({
        error: `The 'text' key in the body is not a string! ${JSON.stringify(
          req.body.text,
        )} was found instead.`,
      });
      return;
    }
    if (typeof req.body.commentedAtOffsetMilliseconds !== 'number') {
      res.status(400).send({
        error: `The 'commentedAtOffsetMilliseconds' key in the body is not a string! ${JSON.stringify(
          req.body.commentedAtOffsetMilliseconds,
        )} was found instead.`,
      });
      return;
    }

    const comment = await BattleComment.createForBattle(
      battle,
      userMe.id,
      req.body.text,
      req.body.commentedAtOffsetMilliseconds,
    );

    res.status(201).send(comment);
  });

  app.put('/v1/battles/:id/comments/:commentId', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    const comment = await BattleComment.getById(req.params.commentId, userMe, battle.id);
    if (!comment) {
      res.status(404).send({
        error: `Comment with id ${req.params.commentId} associated with battle with id ${req.params.id} not found!`,
      });
      return;
    }

    if (typeof req.body.text !== 'string') {
      res.status(400).send({
        error: `The 'text' key in the body is not a string! ${JSON.stringify(
          req.body.text,
        )} was found instead.`,
      });
      return;
    }

    const updatedComment = await BattleComment.changeText(comment, userMe.id, req.body.text);

    if (!updatedComment) {
      res.status(400).send({
        error: `Unable to update comment ${req.params.commentId}!`,
      });
      return;
    }

    res.send(updatedComment);
  });

  app.delete('/v1/battles/:id/comments/:commentId', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    const comment = await BattleComment.getById(req.params.commentId, userMe, battle.id);
    if (!comment) {
      res.status(404).send({
        error: `Comment with id ${req.params.commentId} associated with battle with id ${req.params.id} not found!`,
      });
      return;
    }

    await BattleComment.delete(comment);
    res.status(204).end();
  });

  app.post('/v1/battles/:id/comments/:commentId/vote', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const battle = await Battle.getById(req.params.id);
    if (!battle) {
      res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
      return;
    }

    const comment = await BattleComment.getById(req.params.commentId, userMe, battle.id);
    if (!comment) {
      res.status(404).send({
        error: `Comment with id ${req.params.commentId} associated with battle with id ${req.params.id} not found!`,
      });
      return;
    }

    const updatedComment = await BattleComment.voteForCommentAsUser(comment, userMe.id);
    if (updatedComment) {
      res.send(updatedComment);
    } else {
      res.status(400).send({ error: 'Unable to vote on comment!' });
    }
  });

  app.post(
    '/v1/battles/:id/comments/:commentId/unvote',
    RequireAuthMiddleware,
    async (req, res) => {
      const { userMe } = req.auth;

      const battle = await Battle.getById(req.params.id);
      if (!battle) {
        res.status(404).send({ error: `Battle with id ${req.params.id} not found!` });
        return;
      }

      const comment = await BattleComment.getById(req.params.commentId, userMe, battle.id);
      if (!comment) {
        res.status(404).send({
          error: `Comment with id ${req.params.commentId} associated with battle with id ${req.params.id} not found!`,
        });
        return;
      }

      const updatedComment = await BattleComment.deleteCommentVoteForUser(comment, userMe.id);
      if (updatedComment) {
        res.send(updatedComment);
      } else {
        res.status(400).send({ error: 'Unable to unvote comment!' });
      }
    },
  );

  // ------------------------------------------------------------------------------
  // CHALLENGES
  // ------------------------------------------------------------------------------
  app.post('/v1/challenges', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const result = z
      .object({
        userToChallengeId: z.string(),
      })
      .safeParse(req.body);

    if (!result.success) {
      res.status(400).send({ errors: result.error.issues });
      return;
    }

    const userToChallenge = await User.getById(result.data.userToChallengeId);
    if (!userToChallenge) {
      res.status(404).send({ error: `Cannot find user with id ${result.data.userToChallengeId}!` });
      return;
    }

    const challenge = await Challenge.createInContextOfUserMe(userToChallenge, userMe);
    res.status(201).send(challenge);
  });
  app.get('/v1/challenges/pending', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const [results, count] = await Promise.all([
      Challenge.allPendingInContextOfUserMe(page, pageSize, userMe),
      Challenge.countPendingInContextOfUserMe(userMe),
    ]);

    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results,
    });
  });
  app.get('/v1/challenges/:id', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const challenge = await Challenge.getByIdInContextOfUserMe(req.params.id, userMe);
    if (!challenge) {
      res.status(404).send({ error: `Cannot find challenge with id ${req.params.id}!` });
      return;
    }

    res.send(challenge);
  });
  app.put('/v1/challenges/:id/cancel', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const challenge = await Challenge.getByIdInContextOfUserMe(req.params.id, userMe);
    if (!challenge) {
      res.status(404).send({ error: `Cannot find challenge with id ${req.params.id}!` });
      return;
    }

    if (challenge.status !== 'PENDING') {
      res.status(400).send({
        error: `Cannot cancel challenge ${challenge.id}, it is not in PENDING status (found ${challenge.status})`,
      });
      return;
    }

    const updatedChallenge = await Challenge.cancelChallenge(challenge, userMe);
    res.send(updatedChallenge);
  });
  app.put('/v1/challenges/:id/checkin', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const challenge = await Challenge.getByIdInContextOfUserMe(req.params.id, userMe);
    if (!challenge) {
      res.status(404).send({ error: `Cannot find challenge with id ${req.params.id}!` });
      return;
    }

    if (challenge.status !== 'PENDING') {
      res.status(400).send({
        error: `Cannot checkin to challenge ${challenge.id}, it is not in PENDING status (found ${challenge.status})`,
      });
      return;
    }

    await Challenge.checkInToWaitingRoom(challenge, userMe);
    res.status(204).end();
  });
  app.put('/v1/challenges/:id/leave', RequireAuthMiddleware, async (req, res) => {
    const { userMe } = req.auth;

    const challenge = await Challenge.getByIdInContextOfUserMe(req.params.id, userMe);
    if (!challenge) {
      res.status(404).send({ error: `Cannot find challenge with id ${req.params.id}!` });
      return;
    }

    if (challenge.status !== 'PENDING') {
      res.status(400).send({
        error: `Cannot leave the waiting room of challenge ${challenge.id}, it is not in PENDING status (found ${challenge.status})`,
      });
      return;
    }

    await Challenge.leaveWaitingRoom(challenge, userMe);
    res.status(204).end();
  });

  // ------------------------------------------------------------------------------
  // USERS
  // ------------------------------------------------------------------------------
  app.get('/v1/users', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const search = req.query.search ? `${req.query.search}` : '';

    const [results, count] = await Promise.all([
      User.allInContextOfUserMe(page, pageSize, userMe, search),
      User.count(search),
    ]);

    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results,
    });
  });

  app.get('/v1/users/me', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    res.status(200).send(userMe);
  });
  app.get(
    '/v1/users/me/is-challenging',
    RequireAuthMiddleware,
    async (req: Request, res: Response) => {
      const { userMe } = req.auth;

      const isChallengingSomeone = await User.isChallengingAnotherUser(userMe);
      res.send({ status: isChallengingSomeone });
    },
  );

  app.get(
    '/v1/users/generated-rap-tag',
    RequireAuthMiddleware,
    async (req: Request, res: Response) => {
      res.status(200).send({
        name: await generateNameNotAlreadyInUsersTable(),
      });
    },
  );

  app.get('/v1/users/:id', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    const user = await User.getByIdInContextOfUserMe(req.params.id, userMe);
    if (!user) {
      res.status(404).send({ error: `Cannot find user with id ${req.params.id}!` });
      return;
    }

    res.status(200).send(user);
  });
  app.put('/v1/users/:id', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    // Only allow a user to update themselves
    if (req.params.id !== userMe.id) {
      res.status(404).send({ error: `Cannot find updatable user with id ${req.params.id}!` });
      return;
    }

    const result = z
      .object({
        intro: z.string().optional(),
        locationName: z.string().nullable().optional(),
        locationLatitude: z.number().nullable().optional(),
        locationLongitude: z.number().nullable().optional(),
        favoriteRapperSpotifyId: z.string().nullable().optional(),
        favoriteRapperName: z.string().nullable().optional(),
        favoriteSongSpotifyId: z.string().nullable().optional(),
        favoriteSongName: z.string().nullable().optional(),
        favoriteSongArtistName: z.string().nullable().optional(),
        instagramHandle: z.string().nullable().optional(),
        soundcloudHandle: z.string().nullable().optional(),
      })
      .safeParse(req.body);

    if (!result.success) {
      res.status(400).send({ errors: result.error.issues });
      return;
    }

    const user = await User.updateByIdInContextOfUserMe(req.params.id, result.data, userMe);
    if (!user) {
      res.status(404).send({ error: `Cannot find user with id ${req.params.id}!` });
      return;
    }

    res.status(200).send(user);
  });

  // NOTE: this endpoint is now DEPRECATED. It should not be used.
  app.get('/v1/users/:id/metadata', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    const user = await User.getById(req.params.id);
    if (!user) {
      res.status(404).send({ error: `Cannot find user with id ${req.params.id}!` });
      return;
    }

    const isBeingFollowed =
      (await prisma.userFollows.count({
        where: {
          userId: userMe.id,
          followsUserId: user.id,
        },
      })) > 0;

    res.status(200).send({ isBeingFollowed });
  });
  // END DEPRECATED ENDPOINT

  app.get('/v1/users/:id/following', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    const user = await User.getById(req.params.id);
    if (!user) {
      res.status(404).send({ error: `Cannot find user with id ${req.params.id}!` });
      return;
    }

    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const [users, count] = await User.getFollowing(user, userMe, page, pageSize);
    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results: users,
    });
  });

  app.get('/v1/users/:id/followers', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    const user = await User.getById(req.params.id);
    if (!user) {
      res.status(404).send({ error: `Cannot find user with id ${req.params.id}!` });
      return;
    }

    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 100) {
      pageSize = 100;
    }

    const [users, count] = await User.getFollowers(user, userMe, page, pageSize);
    res.send({
      total: count,
      next: page * pageSize < count ? true : false,
      results: users,
    });
  });

  app.post('/v1/users/:id/follow', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    if (userMe.id === req.params.id) {
      res.status(400).send({ error: `A user cannot follow themselves!` });
      return;
    }

    const updatedUserMe = await User.followUser(userMe, req.params.id);
    if (!updatedUserMe) {
      res.status(400).send({
        error: `Unable to follow user ${req.params.id} - is this user already being followed?`,
      });
      return;
    }
    res.status(204).end();
  });

  app.post('/v1/users/:id/unfollow', RequireAuthMiddleware, async (req: Request, res: Response) => {
    const { userMe } = req.auth;

    if (userMe.id === req.params.id) {
      res.status(400).send({ error: `A user cannot unfollow themselves!` });
      return;
    }

    const updatedUser = await User.unfollowUser(userMe, req.params.id);
    if (!updatedUser) {
      res.status(400).send({
        error: `Unable to unfollow user ${req.params.id} - is this user not already being followed?`,
      });
      return;
    }
    res.status(204).end();
  });

  app.get(
    '/v1/users/:id/battles/recordings',
    RequireAuthMiddleware,
    async (req: Request, res: Response) => {
      const { userMe } = req.auth;

      const user = await User.getById(req.params.id);
      if (!user) {
        res.status(404).send({ error: `Cannot find user with id ${req.params.id}!` });
        return;
      }

      const sort = req.query.sort ? `${req.query.sort}` : undefined;
      if (typeof sort === 'string' && sort !== 'TRENDING' && sort !== 'RECENT') {
        res
          .status(400)
          .send({ error: `Unknown sort ${sort}! Please pass either RECENT or TRENDING.` });
        return;
      }

      let page = parseInt(`${req.query.page}`, 10);
      if (isNaN(page)) {
        page = 1;
      }
      let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
      if (pageSize > 100) {
        pageSize = 100;
      }

      const includeEmptyForfeitedBattles =
        `${req.query.includeEmptyForfeitedBattles}`.toLowerCase() === 'true';

      const [battleIds, count] = await User.getBattleIdsParticipatedIn(
        user.id,
        userMe,
        sort,
        includeEmptyForfeitedBattles,
        page,
        pageSize,
      );

      const battles = await Battle.getByIds(battleIds);

      res.send({
        total: count,
        next: page * pageSize < count ? true : false,
        results: await Promise.all(
          battles.map(async (battle) => Battle.generatePlaybackData(battle)),
        ),
      });
    },
  );

  // When the user is updated within the clerk system, the update will be synced via a webhook to the
  // barz server, which will write the user to the database
  app.post(
    '/v1/users/clerk-webhook',
    bodyParser.raw({ type: 'application/json' }), // NOTE: this is required for the webhook verification
    async (req, res) => {
      // Verify the webhook to make sure it came from clerk's servers
      // NOTE: this can be disabled in local development / for testing
      let payload: FixMe;
      if (CLERK_SVIX_VERIFICATION_ENABLED) {
        const webhook = new Webhook(CLERK_SVIX_WEBHOOK_SECRET);
        try {
          payload = webhook.verify(req.body, req.headers as Record<string, string>);
        } catch (err) {
          console.error('Error processing clerk webhook:', err);
          res.status(400).json({});
          return;
        }
      } else {
        payload = JSON.parse(req.body.toString('utf8'));
      }

      if (payload.object !== 'event') {
        res.status(204).end();
        return;
      }

      switch (payload.type) {
        case 'user.created': {
          const primaryPhoneNumber = payload.data.phone_numbers.find(
            (phoneNumber: FixMe) => phoneNumber.id === payload.data.primary_phone_number_id,
          );
          await prisma.user.create({
            data: {
              createdAt: fromUnixTime(payload.data.created_at / 1000),
              updatedAt: fromUnixTime(payload.data.updated_at / 1000),
              clerkId: payload.data.id,
              handle: payload.data.username || null,
              name: payload.data.unsafe_metadata.rapperName || null,
              phoneNumber: primaryPhoneNumber ? primaryPhoneNumber.phone_number : null,
              // NOTE: payload.data.image_url is set to be a default clerk profile image when a user
              // is created by default. The `avatarImageUploaded` flag is set by the client to
              // indicate that a CUSTOM image was uploaded rather than the default image being stored.
              profileImageUrl: payload.data.unsafe_metadata.avatarImageUploaded
                ? payload.data.image_url
                : null,
              computedScore: USER_INITIAL_SCORE,
            },
          });
          break;
        }

        case 'user.updated': {
          const primaryPhoneNumber = payload.data.phone_numbers.find(
            (phoneNumber: FixMe) => phoneNumber.id === payload.data.primary_phone_number_id,
          );

          await prisma.user.updateMany({
            where: { clerkId: payload.data.id },
            data: {
              createdAt: fromUnixTime(payload.data.created_at / 1000),
              updatedAt: fromUnixTime(payload.data.updated_at / 1000),
              handle: payload.data.username || null,
              name: payload.data.unsafe_metadata.rapperName || null,
              phoneNumber: primaryPhoneNumber ? primaryPhoneNumber.phone_number : null,
              // NOTE: payload.data.image_url is set to be a default clerk profile image when a user
              // is created by default. The `avatarImageUploaded` flag is set by the client to
              // indicate that a CUSTOM image was uploaded rather than the default image being stored.
              profileImageUrl: payload.data.unsafe_metadata.avatarImageUploaded
                ? payload.data.image_url
                : null,
            },
          });
          break;
        }

        case 'user.deleted': {
          await prisma.user.deleteMany({
            where: { clerkId: payload.data.id },
          });
          break;
        }
      }

      res.status(204).end();
    },
  );

  // ------------------------------------------------------------------------------
  // SPOTIFY API PROXIED REQUESTS
  // ------------------------------------------------------------------------------
  app.get('/v1/spotify/tracks/search', async (req: Request, res: Response) => {
    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 50) {
      pageSize = 50;
    }

    const query = `${req.query.q}`;
    if (query.length === 0) {
      res.status(400).send({
        error: `A "q" query parameter is required, which specifies the search string. This seems to have been omitted.`,
      });
      return;
    }

    const paginatedResponse = await Spotify.searchForTrack(query, pageSize, (page - 1) * pageSize);
    res.send(paginatedResponse);
  });

  app.get('/v1/spotify/artists/search', async (req: Request, res: Response) => {
    let page = parseInt(`${req.query.page}`, 10);
    if (isNaN(page)) {
      page = 1;
    }
    let pageSize = parseInt(`${req.query.pageSize || 25}`, 10);
    if (pageSize > 50) {
      pageSize = 50;
    }

    const query = `${req.query.q}`;
    if (query.length === 0) {
      res.status(400).send({
        error: `A "q" query parameter is required, which specifies the search string. This seems to have been omitted.`,
      });
      return;
    }

    const paginatedResponse = await Spotify.searchForArtist(query, pageSize, (page - 1) * pageSize);
    res.send(paginatedResponse);
  });

  // GEOCODING API REQUESTS
  app.get('/v1/geocoding/search', async (req: Request, res: Response) => {
    if (!req.query.q) {
      res
        .status(400)
        .send({ error: 'Search parameter "q" containing geocoding query was omitted' });
      return;
    }

    // ref: https://wiki.openstreetmap.org/wiki/Nominatim
    // NOTE: At some point, this free service will likely no longer scale with Barz, and switching
    // to a different service like mapbox will likely be required.
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search.php?q=${req.query.q}&format=jsonv2`,
    );
    if (!response.ok) {
      res.status(response.status).send(await response.text());
      return;
    }

    res.status(200).send(await response.json());
  });

  // ------------------------------------------------------------------------------
  // PUSHER AUTH WEBHOOK
  // ------------------------------------------------------------------------------
  app.post('/v1/pusher/auth', RequireAuthMiddleware, async (req, res) => {
    // More info about this workflow: https://pusher.com/docs/channels/server_api/authorizing-users/
    //
    // However, note that this request is being made via the `onAuthorizer` prop in the barz mobile
    // app which allows it to send custom headers and camelcased formatted data in the body.
    const socketId: string = req.body.socketId;
    const channelName: string = req.body.channelName;

    const { userMe } = req.auth;

    const [
      _private, // "private-" prefix
      objectType, // Type of object - ie, "battle"
      objectId, // Id of the object refered to by `objectType`
      objectSubType, // An optional subtype of object - ie, for "battle", "events" can be here
      ...restParameters
    ] = channelName.split('-');
    switch (objectType) {
      case 'battle': {
        switch (objectSubType) {
          // private-battle-[BATTLEID]-results
          case 'results':
          // private-battle-[BATTLEID]-comments
          case 'comments': {
            // Anyone can subscribe to get the results of a battle, this is needed for people
            // viewing a battle on the home page
            const matchingBattle = await Battle.getByIdInContextOfUserMe(objectId, userMe, 'read');
            if (!matchingBattle) {
              console.log(
                `Unable to authorize ${channelName}, user ${req.auth.userClerkId} is not in battle ${objectId}!`,
              );
              res.status(403).send({
                error: `Unable to authorize ${channelName}, user is not in battle ${objectId}!`,
              });
              return;
            }
            break;
          }
          // private-battle-[BATTLEID]-user-[USERID]-commentvotes
          case 'user': {
            const [userId, objectSubSubType] = restParameters;
            if (objectSubSubType !== 'commentvotes') {
              res.status(403).send({
                error: `Unable to authorize ${channelName}, object sub sub type of ${objectSubSubType} unknown!`,
              });
              return;
            }
            const userMe = await User.getByClerkId(req.auth.userClerkId);
            if (!userMe || userId !== userMe.id) {
              res.status(403).send({
                error: `Unable to authorize ${channelName}, authorized user does not have access to user id ${userId}!`,
              });
              return;
            }
            break;
          }
          // private-battle-[BATTLEID]-events
          case 'events':
          // private-battle-[BATTLEID]
          default: {
            // Only users part of a battle should be able to subscribe to aribtrary battle channels
            const matchingBattle = await Battle.getByIdInContextOfUserMe(
              objectId,
              userMe,
              'in-battle-read',
            );
            if (!matchingBattle) {
              console.log(
                `Unable to authorize ${channelName}, user ${req.auth.userClerkId} is not in battle ${objectId}!`,
              );
              res.status(403).send({
                error: `Unable to authorize ${channelName}, user is not in battle ${objectId}!`,
              });
              return;
            }
          }
        }
        break;
      }

      // private-battleparticipant-[BATTLEPARTICIPANTID]
      // private-battleparticipant-[BATTLEPARTICIPANTID]-votes
      case 'battleparticipant': {
        if (objectSubType === 'votes') {
          const participant = await BattleParticipant.getById(objectId);
          if (participant) {
            if (!participant.battleId) {
              res.status(403).send({
                error: `Unable to authorize ${channelName}, participant ${objectId} is not in a battle!`,
              });
              return;
            }
            const matchingBattle = await Battle.getByIdInContextOfUserMe(
              participant.battleId,
              userMe,
              'read',
            );
            if (!matchingBattle) {
              res.status(403).send({
                error: `Unable to authorize ${channelName}, participant ${objectId}'s battle is not accessible!`,
              });
              return;
            }
          }
        } else {
          const matchingParticipant = await BattleParticipant.getByIdInContextOfUserMe(
            objectId,
            userMe,
            'live-read',
          );
          if (!matchingParticipant) {
            console.log(
              `Unable to authorize ${channelName}, user ${req.auth.userClerkId} is not participant ${objectId} or is not in a battle with participant ${objectId}!`,
            );
            res.status(403).send({
              error: `Unable to authorize ${channelName}, user is not participant ${objectId} or is not in a battle with participant ${objectId}!`,
            });
            return;
          }
        }
        break;
      }

      // private-user-[USERID]
      case 'user': {
        // private-user-[USERID]-challenges
        if (objectSubType === 'challenges') {
          const userMe = await User.getByClerkId(req.auth.userClerkId);
          if (!userMe) {
            res
              .status(404)
              .send({ error: `Cannot find user with clerk id ${req.auth.userClerkId}!` });
            return;
          }

          if (userMe.id !== objectId) {
            console.log(
              `Unable to authorize ${channelName}, user id specified ${objectId} is not the user me ${userMe.id}`,
            );
            res.status(403).send({
              error: `Unable to authorize ${channelName}, user id specified ${objectId} is not the user me ${userMe.id}`,
            });
            return;
          }
          break;
        }

        // Allow anyone to subscribe to any user so they can get clout score updates, etc
        break;
      }

      default: {
        console.log(`Unknown channel name ${channelName}!`);
        res.status(403).send({ error: `Unknown channel name ${channelName}!` });
        return;
      }
    }

    // Let the user pass through if all the auth checks passed!
    const authResponse = pusherAuthorizeChannel(socketId, channelName);
    res.send(authResponse);
  });

  app.use(
    '/v1/local-object-signed-links',
    (req, res, next) => {
      // Disable this endpoint if the local object storage implementation is not enabled
      if (OBJECT_STORAGE_IMPLEMENTATION !== 'local') {
        res.status(404).end();
        return;
      }

      const expiresAt = req.query.expiresAt;
      if (expiresAt) {
        const expiresAtDate = new Date(`${expiresAt}`);
        const now = new Date();
        if (isAfter(now, expiresAtDate)) {
          res.status(403).send({ error: 'Signed link expired!' });
          return;
        }
      }
      next();
    },
    express.static('.local-object-storage'),
  );

  if (SENTRY_DSN) {
    // The error handler must be before any other error middleware and after all controllers
    app.use(Sentry.Handlers.errorHandler());
  }

  return app;
}
export default createApp;

function main() {
  const PORT = parseInt(process.env.PORT || '8000', 10);

  let app;
  if (MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID) {
    console.warn(
      'WARNING: MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID is set, which disabled auth for local development! This should never happen in production.',
    );
    app = createApp({
      requireAuth: false,
      authedUserId: MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID,
    });
  } else {
    app = createApp({ requireAuth: true });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`-> Listening on port ${PORT}`);

    // When working on the application locally, start a `ngrok` proxy so that webhooks from twilio
    // video can talk to the application even when behind a firewall
    if (process.env.NGROK_AUTHTOKEN) {
      ngrok.connect({ addr: PORT, authtoken_from_env: true }).then((url) => {
        console.log(`-> Listening externally on: ${url}`);
        monkeyPatchPublicBaseUrl(url);
      });
    } else {
      console.log(
        'To create an automatic ngrok tunnel, set the NGROK_AUTHTOKEN environment variable equal to a ngrok token.',
      );
    }
  });
}

if (import.meta.url.endsWith(process.argv[1])) {
  main();
}
