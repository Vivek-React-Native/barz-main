import request from 'supertest';
import MockDate from 'mockdate';

import createApp from '../src/index.ts';
import prisma from '../src/lib/prisma.ts';
import { BARZ_STAGING_PUBLIC_KEY } from './setup.ts';

describe('Auth / Token Processing', () => {
  it('should be able to authenticate with a valid jwt token', async () => {
    const app = createApp({ requireAuth: true, overriddenPublicKey: BARZ_STAGING_PUBLIC_KEY });

    const GOOD_TOKEN = `eyJhbGciOiJSUzI1NiIsImtpZCI6Imluc18yUjlvZjhYTzFxMWVRQkVaNnhweVg0QWdKMWgiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE2ODY5MjU2OTksImlhdCI6MTY4NjkyNTYzOSwiaXNzIjoiaHR0cHM6Ly92aXRhbC1zdGFyZmlzaC02NS5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE2ODY5MjU2MjksInNpZCI6InNlc3NfMlJJN0ZnUVFzRmRwQWx5YWZsblpXcHl5aVRLIiwic3ViIjoidXNlcl8yUjl3Zk9WQUlsWVFrUU50eHJseXdmeUVobUUifQ.drP1qkeBbeICSDGAxdzDqJlqBV_peRTi55aiCIii7om3JWUapOilJNP0GKunj39RyzxrHYuDj10enJlItJaxw8DmFCc-vCtdiMfeM5o9sN7HcVnqMSgi_OFe9nARaTzDMUe6jXtUYRFL2Rw6KuVFRzRmmS9AxhbjjfKycx1AO93-joOq0wqUSWhfBkwUg0_krbcazD7201afF0Ypx8XyDvHArrAZIZqPk-h3jtOjfNlik0vA6n9pMxpzB8ut-KTkgWF1k3mWo35dv1aEyosx0en3DDifXkEN0TF6ri8I3qAUMXVn0aK7kO49b5MTeia6BJoaRl2xVXP-QFRbk3F1Sw`;

    // Create the user that is being looked up
    await prisma.user.create({
      data: {
        clerkId: 'user_2R9wfOVAIlYQkQNtxrlywfyEhmE',
      },
    });

    // NOTE: This is a time BEFORE the time the token expires
    MockDate.set(new Date('2023-06-16T14:27:30Z'));

    await request(app).get('/v1/users/me').set('Authorization', `Bearer ${GOOD_TOKEN}`).expect(200);
  });
  it('should NOT be able to authenticate with an invalid header', async () => {
    const app = createApp({ requireAuth: true, overriddenPublicKey: BARZ_STAGING_PUBLIC_KEY });

    // Request details on the current user with a bad header
    await request(app).get('/v1/users/me').set('Authorization', 'BADHEADER').expect(401);
  });
  it('should NOT be able to authenticate with a missing header', async () => {
    const app = createApp({ requireAuth: true, overriddenPublicKey: BARZ_STAGING_PUBLIC_KEY });

    await request(app)
      .get('/v1/users/me')
      // No Authorization header!
      .expect(401);
  });
  it('should NOT be able to authenticate with an expired token', async () => {
    const app = createApp({ requireAuth: true, overriddenPublicKey: BARZ_STAGING_PUBLIC_KEY });

    const GOOD_TOKEN = `eyJhbGciOiJSUzI1NiIsImtpZCI6Imluc18yUjlvZjhYTzFxMWVRQkVaNnhweVg0QWdKMWgiLCJ0eXAiOiJKV1QifQ.eyJleHAiOjE2ODY5MjU2OTksImlhdCI6MTY4NjkyNTYzOSwiaXNzIjoiaHR0cHM6Ly92aXRhbC1zdGFyZmlzaC02NS5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE2ODY5MjU2MjksInNpZCI6InNlc3NfMlJJN0ZnUVFzRmRwQWx5YWZsblpXcHl5aVRLIiwic3ViIjoidXNlcl8yUjl3Zk9WQUlsWVFrUU50eHJseXdmeUVobUUifQ.drP1qkeBbeICSDGAxdzDqJlqBV_peRTi55aiCIii7om3JWUapOilJNP0GKunj39RyzxrHYuDj10enJlItJaxw8DmFCc-vCtdiMfeM5o9sN7HcVnqMSgi_OFe9nARaTzDMUe6jXtUYRFL2Rw6KuVFRzRmmS9AxhbjjfKycx1AO93-joOq0wqUSWhfBkwUg0_krbcazD7201afF0Ypx8XyDvHArrAZIZqPk-h3jtOjfNlik0vA6n9pMxpzB8ut-KTkgWF1k3mWo35dv1aEyosx0en3DDifXkEN0TF6ri8I3qAUMXVn0aK7kO49b5MTeia6BJoaRl2xVXP-QFRbk3F1Sw`;

    // NOTE: This is a time AFTER the time the token expires
    MockDate.set(new Date('2023-06-16T20:27:30Z'));

    await request(app).get('/v1/users/me').set('Authorization', `Bearer ${GOOD_TOKEN}`).expect(401);
  });
});
