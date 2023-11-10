import { RedisOptions } from 'ioredis';
import { parseURL } from 'ioredis/built/utils';
import fs from 'fs';
import path from 'path';
import url from 'url';

// ------------------------------------------------------------------------------
// AUTHORIZATION CONFIGURATION
// ------------------------------------------------------------------------------
export const CLERK_PUBLIC_KEY = Buffer.from(
  process.env.CLERK_BASE64_ENCODED_PUBLIC_KEY || '',
  'base64',
)
  .toString()
  .replace(/^\s+/, '')
  .replace(/\s+$/, '');
if (CLERK_PUBLIC_KEY.length === 0) {
  console.error(
    `Error parsing environment variable CLERK_BASE64_ENCODED_PUBLIC_KEY - it was empty. This must be set to a public key from clerk's dashboard for auth to work correctly.`,
  );
  process.exit(1);
}
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error(
    `Error parsing environment variable CLERK_SECRET_KEY - found '${CLERK_SECRET_KEY}'. This must not be empty.`,
  );
  process.exit(1);
}
export const CLERK_SVIX_VERIFICATION_ENABLED =
  (process.env.CLERK_SVIX_VERIFICATION_ENABLED || 'true').toLowerCase() === 'true';
export const CLERK_SVIX_WEBHOOK_SECRET = process.env.CLERK_SVIX_WEBHOOK_SECRET || '';
if (CLERK_SVIX_VERIFICATION_ENABLED && CLERK_SVIX_WEBHOOK_SECRET.length === 0) {
  console.error(
    `Error parsing environment variable CLERK_SVIX_WEBHOOK_SECRET - found '${CLERK_SVIX_WEBHOOK_SECRET}'. This must not be empty.`,
  );
  process.exit(1);
}

export const DEMO_USER_PHONE_NUMBER = process.env.DEMO_USER_PHONE_NUMBER || null;
export const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || null;

// If the below environment variable is set IN DEVELOPMENT, then whenever a request is made to the
// API, the `Authorization` header isn't checked, and this user is assumed to be the user that is
// authenticated.
export const MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID =
  process.env.MOCK_DEVELOPMENT_AUTH_OVERRIDE_CLERK_USER_ID || null;

// ------------------------------------------------------------------------------
// OBJECT STORAGE CONFIGURATION
//
// Which provider should be used for object storage? Defaults to storing objects
// on the local filesystem.
// ------------------------------------------------------------------------------
export const OBJECT_STORAGE_IMPLEMENTATION = (
  process.env.OBJECT_STORAGE_IMPLEMENTATION || 'local'
).toLowerCase() as 'local' | 's3';
if (!['local', 's3'].includes(OBJECT_STORAGE_IMPLEMENTATION)) {
  console.error(
    `Error parsing environment variable OBJECT_STORAGE_IMPLEMENTATION - found '${OBJECT_STORAGE_IMPLEMENTATION}'. This must be either set to 'local' or 's3'.`,
  );
  process.exit(1);
}
export const OBJECT_STORAGE_DEFAULT_EXPIRE_TIME_MILLSECONDS = 60 * 60 * 1000; // 1 hour

export const OBJECT_STORAGE_BEATS_S3_BUCKET = process.env.OBJECT_STORAGE_BEATS_S3_BUCKET || '';
if (OBJECT_STORAGE_IMPLEMENTATION === 's3' && OBJECT_STORAGE_BEATS_S3_BUCKET.length === 0) {
  console.error(
    `Error parsing environment variable OBJECT_STORAGE_BEATS_S3_BUCKET - found '${OBJECT_STORAGE_BEATS_S3_BUCKET}'. When OBJECT_STORAGE_IMPLEMENTATION is s3, this must be set!`,
  );
  process.exit(1);
}

export const OBJECT_STORAGE_RECORDINGS_S3_BUCKET =
  process.env.OBJECT_STORAGE_RECORDINGS_S3_BUCKET || '';
if (OBJECT_STORAGE_IMPLEMENTATION === 's3' && OBJECT_STORAGE_RECORDINGS_S3_BUCKET.length === 0) {
  console.error(
    `Error parsing environment variable OBJECT_STORAGE_RECORDINGS_S3_BUCKET - found '${OBJECT_STORAGE_RECORDINGS_S3_BUCKET}'. When OBJECT_STORAGE_IMPLEMENTATION is s3, this must be set!`,
  );
  process.exit(1);
}

// ------------------------------------------------------------------------------
// BATTLE PARTICIPANT MATCHING SETTINGS
// ------------------------------------------------------------------------------

// Defines the durations between score changes in the battle matching process
export const BATTLE_PARTICIPANT_MATCHING_SCORE_TABLE = [
  [0, 2500], // Initially, allow a +/- 2500 score deviation     (5k)
  [15_000, 5_000], // After 15000ms, allow a +/- 5000 score deviation (10k)
  [30_000, 7_500], // After 30000ms, allow a +/- 7500 score deviation (15k)
];
// How long should the battle participant matching process run before before it gets terminated?
// A value of `null` will disable this.
export const BATTLE_PARTICIPANT_MATCHING_MAX_LENGTH_MINUTES = 30;

// ------------------------------------------------------------------------------
// BATTLE PARTICIPANT VOTING SETTINGS
// ------------------------------------------------------------------------------

