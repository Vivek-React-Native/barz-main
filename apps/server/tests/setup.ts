import path from 'path';

import prisma from '../src/lib/prisma.ts';
import { BASE_PROJECT_DIRECTORY } from '../src/config.ts';
import { FixMe } from '../src/lib/fixme.ts';

export const BARZ_STAGING_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2K87jFleQ9jaetKCuLKF
djDGRg18VzED+ynuHFwwIYFAwF2mUMLhVtEvG4h7ehoa++Q+dFJ8QNgPh0WKt9r0
4XdYlM1elGqpfrBt/RxelnZVqqM5FJ3HBTSh815YI1DQy9zruZRhqWdXorn7fkZ5
L/6Li5rx8kR7I+3lQYVkxrvjfql9FvJn2LJh+NN7dbUrulTlevZdZkqdPbWzDf/v
wjH5KMbXPq9bABcF7mQDzf+pwU63iacsAEmNfTU1GXcTyDCjsPoYDuSK8Zsxqhdy
bBQzksF0HZVuxXt9GpxS+m0IZkp8XzzIgGtTmueFPZqR5xsbVMG8m7Lpajg97HVX
4wIDAQAB
-----END PUBLIC KEY-----`;

export const MOCK_MKV_VIDEO_PATH = path.join(
  BASE_PROJECT_DIRECTORY,
  'fixtures',
  'videos',
  'RT19c528173f0b52f5b907e761ad359726.mkv',
);
export const MOCK_MKA_AUDIO_PATH = path.join(
  BASE_PROJECT_DIRECTORY,
  'fixtures',
  'videos',
  'RT8a62d15bde0b1f9e09798e4935034fbd.mka',
);
export const MOCK_MP4_PATH = path.join(
  BASE_PROJECT_DIRECTORY,
  'fixtures',
  'videos',
  'bigbuckbunny.mp4',
);
export const MOCK_512_THUMBNAIL_PATH = path.join(
  BASE_PROJECT_DIRECTORY,
  'fixtures',
  'images',
  'mock-thumbnail-512.jpg',
);

export const truncateDb = async () => {
  const isTestEnv = process.env.NODE_ENV === 'test';
  const isTestDb = process.env.DATABASE_URL?.includes('demo-test');

  if (!isTestEnv || !isTestDb) {
    throw new Error('You should never run these outside test');
  }

  const results: FixMe =
    await prisma.$queryRaw`SELECT tablename FROM pg_tables where schemaname='public';`;
  const tableNames = results
    .map((r: FixMe) => r.tablename)
    .filter((r: string) => !r.startsWith('_prisma'));

  for (const tableName of tableNames) {
    await prisma.$queryRawUnsafe(`TRUNCATE TABLE "public"."${tableName}" CASCADE;`);
  }

  const relResults =
    await prisma.$queryRaw`SELECT c.relname FROM pg_class AS c JOIN pg_namespace AS n ON c.relnamespace = n.oid WHERE c.relkind='S' AND n.nspname='public';`;

  // @ts-ignore
  const relNames = relResults.map((r) => r.relname);

  for (const relName of relNames) {
    // @ts-ignore
    await prisma.$queryRawUnsafe(`ALTER SEQUENCE "public"."${relName}" RESTART WITH 1;`);
  }
};

beforeEach(async () => {
  await truncateDb();

  // Create a fake beat
  await prisma.battleBeat.create({ data: { beatKey: 'sample_quiet.mp3' } });
});