// The length of time that a battle can be voted on before voting closes
// If `null`, battle voting never closes.
export const VOTING_TIME_INTERVAL_LENGTH_DAYS = 7;

// ------------------------------------------------------------------------------
// SENTRY
// ------------------------------------------------------------------------------
export const SENTRY_DSN = process.env.SENTRY_DSN || null;

// ------------------------------------------------------------------------------
// REDIS / CACHE CONFIGURATION
// ------------------------------------------------------------------------------
export let REDIS_CONFIG: RedisOptions;
if (process.env.REDIS_URL) {
  REDIS_CONFIG = parseURL(process.env.REDIS_URL);
  REDIS_CONFIG.maxRetriesPerRequest = null;
} else {
  try {
    REDIS_CONFIG = JSON.parse(process.env.REDIS_CONFIG || '');
    REDIS_CONFIG.maxRetriesPerRequest = null;
  } catch (err) {
    console.error(
      'Error parsing environment variable REDIS_CONFIG as JSON! Please either define REDIS_URL or set REDIS_CONFIG to an ioredis connection object: https://github.com/luin/ioredis',
    );
    process.exit(1);
  }
}

export const BATTLE_PARTICIPANT_CHECKIN_INACTIVITY_THRESHOLD_SECONDS = 8.0;

// The amount of time that a user must be offline before they automatically forfeit the battle
export const BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS = 10.0;

// ------------------------------------------------------------------------------
// PUSHER CONFIGURATION
// ------------------------------------------------------------------------------
export const PUSHER_APP_ID = process.env.PUSHER_APP_ID || '';
if (!PUSHER_APP_ID) {
  console.error(
    `Error parsing environment variable PUSHER_APP_ID - found '${PUSHER_APP_ID}'. This must not be empty.`,
  );
  process.exit(1);
}
export const PUSHER_KEY = process.env.PUSHER_KEY || '';
if (!PUSHER_KEY) {
  console.error(
    `Error parsing environment variable PUSHER_KEY - found '${PUSHER_KEY}'. This must not be empty.`,
  );
  process.exit(1);
}
export const PUSHER_SECRET = process.env.PUSHER_SECRET || '';
if (!PUSHER_SECRET) {
  console.error(
    `Error parsing environment variable PUSHER_SECRET - found '${PUSHER_SECRET}'. This must not be empty.`,
  );
  process.exit(1);
}
export const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER || 'us2';

// ------------------------------------------------------------------------------
// TWILIO VIDEO CONFIGURATION
// ------------------------------------------------------------------------------
if (typeof process.env.TWILIO_ACCOUNT_SID === 'undefined') {
  console.error('Environment variable TWILIO_ACCOUNT_SID is empty - this is not allowed.');
  process.exit(1);
}
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;

if (typeof process.env.TWILIO_API_KEY_SID === 'undefined') {
  console.error('Environment variable TWILIO_API_KEY_SID is empty - this is not allowed.');
  process.exit(1);
}
export const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;

if (typeof process.env.TWILIO_API_KEY_SECRET === 'undefined') {
  console.error('Environment variable TWILIO_API_KEY_SECRET is empty - this is not allowed.');
  process.exit(1);
}
export const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;

if (typeof process.env.TWILIO_AUTH_TOKEN === 'undefined') {
  console.error('Environment variable TWILIO_AUTH_TOKEN is empty - this is not allowed.');
  process.exit(1);
}
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_WEBHOOK_VERIFICATION_ENABLED =
  (process.env.TWILIO_WEBHOOK_VERIFICATION_ENABLED || 'true').toLowerCase() === 'true';

// ------------------------------------------------------------------------------
// SPOTIFY CONFIGURATION
// ------------------------------------------------------------------------------
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || null;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || null;

// ------------------------------------------------------------------------------
// BASE PROJECT DIRECTORY
//
// This exposes the absolute path of the root of the repository
// ------------------------------------------------------------------------------
const THIS_FILE_ABSOLUTE_FILE_PATH = url.fileURLToPath(import.meta.url);
export const BASE_PROJECT_DIRECTORY = path.dirname(path.dirname(THIS_FILE_ABSOLUTE_FILE_PATH));

// ------------------------------------------------------------------------------
// PUBLIC BASE URL CONFIGURATION
//
// In production, this environment variable should be configured to be the path
// to the app from outside the local network using any public domain names.
// In local development, this is set to a locally generated public ngrok url.
// ------------------------------------------------------------------------------
let PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
export let getPublicBaseUrl = () => {
  if (PUBLIC_BASE_URL) {
    return PUBLIC_BASE_URL;
  }

  // If PUBLIC_BASE_URL isn't defined, look in this temp file that `monkeyPatchPublicBaseUrl`
  // stashes data into. This is a local development path and is not something that should be
  // EVER used in production...
  try {
    const buffer = fs.readFileSync('/tmp/barz-public-base-url');
    const result = buffer.toString();
    if (result.length > 0) {
      return result;
    } else {
      return '';
    }
  } catch {
    return '';
  }
};
export const monkeyPatchPublicBaseUrl = (newPublicBaseUrl: string) => {
  PUBLIC_BASE_URL = newPublicBaseUrl;

  // Stash the new PUBLIC_BASE_URL value here so that other processes can pick it up from the
  // filesystem in `getPublicBaseUrl`
  fs.writeFileSync('/tmp/barz-public-base-url', newPublicBaseUrl);
};
